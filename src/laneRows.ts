// Character lanes as rows (docs/DESIGN.md §3.2): the chosen lives merged into one story
// order, with age headings and the years between. Pure data, no DOM, so it can be tested;
// lanes.ts draws it.

import { yearsBetween } from './data/calendar';
import type { Age, ContentIndex, EventSummary, Journey, Span, Waypoint } from './data/types';
import { fold } from './dom';

/**
 * How well a name matches what was typed (both folded): 0 the whole name, 1 its start,
 * 2 the start of a later word ("oak" → "Thorin Oakenshield"), 3 anywhere; -1 not at all.
 * So "Ara" finds Aragorn before Ar-Pharazôn.
 */
export function matchRank(name: string, query: string): number {
  const n = fold(name), q = fold(query.trim());
  if (!q || !n.includes(q)) return -1;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(/[\s'’-]+/).some((w) => w.startsWith(q))) return 2;
  return 3;
}

/**
 * Short, distinct initials for lane heads: one letter, or two (of the first word, else first
 * and next word) for names whose first letter another lane shares — Gollum "Go", Gimli "Gi".
 */
export function laneInitials(names: string[]): string[] {
  const one = names.map((n) => [...n][0]?.toUpperCase() ?? '?');
  return names.map((n, i) => {
    if (one.filter((x) => x === one[i]).length === 1) return one[i];
    const letters = [...n.replace(/[^\p{L}]/gu, '')];
    const two = (letters[0] ?? '').toUpperCase() + (letters[1] ?? '').toLowerCase();
    const clash = names.some((m, k) => k !== i && [...m.replace(/[^\p{L}]/gu, '')].slice(0, 2).join('').toLowerCase() === two.toLowerCase());
    if (!clash) return two;
    const words = n.split(/\s+/);
    return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : two;
  });
}

export type Row =
  | { kind: 'event'; event: EventSummary; lanes: number[] }
  | { kind: 'leg'; journey: Journey; waypoint: Waypoint; lanes: number[] }
  | { kind: 'age'; age: Age; lanes: number[] }
  /** "At least N years later", counted in the age's own years (Valian years in the Years of the Trees). */
  | { kind: 'gap'; years: number; age: Age; lanes: number[] };

type LegRow = Row & { kind: 'leg' };
type EventRow = Row & { kind: 'event' };

/**
 * Merge the chosen lanes into rows, in story order. Events keep the index's order (story
 * order). A journey leg goes between the events of its own lane it falls between, and there
 * after every event of any chosen lane whose best guess (`at`) is no later than the leg's,
 * so with several lanes a leg never lands before another lane's earlier event. Legs shared by
 * several lanes (the same place and range) are one row.
 */
export function buildRows(ix: Pick<ContentIndex, 'events' | 'journeys' | 'lanes' | 'ages'>, ids: string[]): Row[] {
  const order = new Map(ix.events.map((e, i) => [e.id, i]));
  const byId = new Map(ix.events.map((e) => [e.id, e]));
  const events = new Map<string, EventRow>();
  const legs = new Map<string, LegRow>();
  /** For each leg, the story-order bounds from the lane that first brought it: its previous and next event. */
  const bounds = new Map<LegRow, { prev?: number; next?: number }>();

  ids.forEach((c, li) => {
    const lane = ix.lanes[c] ?? [];
    let prev: number | undefined;
    const waiting: LegRow[] = []; // legs of this lane still waiting for the event after them
    for (const entry of lane) {
      if ('event' in entry) {
        const e = byId.get(entry.event);
        if (!e) continue;
        let row = events.get(e.id);
        if (!row) { row = { kind: 'event', event: e, lanes: [] }; events.set(e.id, row); }
        row.lanes.push(li);
        prev = order.get(e.id)!;
        for (const l of waiting.splice(0)) bounds.get(l)!.next = prev;
        continue;
      }
      const j = ix.journeys.find((x) => x.id === entry.journey);
      const w = j?.waypoints[entry.waypoint];
      if (!j || !w) continue;
      const key = `${w.place}|${w.span.from.toFixed(5)}|${w.span.to.toFixed(5)}`;
      let row = legs.get(key);
      if (!row) {
        row = { kind: 'leg', journey: j, waypoint: w, lanes: [] };
        legs.set(key, row);
        bounds.set(row, { prev });
        waiting.push(row);
      }
      if (!row.lanes.includes(li)) row.lanes.push(li);
    }
  });

  // Sort keys: [the event (by story order) the row follows, 0 before it / 1 itself / 2 after it, at].
  const keys = new Map<Row, [number, number, number]>();
  for (const r of events.values()) keys.set(r, [order.get(r.event.id)!, 1, 0]);
  for (const [l, { prev, next }] of bounds) {
    const at = l.waypoint.at;
    // The last event of any lane between the leg's own neighbours and guessed no later than it.
    let base: number | undefined;
    for (const r of events.values()) {
      const o = order.get(r.event.id)!;
      if (prev !== undefined && o < prev) continue;
      if (next !== undefined && o >= next) continue;
      if (r.event.at === undefined || r.event.at > at) continue;
      base = base === undefined ? o : Math.max(base, o);
    }
    if (base !== undefined) keys.set(l, [base, 2, at]);
    else if (prev !== undefined) keys.set(l, [prev, 2, at]);
    else if (next !== undefined) keys.set(l, [next, 0, at]); // before its lane's first event
    else keys.set(l, [-1, 2, at]); // nothing earlier: first
  }

  const sorted = [...events.values(), ...legs.values()].sort((a, b) => {
    const x = keys.get(a)!, y = keys.get(b)!;
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });

  // Ages and the years between: an age heading when the age changes, and a quiet
  // "at least N years later" when the honest ranges are a year or more apart.
  const rows: Row[] = [];
  let age: Age | undefined, span: Span | undefined;
  for (const r of sorted) {
    const a = r.kind === 'event' ? r.event.age : r.kind === 'leg' ? r.waypoint.date.age : undefined;
    const s = r.kind === 'event' ? r.event.span : r.kind === 'leg' ? r.waypoint.span : undefined;
    if (a && a !== age?.id) {
      const ageObj = ix.ages.find((x) => x.id === a);
      if (ageObj) { rows.push({ kind: 'age', age: ageObj, lanes: [] }); age = ageObj; }
    } else if (age && span && s) {
      const n = yearsBetween(span, s, age);
      if (n >= 1) rows.push({ kind: 'gap', years: n, age, lanes: [] });
    }
    rows.push(r);
    if (s) span = span && span.to > s.to ? span : s;
  }
  return rows;
}
