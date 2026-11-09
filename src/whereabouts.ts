// Where everyone is at a moment, from the journeys (docs/DESIGN.md §3.1, §4.6). Honest first:
// a stop whose honest range covers the moment is a place they may be at; when several do, or
// none does but they are between two, they are "somewhere between" them. When the moment is
// narrower than that, the best guesses (`at`) add which stop was likely last reached, labelled
// as our guess. Journeys with the same answer are one group (the dwarves and Bilbo at
// Rivendell), so the list reads by company, not by character. Pure: no DOM, tested.

import { EPS, overlaps, within } from './data/calendar';
import type { Character, EventSummary, Journey, Span, Waypoint } from './data/types';

export interface Where {
  /** `at`: one stop covers the moment. `between`: they are somewhere between the first and last of `stops`. */
  kind: 'at' | 'between';
  /** `at`: the stop. `between`: the first stop, any in between (each possible), and the last. */
  stops: Waypoint[];
  /**
   * Our best guess, for `between` when asked: the last stop reached by the guesses and the
   * next one; `atStop` when the guess puts them at `reached` during the moment.
   */
  guess?: { reached: Waypoint; next?: Waypoint; atStop: boolean };
}

export interface WhereGroup {
  journeys: Journey[];
  /** Everyone on those journeys, in journey order, each once. */
  characters: string[];
  where: Where;
}

/** Drop a stop that repeats the place before it (a stay written as two waypoints). */
function distinctPlaces(ws: Waypoint[]): Waypoint[] {
  return ws.filter((w, i) => i === 0 || ws[i - 1].place !== w.place);
}

/** Where one journey's company is during a moment; undefined when the journey hasn't begun or is over. */
export function whereOnJourney(j: Journey, m: Span, withGuess = false): Where | undefined {
  const ws = j.waypoints;
  const cover = ws.map((w, i) => (overlaps(w.span, m) ? i : -1)).filter((i) => i >= 0);
  let lo: number, hi: number;
  if (cover.length) { lo = cover[0]; hi = cover[cover.length - 1]; }
  else {
    // Between two stops: the last one certainly over, and the first one certainly not begun
    // (touching the moment counts as outside it: EPS, see calendar.ts).
    lo = -1;
    ws.forEach((w, i) => { if (w.span.to <= m.from + EPS) lo = i; });
    hi = ws.findIndex((w, i) => i > lo && w.span.from >= m.to - EPS);
    if (lo < 0 || hi < 0) return undefined;
  }
  const stops = distinctPlaces(ws.slice(lo, hi + 1));
  if (!cover.length && stops.length > 1) stops.splice(1, stops.length - 2); // none in between covers the moment
  if (stops.length === 1) return { kind: 'at', stops };
  const where: Where = { kind: 'between', stops };
  if (withGuess) {
    const x = (m.from + m.to) / 2;
    const range = ws.slice(lo, hi + 1);
    let r = -1;
    range.forEach((w, i) => { if (w.at <= x) r = i; });
    if (r >= 0) {
      const reached = range[r];
      const next = range.slice(r + 1).find((w) => w.place !== reached.place);
      const atStop = !next || within(reached.at, m);
      where.guess = { reached, next: atStop ? undefined : next, atStop };
    }
  }
  return where;
}

const whereKey = (w: Where) => [
  w.kind, ...w.stops.map((s) => s.place),
  w.guess ? `guess:${w.guess.reached.place}>${w.guess.next?.place ?? ''}:${w.guess.atStop}` : '',
].join('|');

/**
 * Everyone's whereabouts during a moment, by company: journeys under way, grouped where
 * their answer is the same. Largest companies first. `withGuess` adds best guesses (for a
 * moment of a day or a month; a whole year is too wide for a guess to say anything).
 * Each character is listed once: on a handoff day (one journey ends where the next begins,
 * Gandalf leaving the hobbits on 30 Oct 3019) the journey that is starting wins, the one
 * that begins latest. A journey left with no one of its own is dropped.
 */
export function whereabouts(journeys: Journey[], m: Span, withGuess = false): WhereGroup[] {
  const under = journeys.map((j) => ({ j, where: whereOnJourney(j, m, withGuess) })).filter((x): x is { j: Journey; where: Where } => !!x.where);
  const start = (j: Journey) => j.span?.from ?? j.waypoints[0]?.span.from ?? -Infinity;
  const owner = new Map<string, Journey>();
  for (const { j } of under) for (const c of j.characters) {
    const o = owner.get(c);
    if (!o || start(j) > start(o)) owner.set(c, j);
  }
  const groups = new Map<string, WhereGroup>();
  for (const { j, where } of under) {
    const mine = j.characters.filter((c) => owner.get(c) === j);
    if (!mine.length) continue;
    const k = whereKey(where);
    const g = groups.get(k);
    if (g) {
      g.journeys.push(j);
      for (const c of mine) if (!g.characters.includes(c)) g.characters.push(c);
    } else groups.set(k, { journeys: [j], characters: mine, where });
  }
  return [...groups.values()].sort((a, b) => b.characters.length - a.characters.length);
}

export interface HomeGroup {
  /** The place they stay in (`home` on the character). */
  place: string;
  characters: string[];
}

/**
 * Characters who don't travel (`home`, e.g. Tom Bombadil in the Old Forest): at home during
 * a moment when no journey of theirs says where they are, but only within the span of their
 * events (from the start of the first to the end of the last honest range): outside it the
 * sources say nothing of them. Grouped by place. `placed` are the characters some journey
 * already places at this moment. A journey that comes to visit them (one of their events is on
 * it) extends that span through its stops at their home: Gandalf's stay with Tom in November
 * 3019 keeps Tom at home after his last event.
 */
export function atHome(
  characters: Pick<Character, 'id' | 'home'>[], events: (Pick<EventSummary, 'span' | 'characters'> & { journeys?: string[] })[], m: Span, placed: Set<string>,
  journeys: Pick<Journey, 'id' | 'waypoints'>[] = [],
): HomeGroup[] {
  const out = new Map<string, HomeGroup>();
  for (const c of characters) {
    if (!c.home || placed.has(c.id)) continue;
    let from = Infinity, to = -Infinity;
    const visits = new Set<string>();
    for (const e of events) if (e.characters.includes(c.id)) {
      if (e.span) { from = Math.min(from, e.span.from); to = Math.max(to, e.span.to); }
      for (const j of e.journeys ?? []) visits.add(j);
    }
    for (const j of journeys) if (visits.has(j.id)) for (const w of j.waypoints) {
      if (w.place === c.home && w.span) { from = Math.min(from, w.span.from); to = Math.max(to, w.span.to); }
    }
    if (!(from < to) || !overlaps({ from, to }, m)) continue;
    const g = out.get(c.home);
    if (g) g.characters.push(c.id); else out.set(c.home, { place: c.home, characters: [c.id] });
  }
  return [...out.values()];
}
