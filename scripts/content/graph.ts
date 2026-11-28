// npm run graph: read content/ as a graph and report the stories it hasn't told yet.
//
// Everything the report needs is already in the content — every event names its characters,
// its place, its date, its typed links, its arcs and its journeys — but nothing asks the
// whole of it a question. This does, in five:
//
//   1. untold journey legs      a stretch of road with no scene at either end
//   2. missing links            two of a character's own scenes, close in time, unjoined
//   3. two parties, one place   the same place within days, with nothing said between them
//   4. islands in a life        a character's story in pieces, with no road shown between
//   5. threads let go           a chain of cause whose last scene has no consequence told
//
// These are not lint errors. Every finding is a scene that could be told, and the point of
// the project is to tell what the books leave off the page (issue #88). An author reads the
// report, not a machine, so each query is tuned for a short list worth reading: the windows
// are stated in the report itself, in the words of the honest ranges the content keeps.
//
// This is an authoring tool. It never writes public/data/ and nothing here reaches the site
// bundle; the report goes to out/graph.md, beside the narration pipeline's own output.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ONE_DAY, overlaps, vaguer } from '../../src/data/calendar.ts';
import type { ContentIndex, EventSummary, Precision, Span, StoryDate, When } from '../../src/data/types.ts';
import { buildContent } from './build.ts';

// ---------- what a finding is ----------

export const QUERIES = ['untold-legs', 'missing-link', 'same-place', 'islands', 'dropped-thread'] as const;
export type Query = (typeof QUERIES)[number];

export interface Finding {
  query: Query;
  /** How promising; the report puts the highest first within its query. */
  score: number;
  /** One line: who, where and when. */
  what: string;
  /** The ids the author will want to open. */
  events: string[];
  /** Characters the finding is about. */
  characters: string[];
  /** Further lines of detail, each already a sentence. */
  detail: string[];
  /** What the author might add — a scene, or a link. */
  suggestion: string;
}

// ---------- the windows (said in the report too) ----------

/**
 * How near two of a character's own scenes must be for a missing link to be worth a look,
 * by the vaguer of their two precisions (`vaguer`, as the "likely" rule does it). The
 * windows are wider than `likelyWindow`'s ±3 / ±15 / ±45 days on purpose: that one asks
 * whether two scenes happen *at once*, this one whether one plausibly led to the other —
 * Gandalf's escape from Orthanc and his siege on Weathertop are fifteen days apart, and
 * the first is why the second happened. A year-or-vaguer pair is left out: at that scale
 * nothing can be said about one scene leading to another.
 */
export const CLOSE_DAYS: Partial<Record<Precision, number>> = { day: 30, month: 30, season: 90 };

/** Same place, this near, and nothing said between them: a crossing nobody told. */
export const SAME_PLACE_DAYS = 3;

/** A seam in a life worth a road: at most this many years, or the gap is the story itself. */
export const ISLAND_YEARS = 20;

/** A thread is only "let go" when something led to it, which something else led to in turn. */
export const THREAD_DEPTH = 2;

// ---------- small helpers, pure ----------

type Dated = { when?: When & { endPrecision?: Precision }; span?: Span };

/** Days that certainly passed between two honest ranges: 0 when they overlap or touch. */
export function daysApart(a: Span, b: Span): number {
  const [x, y] = a.from <= b.from ? [a, b] : [b, a];
  return Math.max(0, (y.from - x.to) / ONE_DAY);
}

/** A duration on the axis in words: days while that reads, then years. */
export function spanWords(years: number): string {
  const days = Math.round(years / ONE_DAY);
  if (days <= 0) return 'no certain gap';
  if (days === 1) return '1 day';
  if (days < 400) return `${days} days`;
  const y = Math.round(years);
  return `${y} year${y === 1 ? '' : 's'}`;
}

/** Is there a typed link between these two events, written either way round? */
export function linked(a: EventSummary, b: EventSummary): boolean {
  return a.links.some((l) => l.to === b.id) || b.links.some((l) => l.to === a.id);
}

/** Pairs sort and print in one order, so a pair found through two characters is one finding. */
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

const MONTH = (m: number) => new Date(2000, m - 1, 1).toLocaleString('en', { month: 'short' });

/** Labels only; every bit of date math is in src/data/calendar.ts. */
export function dateWords(d: StoryDate, p: Precision, ageAbbr: Map<string, string>): string {
  const age = ageAbbr.get(d.age) ?? d.age;
  if (p === 'decade') return `${age} ${d.year}–${d.year + 9}`;
  if (p === 'approximate') return `c. ${age} ${d.year}`;
  if (p === 'year') return `${age} ${d.year}`;
  if (p === 'season') return `${d.season ?? ''} ${age} ${d.year}`.trim();
  if (typeof d.day === 'string') return `${d.day} ${age} ${d.year}`;
  const m = d.month ? MONTH(d.month) : '';
  if (p === 'day' && d.day) return `${d.day} ${m} ${age} ${d.year}`;
  return `${m} ${age} ${d.year}`.trim();
}

/** An event's (or a waypoint's) honest date in words. */
export function whenWords(e: Dated, ageAbbr: Map<string, string>): string {
  if (!e.when) return 'outside the dated ages';
  const a = dateWords(e.when.start, e.when.precision, ageAbbr);
  if (!e.when.end) return a;
  return `${a} – ${dateWords(e.when.end, e.when.endPrecision ?? e.when.precision, ageAbbr)}`;
}

/** The names, titles and dates the report says out loud. */
export interface Names {
  event: (id: string) => string;
  character: (id: string) => string;
  place: (id: string | undefined) => string;
  date: (e: Dated) => string;
  /** A journey stop's honest date: a waypoint keeps `date` and `end`, not a `when`. */
  stop: (w: { date: StoryDate; end?: StoryDate; precision: Precision; endPrecision?: Precision }) => string;
}

export function names(index: ContentIndex): Names {
  const ev = new Map(index.events.map((e) => [e.id, e]));
  const ch = new Map(index.characters.map((c) => [c.id, c.name.en]));
  const pl = new Map(index.places.map((p) => [p.id, p.name.en]));
  const abbr = new Map(index.ages.map((a) => [a.id, a.abbr?.en ?? a.name.en]));
  return {
    event: (id) => ev.get(id)?.title.en ?? id,
    character: (id) => ch.get(id) ?? id,
    place: (id) => (id ? pl.get(id) ?? id : 'nowhere named'),
    date: (e) => whenWords(e, abbr),
    stop: (w) => whenWords({ when: { start: w.date, end: w.end, precision: w.precision, endPrecision: w.endPrecision } }, abbr),
  };
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

// ---------- 1. journey legs with no event on them ----------

/**
 * Each consecutive pair of waypoints on a journey where a stop has no scene: a stretch of road
 * somebody walked and nobody watched.
 *
 * The strict form of the question — *neither* end of the leg has a scene — turns out to find
 * almost nothing: the journeys in `content/` are well covered, and only three legs have nothing
 * at either end. So the query reports a leg whenever the stop it *arrives at* has no scene, and
 * says which kind each is: a leg with nothing at either end is a road walked in the dark, and a
 * leg that arrives somewhere untold is a scene missing from a road already being told. A stop
 * with no scene is the previous leg's arrival, so each untold stop is reported once — except
 * the first stop of a journey, which has no leg before it.
 */
export function untoldLegs(index: ContentIndex): Finding[] {
  const N = names(index);
  const out: Finding[] = [];
  for (const j of index.journeys) {
    const told = j.waypoints.filter((w) => w.event).length;
    for (let i = 0; i + 1 < j.waypoints.length; i++) {
      const a = j.waypoints[i], b = j.waypoints[i + 1];
      // Which end is untold: both, the arrival, or (only at the start of a road) the departure.
      const kind = !a.event && !b.event ? 'both' : b.event ? (i === 0 && !a.event ? 'departure' : undefined) : 'arrival';
      if (!kind) continue;
      const gap = b.at - a.at;
      const who = j.characters.map(N.character);
      const sameSpot = a.place === b.place;
      const untold = kind === 'departure' ? a : b;
      out.push({
        query: 'untold-legs',
        score: (kind === 'both' ? 2000 : 0) + (told ? 1000 : 0) + Math.min(Math.round(gap / ONE_DAY), 500) - (sameSpot ? 400 : 0),
        what: `${list(who)}: ${N.place(a.place)} → ${N.place(b.place)}, ${spanWords(gap)}, ` +
          (kind === 'both' ? 'no scene at either end' : `nothing told at ${N.place(untold.place)}`),
        events: [a.event, b.event].filter((x): x is string => !!x),
        characters: j.characters,
        detail: [
          `On "${j.title.en}" (\`${j.id}\`), waypoints ${i + 1} and ${i + 2} of ${j.waypoints.length}.`,
          `${N.place(a.place)}, ${N.stop(a)}${a.event ? ` ("${N.event(a.event)}")` : ' — no scene'} → ${N.place(b.place)}, ${N.stop(b)}${b.event ? ` ("${N.event(b.event)}")` : ' — no scene'}.`,
          told
            ? `${told} of this journey's ${j.waypoints.length} stops already have a scene, so this is a hole in a road being told.`
            : `No stop on this journey has a scene yet, so the whole road is still untold.`,
        ],
        suggestion: sameSpot
          ? `A scene of the stay at ${N.place(a.place)} — what happened there while they waited.`
          : `A scene at ${N.place(untold.place)}, or one on the road between: what ${list(who)} met on the way.`,
      });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

// ---------- 2. a character's own scenes, close in time, with nothing joining them ----------

/**
 * Two scenes a character is in, next to each other in their own story order, close in time,
 * with no typed link and no journey that already draws the road between them. Adjacency in the
 * character's lane is what makes this a candidate rather than noise: the pair is already the
 * two halves of one stretch of their life.
 *
 * Two tightenings, both for signal. **The road must not already be drawn**: if a journey either
 * is on holds the two places as the same stop or as two stops in a row, a reader can see the
 * travel, and a link would only repeat it. (Waypoint-to-scene matching is one scene per stop, so
 * a leg has to be judged by its *places*, not by which scene the build pinned to it.) **And the
 * place must change**: two scenes in one place, next to each other in a life, are consecutive
 * beats of one stretch, and story order already says which comes first — the same reason two
 * scenes sharing a character are never "likely" at once (DESIGN §4.4.1). Without these, 134
 * findings, nearly all of them one journey told scene by scene; with them, a short list.
 *
 * What survives is the shape that went unnoticed for months: Gandalf's escape from Orthanc and
 * his siege on Weathertop, six stops apart on one road, joined by nothing a reader could see.
 */
export function missingLinks(index: ContentIndex): Finding[] {
  const N = names(index);
  const ev = new Map(index.events.map((e) => [e.id, e]));
  const jr = new Map(index.journeys.map((j) => [j.id, j]));
  /** The journey that already draws this road: the two places as one stop, or as two in a row. */
  const roadShown = (a: EventSummary, b: EventSummary): string | undefined => {
    for (const id of a.journeys.filter((x) => b.journeys.includes(x))) {
      const j = jr.get(id);
      if (!j) continue;
      const at = (place: string | undefined) => j.waypoints.flatMap((w, i) => (w.place === place ? [i] : []));
      if (at(a.place).some((i) => at(b.place).some((k) => Math.abs(i - k) <= 1))) return id;
    }
    return undefined;
  };
  const found = new Map<string, { a: EventSummary; b: EventSummary; chars: string[]; days: number }>();
  for (const [c, ids] of Object.entries(index.byCharacter)) {
    for (let i = 0; i + 1 < ids.length; i++) {
      const a = ev.get(ids[i])!, b = ev.get(ids[i + 1])!;
      if (!a.span || !b.span || !a.place || !b.place) continue;
      if (a.place === b.place) continue;
      if (linked(a, b) || roadShown(a, b)) continue;
      const window = CLOSE_DAYS[vaguer(a.when?.precision, b.when?.precision) ?? 'year'];
      if (window === undefined) continue;
      const days = daysApart(a.span, b.span);
      if (days > window) continue;
      const key = pairKey(a.id, b.id);
      const hit = found.get(key);
      if (hit) hit.chars.push(c);
      else found.set(key, { a, b, chars: [c], days });
    }
  }
  const out: Finding[] = [];
  for (const { a, b, chars, days } of found.values()) {
    const window = CLOSE_DAYS[vaguer(a.when?.precision, b.when?.precision) ?? 'year']!;
    const shared = a.journeys.filter((j) => b.journeys.includes(j));
    out.push({
      query: 'missing-link',
      // The wider the gap inside the window, the more road went unshown, so it ranks higher.
      score: Math.round((days / window) * 10) + Math.min(chars.length, 4) + (shared.length ? 3 : 0),
      what: `${list(chars.map(N.character))}: "${a.title.en}" → "${b.title.en}", ${days < 1 ? 'the same days' : `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'} apart`}, unjoined`,
      events: [a.id, b.id],
      characters: chars,
      detail: [
        `\`${a.id}\` — ${N.place(a.place)}, ${N.date(a)}.`,
        `\`${b.id}\` — ${N.place(b.place)}, ${N.date(b)}.`,
        shared.length
          ? `They share the journey "${shared.map((j) => jr.get(j)?.title.en ?? j).join('", "')}", but ${N.place(a.place)} and ${N.place(b.place)} are not two stops in a row on it, so the road between them is not drawn — and no typed link stands in for it.`
          : `Nothing joins them: no link, and no journey covers both.`,
      ],
      suggestion: `An \`enabled-by\` from "${b.title.en}" to "${a.title.en}" if the first is why they were at ${N.place(b.place)}, \`concurrent\` if they run side by side — or a scene of the road between.`,
    });
  }
  return out.sort((x, y) => y.score - x.score);
}

// ---------- 3. two parties, one place, days apart, nothing said ----------

/**
 * Two scenes in the same place within a few days, with no typed link. Pairs that share a
 * character belong to query 2, so they are left out here; what is left is the interesting
 * shape — two separate threads of the story passing through one place almost at once, and
 * neither scene knowing about the other. Year-or-vaguer dates are left out: "the same place
 * some time this century" says nothing.
 */
export function samePlaceUnlinked(index: ContentIndex): Finding[] {
  const N = names(index);
  const ev = new Map(index.events.map((e) => [e.id, e]));
  const fine = (p: Precision | undefined) => p === 'day' || p === 'month' || p === 'season';
  const out: Finding[] = [];
  for (const [place, ids] of Object.entries(index.byPlace)) {
    for (let i = 0; i < ids.length; i++) {
      for (let k = i + 1; k < ids.length; k++) {
        const a = ev.get(ids[i])!, b = ev.get(ids[k])!;
        if (!a.span || !b.span || !fine(a.when?.precision) || !fine(b.when?.precision)) continue;
        if (a.characters.some((c) => b.characters.includes(c))) continue;
        if (linked(a, b)) continue;
        const days = daysApart(a.span, b.span);
        if (days > SAME_PLACE_DAYS) continue;
        const at_once = overlaps(a.span, b.span);
        out.push({
          query: 'same-place',
          score: (SAME_PLACE_DAYS - days) + (at_once ? 2 : 0),
          what: `${N.place(place)}: "${a.title.en}" and "${b.title.en}", ${at_once ? 'at once' : `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'} apart`}, with nothing said between them`,
          events: [a.id, b.id],
          characters: [...new Set([...a.characters, ...b.characters])],
          detail: [
            `\`${a.id}\` — ${N.date(a)}, with ${list(a.characters.map(N.character)) || 'nobody named'}.`,
            `\`${b.id}\` — ${N.date(b)}, with ${list(b.characters.map(N.character)) || 'nobody named'}.`,
            `No character in common, so neither scene can know of the other unless a link says so.`,
          ],
          suggestion: `\`concurrent\` if they happen side by side at ${N.place(place)}, \`crossing\` if the two parties meet, or \`caused-by\` if one is why the other happened.`,
        });
      }
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

// ---------- 4. islands in one life ----------

/**
 * A character's own events, joined by typed links and by the journeys they share, fall into
 * separate islands: we never show how they got from there to here.
 *
 * Reported once per character, not once per seam. Melkor alone has 26 scenes in 17 islands, and
 * a list of his sixteen seams is a list of one job; what the author wants to read is "Melkor's
 * life is in pieces, and here are the narrowest places to join it". Only lives the content
 * already tells are reported (three scenes or more), and only where at least one seam is a road
 * somebody could walk: the place changes and at most `ISLAND_YEARS` years passed. Seams narrow
 * enough for query 2 are left to it.
 */
export function islands(index: ContentIndex, covered = new Set<string>()): Finding[] {
  const N = names(index);
  const ev = new Map(index.events.map((e) => [e.id, e]));
  const out: Finding[] = [];
  for (const [c, ids] of Object.entries(index.byCharacter)) {
    if (ids.length < 3) continue;
    // Union-find over this character's scenes: a typed link or a shared journey joins two.
    const root = new Map(ids.map((id) => [id, id]));
    const find = (x: string): string => (root.get(x) === x ? x : (root.set(x, find(root.get(x)!)), root.get(x)!));
    const join = (x: string, y: string) => root.set(find(x), find(y));
    for (let i = 0; i < ids.length; i++) {
      for (let k = i + 1; k < ids.length; k++) {
        const a = ev.get(ids[i])!, b = ev.get(ids[k])!;
        if (linked(a, b) || a.journeys.some((j) => b.journeys.includes(j))) join(a.id, b.id);
      }
    }
    const parts = new Set(ids.map(find));
    if (parts.size < 2) continue;
    // The seams: story-order neighbours on different islands, where a road could be shown.
    const seams: { a: EventSummary; b: EventSummary; years: number }[] = [];
    for (let i = 0; i + 1 < ids.length; i++) {
      const a = ev.get(ids[i])!, b = ev.get(ids[i + 1])!;
      if (find(a.id) === find(b.id)) continue;
      if (covered.has(pairKey(a.id, b.id))) continue;
      if (!a.span || !b.span || !a.place || !b.place || a.place === b.place) continue;
      const years = Math.max(0, b.span.from - a.span.to);
      if (years > ISLAND_YEARS) continue;
      seams.push({ a, b, years });
    }
    if (!seams.length) continue;
    seams.sort((x, y) => x.years - y.years);
    const first = seams[0];
    out.push({
      query: 'islands',
      score: parts.size * 2 + seams.length,
      what: `${N.character(c)}: ${ids.length} scenes in ${parts.size} islands, ${seams.length} of them a road away`,
      events: seams.flatMap((x) => [x.a.id, x.b.id]).slice(0, 6),
      characters: [c],
      detail: [
        `Nothing — no link, no shared journey — joins ${N.character(c)}'s scenes across ${parts.size - 1} break${parts.size > 2 ? 's' : ''}.`,
        ...seams.slice(0, 3).map((x) =>
          `${N.place(x.a.place)} (\`${x.a.id}\`, ${N.date(x.a)}) → ${N.place(x.b.place)} (\`${x.b.id}\`, ${N.date(x.b)}): ${spanWords(x.years)}.`),
        seams.length > 3 ? `…and ${seams.length - 3} further seam${seams.length > 4 ? 's' : ''} of the same kind.` : '',
      ].filter(Boolean),
      suggestion: `A journey for ${N.character(c)} from ${N.place(first.a.place)} to ${N.place(first.b.place)}, or a link saying what carried them there — then the next seam.`,
    });
  }
  return out.sort((x, y) => y.score - x.score);
}

// ---------- 5. threads let go ----------

/**
 * A chain of cause — A enables B enables C — whose last scene has no consequence told. The
 * chain must be at least `THREAD_DEPTH` long, so a one-off cause is not mistaken for a thread,
 * and the end of the chronicle is allowed to end: nothing in a foretold age is reported, since
 * prophecy is the last word by construction.
 */
export function droppedThreads(index: ContentIndex, foretoldAges = new Set<string>()): Finding[] {
  const N = names(index);
  const ev = new Map(index.events.map((e) => [e.id, e]));
  const causes = new Map<string, string[]>();   // event → what it leads to
  const causedBy = new Map<string, string[]>(); // event → what led to it
  for (const e of index.events) {
    for (const l of e.links) {
      if (l.type !== 'caused-by' && l.type !== 'enabled-by') continue;
      if (!ev.has(l.to)) continue;
      causes.set(l.to, [...(causes.get(l.to) ?? []), e.id]);
      causedBy.set(e.id, [...(causedBy.get(e.id) ?? []), l.to]);
    }
  }
  /** Longest chain of cause ending here, and one such chain, following the earliest branch. */
  const chains = new Map<string, string[]>();
  const chain = (id: string, seen: Set<string>): string[] => {
    const had = chains.get(id);
    if (had) return had;
    if (seen.has(id)) return [id];
    seen.add(id);
    let best: string[] = [id];
    for (const up of causedBy.get(id) ?? []) {
      const c = [...chain(up, seen), id];
      if (c.length > best.length) best = c;
    }
    seen.delete(id);
    chains.set(id, best);
    return best;
  };
  /** The next scene with one of the same people in it: a consequence that may only want a link. */
  const later = (e: EventSummary): EventSummary | undefined => {
    if (!e.span) return undefined;
    return index.events
      .filter((x) => x.span && x.id !== e.id && x.span.from >= e.span!.to && x.characters.some((c) => e.characters.includes(c)))
      .sort((a, b) => a.span!.from - b.span!.from)[0];
  };
  const out: Finding[] = [];
  for (const e of index.events) {
    if (foretoldAges.has(e.age)) continue;
    if (causes.get(e.id)?.length) continue;
    const c = chain(e.id, new Set());
    if (c.length <= THREAD_DEPTH) continue;
    const next = later(e);
    out.push({
      query: 'dropped-thread',
      // Depth says it is a thread; a later scene with the same people says the consequence may
      // already be told and only wants a link, which is the cheaper and likelier fix.
      score: Math.min(c.length, 10) + (next ? 6 : 0) + c.length / 100,
      what: `"${e.title.en}" ends a chain of ${c.length} with no consequence told`,
      events: c,
      characters: e.characters,
      detail: [
        c.map((id) => `"${ev.get(id)!.title.en}"`).join(' → ') + '.',
        `\`${e.id}\` — ${N.place(e.place)}, ${N.date(e)}, with ${list(e.characters.map(N.character)) || 'nobody named'}.`,
        `It is caused or enabled by ${list((causedBy.get(e.id) ?? []).map((id) => `"${ev.get(id)!.title.en}"`))}, and nothing is caused or enabled by it.`,
        next
          ? `The next scene with any of these people is "${next.title.en}" (\`${next.id}\`, ${N.date(next)}), so the consequence may already be told and only want a link.`
          : `No later scene has any of these people in it, so what came of it may not be told at all yet.`,
      ],
      suggestion: next
        ? `A \`causes\` or \`enables\` link from "${e.title.en}" to "${next.title.en}", if that is what came of it.`
        : `The scene that came of "${e.title.en}" — nothing later in the content follows these people.`,
    });
  }
  return out.sort((x, y) => y.score - x.score);
}

// ---------- the whole report ----------

export interface Section {
  query: Query;
  title: string;
  blurb: string;
  /** The window or rule this query used, in the author's words. */
  window: string;
  findings: Finding[];
  /** How many of them the report prints. */
  show: number;
}

/** Every query, in the order the report tells them: the richest vein first. */
export function report(index: ContentIndex): Section[] {
  const foretold = new Set(index.ages.filter((a) => a.foretold).map((a) => a.id));
  const links = missingLinks(index);
  const covered = new Set(links.map((f) => pairKey(f.events[0], f.events[1])));
  return [
    {
      query: 'untold-legs', title: 'Roads walked with nothing on them', show: 30,
      blurb: 'A journey already says who travelled, from where to where, and when. Where a stop on it has no scene, somebody walked that road and nobody watched.',
      window: 'Every consecutive pair of waypoints where a stop has no scene matched to it. Legs with nothing at **either** end come first — there are only three, because the journeys are well covered — then legs that arrive somewhere untold, roads already part told before untouched ones, and the longest stretch before the shortest.',
      findings: untoldLegs(index),
    },
    {
      query: 'missing-link', title: 'Two scenes of one life, and nothing between them', show: 20,
      blurb: 'Scenes next to each other in a character\'s own story, close enough in time that one may be why the other happened — and joined by nothing a reader can see.',
      window: `Honest ranges, not raw dates: at most ${CLOSE_DAYS.day} days apart for day- or month-dated scenes, ${CLOSE_DAYS.season} for season-dated ones (the vaguer of the two decides, as the "likely" rule does it), and never for a year or vaguer. Left out: pairs in the same place (consecutive beats of one stretch, where story order already says which came first) and pairs whose two places are the same stop or two stops in a row on a journey both are on (the road is drawn already). The wider the gap inside the window, the more road went unshown, so those come first.`,
      findings: links,
    },
    {
      query: 'same-place', title: 'Two parties in one place, and neither knows', show: 20,
      blurb: 'The same place within days, by different people, with no link between them. Either they crossed, or they just missed each other — and both are worth telling.',
      window: `Honest ranges at most ${SAME_PLACE_DAYS} days apart, both dated to a season or finer, no character in common (a shared character is the query above), and no typed link.`,
      findings: samePlaceUnlinked(index),
    },
    {
      query: 'islands', title: 'Lives in pieces', show: 20,
      blurb: 'A character\'s scenes, joined by links and by the journeys they share, fall into islands. We never show how they got from there to here.',
      window: `One finding per character, not per seam. Characters with three scenes or more whose scenes fall into two islands or more, counting a typed link or a shared journey as a join; the seams named are story-order neighbours on different islands where the place changes and at most ${ISLAND_YEARS} years passed. Seams narrow enough for the query above are left to it.`,
      findings: islands(index, covered),
    },
    {
      query: 'dropped-thread', title: 'Threads let go', show: 20,
      blurb: 'A chain of cause that runs and then stops: something led to this scene, and something led to that, and then nothing came of it.',
      window: `Chains of \`caused-by\` / \`enabled-by\` longer than ${THREAD_DEPTH}, ending on a scene with no \`causes\` / \`enables\` of its own. A scene with a later scene of its own people comes first, since the consequence is probably told already and only wants a link. What is foretold is left out: prophecy is the last word by construction.`,
      findings: droppedThreads(index, foretold),
    },
  ];
}

/** The report as markdown, for out/graph.md. */
export function markdown(index: ContentIndex, sections: Section[], when = new Date()): string {
  const L: string[] = [];
  const total = sections.reduce((n, s) => n + s.findings.length, 0);
  L.push('# Stories not yet told');
  L.push('');
  L.push(`Written by \`npm run graph\` on ${when.toISOString().slice(0, 10)} from \`content/\`: ` +
    `${index.events.length} events, ${index.characters.length} characters, ${index.places.length} places, ${index.journeys.length} journeys. ` +
    `${total} findings in five queries.`);
  L.push('');
  L.push('None of these is a mistake. Each is a place where the content knows more than it says — a road, a meeting, a consequence — and where a scene or a link would let a reader see it. Open the ones that sound like a story.');
  L.push('');
  L.push('| Query | Found | Shown |');
  L.push('|---|--:|--:|');
  for (const s of sections) L.push(`| [${s.title}](#${slug(s.title)}) | ${s.findings.length} | ${Math.min(s.show, s.findings.length)} |`);
  L.push('');
  for (const s of sections) {
    L.push(`## ${s.title}`);
    L.push('');
    L.push(s.blurb);
    L.push('');
    L.push(`*How they were found.* ${s.window}`);
    L.push('');
    if (!s.findings.length) { L.push('Nothing found — nothing to tell here that the content does not already say.'); L.push(''); continue; }
    s.findings.slice(0, s.show).forEach((f, i) => {
      L.push(`### ${i + 1}. ${f.what}`);
      L.push('');
      for (const d of f.detail) L.push(`- ${d}`);
      L.push(`- **Might be told as:** ${f.suggestion}`);
      L.push('');
    });
    if (s.findings.length > s.show) {
      L.push(`*…and ${s.findings.length - s.show} more of these, in the same order.*`);
      L.push('');
    }
  }
  L.push('---');
  L.push('');
  L.push('Ardatir is a non-commercial fan project. Everything here is our own paraphrase of what the content already holds.');
  L.push('');
  return L.join('\n');
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/ +/g, '-');

/** The terminal summary: counts per query, and where the full report went. */
export function summary(sections: Section[], out: string): string {
  const w = Math.max(...sections.map((s) => s.title.length));
  const lines = sections.map((s) => `  ${s.title.padEnd(w)}  ${String(s.findings.length).padStart(4)}`);
  const total = sections.reduce((n, s) => n + s.findings.length, 0);
  return [...lines, '', `  ${total} ${total === 1 ? 'story' : 'stories'} not yet told → ${out}`].join('\n');
}

// ---------- the CLI ----------

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(import.meta.dirname, '../..');
  const built = buildContent(path.join(root, 'content'));
  for (const e of built.errors) console.error(`  ERROR    ${e}`);
  if (built.errors.length) {
    console.error(`\n✗ ${built.errors.length} content error(s); run npm run content first.`);
    process.exit(1);
  }
  const sections = report(built.index);
  const ix = built.index;
  console.log(`graph: ${ix.events.length} events, ${ix.characters.length} characters, ${ix.places.length} places, ${ix.journeys.length} journeys\n`);
  const out = path.join(root, 'out', 'graph.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, markdown(built.index, sections));
  console.log(summary(sections, path.relative(root, out)));
}
