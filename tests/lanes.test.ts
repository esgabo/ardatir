// Character lanes as rows (src/laneRows.ts): story order, journey legs between events, gaps.

import { describe, expect, it } from 'vitest';
import { buildRows, laneInitials, matchRank, type Row } from '../src/laneRows.ts';
import type { Age, EventSummary, Journey, LaneEntry, Waypoint } from '../src/data/types.ts';

const ta: Age = { id: 'third-age', order: 5, name: { en: 'Third Age' }, summary: { en: '' }, axis: { start: 0, yearLength: 1 } };
const trees: Age = { id: 'years-of-the-trees', order: 3, name: { en: 'Trees' }, summary: { en: '' }, axis: { start: -1000, yearLength: 10 } };

function ev(id: string, at: number, characters: string[], age = 'third-age'): EventSummary {
  return {
    id, age, at, span: { from: at, to: at + 0.01 }, characters, arcs: [], journeys: [], tags: [], status: 'outline',
    title: { en: id }, summary: { en: id }, links: [], audio: [],
  };
}
function wp(place: string, at: number): Waypoint {
  return { place, date: { age: 'third-age', year: 1 }, precision: 'year', span: { from: at, to: at + 0.01 }, at };
}
const label = (r: Row) => (r.kind === 'event' ? r.event.id : r.kind === 'leg' ? `leg:${r.waypoint.place}` : r.kind);
const story = (rows: Row[]) => rows.filter((r) => r.kind === 'event' || r.kind === 'leg').map(label);

describe('buildRows', () => {
  // Story order: e1, e2, e3, e4. Lane a (Gollum): e1, then legs at 4 and 0.5-before-e4, then e4.
  // Lane b (Frodo): e2, e3 (at 2 and 3), with a leg at 1.5 before its first event.
  const events = [ev('e1', 1, ['a']), ev('e2', 2, ['b']), ev('e3', 3, ['b']), ev('e4', 5, ['a'])];
  const journeys: Journey[] = [
    { id: 'ja', title: { en: 'ja' }, characters: ['a'], waypoints: [wp('emyn-muil', 4)], events: [] },
    { id: 'jb', title: { en: 'jb' }, characters: ['b'], waypoints: [wp('bree', 1.5)], events: [] },
  ];
  const lanes: Record<string, LaneEntry[]> = {
    a: [{ event: 'e1' }, { journey: 'ja', waypoint: 0 }, { event: 'e4' }],
    b: [{ journey: 'jb', waypoint: 0 }, { event: 'e2' }, { event: 'e3' }],
  };
  const ix = { events, journeys, lanes, ages: [ta] };

  it("puts a leg after every chosen lane's events guessed no later, not just its own lane's", () => {
    // Before the fix the Emyn Muil leg followed e1 (its own lane's previous event), ahead of e2 and e3.
    expect(story(buildRows(ix, ['a', 'b']))).toEqual(['e1', 'leg:bree', 'e2', 'e3', 'leg:emyn-muil', 'e4']);
  });

  it("keeps a leg before its own lane's next event, and the order is the same whichever lane comes first", () => {
    expect(story(buildRows(ix, ['b', 'a']))).toEqual(['e1', 'leg:bree', 'e2', 'e3', 'leg:emyn-muil', 'e4']);
  });

  it('with one lane, legs sit between that lane\'s events', () => {
    expect(story(buildRows(ix, ['a']))).toEqual(['e1', 'leg:emyn-muil', 'e4']);
    expect(story(buildRows(ix, ['b']))).toEqual(['leg:bree', 'e2', 'e3']);
  });

  it('counts the years between in the age\'s own years', () => {
    const a = ev('t1', -1000, ['x'], 'years-of-the-trees'), b = ev('t2', -1000 + 750, ['x'], 'years-of-the-trees');
    const rows = buildRows({ events: [a, b], journeys: [], lanes: { x: [{ event: 't1' }, { event: 't2' }] }, ages: [trees] }, ['x']);
    const gap = rows.find((r) => r.kind === 'gap');
    expect(gap && gap.kind === 'gap' && gap.years).toBe(74); // 749.99 years of the Sun ≈ 74 Valian years, not 749
  });
});

describe('matchRank', () => {
  it('ranks the whole name, then its start, then a word start, then anywhere', () => {
    expect(matchRank('Aragorn', 'aragorn')).toBe(0);
    expect(matchRank('Aragorn', 'Ara')).toBe(1);
    expect(matchRank('Thorin Oakenshield', 'oak')).toBe(2);
    expect(matchRank('Ar-Pharazôn', 'ara')).toBe(3);
    expect(matchRank('Túrin', 'tur')).toBe(1); // accents folded
    expect(matchRank('Bilbo', 'xyz')).toBe(-1);
  });
});

describe('laneInitials', () => {
  it('uses one letter, or two when lanes would share one', () => {
    expect(laneInitials(['Frodo', 'Sam', 'Gollum'])).toEqual(['F', 'S', 'G']);
    expect(laneInitials(['Gollum', 'Gimli', 'Aragorn'])).toEqual(['Go', 'Gi', 'A']);
  });
});
