// Best-guess moments: estimatePositions (events) and estimateWaypoints (journeys).

import { describe, expect, it } from 'vitest';
import { estimatePositions, estimateWaypoints } from '../scripts/content/build.ts';
import type { EventLink, EventSummary, Journey, Span, Waypoint } from '../src/data/types.ts';

const DAY = 1 / 366;
const YEAR = 100; // a year starting at axis 100, for readability
const day = (n: number): Span => ({ from: YEAR + n * DAY, to: YEAR + (n + 1) * DAY });
const summer: Span = { from: YEAR + 0.41, to: YEAR + 0.67 };
const wholeYear: Span = { from: YEAR, to: YEAR + 1 };

function ev(id: string, span: Span | undefined, characters: string[], extra: Partial<EventSummary> = {}): EventSummary {
  return {
    id, age: 'third-age', ...span ? { span } : {}, characters, arcs: [], journeys: [], tags: [], status: 'outline',
    title: { en: id }, summary: { en: id }, links: [], audio: [], ...extra,
  };
}
const link = (to: string, type: EventLink['type']): EventLink => ({ to, type });
const inside = (e: { at?: number; span?: Span }) => {
  expect(e.at).toBeGreaterThanOrEqual(e.span!.from);
  expect(e.at).toBeLessThanOrEqual(e.span!.to);
};

describe('estimatePositions', () => {
  it('puts exact-dated anchors at their middle', () => {
    const a = ev('a', day(10), ['bilbo']);
    estimatePositions([a]);
    expect(a.at).toBeCloseTo((a.span!.from + a.span!.to) / 2);
  });

  it('spaces events sharing a window evenly, in story order, inside their range', () => {
    const es = [1, 2, 3, 4, 5, 6].map((i) => ev(`s${i}`, summer, ['bilbo']));
    estimatePositions(es);
    for (const e of es) inside(e);
    for (let i = 1; i < es.length; i++) expect(es[i].at!).toBeGreaterThan(es[i - 1].at!);
    const gaps = es.slice(1).map((e, i) => e.at! - es[i].at!);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]);
  });

  it('narrows a vague event between the anchors around it in its lane', () => {
    const before = ev('before', day(160), ['bilbo']);
    const vague = ev('vague', summer, ['bilbo']);
    const after = ev('after', day(200), ['bilbo']);
    estimatePositions([before, vague, after]);
    expect(vague.at!).toBeGreaterThan(before.at!);
    expect(vague.at!).toBeLessThan(after.at!);
    inside(vague);
  });

  it('ignores anchors in other characters\' lanes', () => {
    const other = ev('other', day(160), ['smaug']);
    const vague = ev('vague', summer, ['bilbo']);
    estimatePositions([other, vague]);
    expect(vague.at).toBeCloseTo((summer.from + summer.to) / 2);
  });

  it('never places an event before the previous one in a shared lane', () => {
    // "late" claims the whole year, so its window alone would put it mid-year, before "early" in late summer.
    const early = ev('early', { from: YEAR + 0.6, to: YEAR + 0.67 }, ['bilbo']);
    const late = ev('late', wholeYear, ['bilbo']);
    estimatePositions([early, late]);
    expect(late.at!).toBeGreaterThan(early.at!);
    inside(late);
  });

  it('never places an event before what it is enabled-by or caused-by, even across lanes', () => {
    const cause = ev('cause', { from: YEAR + 0.7, to: YEAR + 0.8 }, ['smaug']);
    const effect = ev('effect', wholeYear, ['bard'], { links: [link('cause', 'caused-by')] });
    const helped = ev('helped', wholeYear, ['thranduil'], { links: [link('cause', 'enabled-by')] });
    const parallel = ev('parallel', { from: YEAR, to: YEAR + 0.5 }, ['beorn'], { links: [link('cause', 'concurrent')] });
    estimatePositions([cause, effect, helped, parallel]);
    expect(effect.at!).toBeGreaterThan(cause.at!);
    expect(helped.at!).toBeGreaterThan(cause.at!);
    expect(parallel.at).toBeCloseTo(YEAR + 0.25); // concurrent does not order: it may sit before
    for (const e of [cause, effect, helped, parallel]) inside(e);
  });

  it('keeps guesses inside the range even when pushed', () => {
    // "squeezed" ends before the anchor it follows: it stays at the end of its own range.
    const anchor = ev('anchor', day(300), ['bilbo']);
    const squeezed = ev('squeezed', summer, ['bilbo']);
    estimatePositions([anchor, squeezed]);
    inside(squeezed);
  });

  it('leaves undated events alone', () => {
    const t = ev('timeless', undefined, ['iluvatar']);
    estimatePositions([t]);
    expect(t.at).toBeUndefined();
  });
});

describe('estimateWaypoints', () => {
  const wp = (place: string, span: Span, extra: Partial<Waypoint> = {}): Waypoint => ({
    place, date: { age: 'third-age', year: 1 }, precision: 'season', span, at: (span.from + span.to) / 2, ...extra,
  });
  const journey = (waypoints: Waypoint[]): Journey => ({ id: 'j', title: { en: 'J' }, characters: ['gandalf'], waypoints, events: [] });

  it('puts exact-dated waypoints at their middle', () => {
    const j = journey([wp('a', day(10)), wp('b', day(20))]);
    estimateWaypoints([j], []);
    expect(j.waypoints[0].at).toBeCloseTo(YEAR + 10.5 * DAY);
    expect(j.waypoints[1].at).toBeCloseTo(YEAR + 20.5 * DAY);
  });

  it('takes the matching event\'s moment', () => {
    const e = ev('council', wholeYear, ['gandalf'], { place: 'dol-guldur', journeys: ['j'], at: YEAR + 0.7 });
    const range = { from: YEAR + 0.41, to: YEAR + 0.92 }; // summer–autumn
    const j = journey([wp('forest-gate', summer), wp('dol-guldur', range, { end: { age: 'third-age', year: 1, season: 'autumn' } }), wp('dale', { from: YEAR + 0.67, to: YEAR + 0.92 })]);
    estimateWaypoints([j], [e]);
    expect(j.waypoints[1].at).toBe(YEAR + 0.7);
  });

  it('respects a waypoint range: an event guessed outside it is not used', () => {
    const e = ev('council', wholeYear, ['gandalf'], { place: 'dol-guldur', journeys: ['j'], at: YEAR + 0.2 });
    const range = { from: YEAR + 0.41, to: YEAR + 0.92 };
    const j = journey([wp('bag-end', day(100)), wp('dol-guldur', range), wp('rivendell', day(340))]);
    estimateWaypoints([j], [e]);
    const w = j.waypoints[1];
    expect(w.at).not.toBe(YEAR + 0.2);
    expect(w.at).toBeGreaterThanOrEqual(range.from);
    expect(w.at).toBeLessThanOrEqual(range.to);
  });

  it('spaces unmatched waypoints between their neighbours, inside their ranges, in order', () => {
    const j = journey([wp('a', day(100)), wp('b', summer), wp('c', summer), wp('d', summer), wp('e', day(250))]);
    estimateWaypoints([j], []);
    const at = j.waypoints.map((w) => w.at);
    for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThan(at[i - 1]);
    for (const w of j.waypoints) {
      expect(w.at).toBeGreaterThanOrEqual(w.span.from);
      expect(w.at).toBeLessThanOrEqual(w.span.to);
    }
  });

  it('never guesses a waypoint before the one before it when its range allows', () => {
    // b's matching event is guessed late in the year; c (whole year, unmatched, last) must not fall before it.
    const e = ev('x', wholeYear, ['gandalf'], { place: 'b', journeys: ['j'], at: YEAR + 0.9 });
    const j = journey([wp('a', day(10)), wp('b', wholeYear), wp('c', { from: YEAR + 0.5, to: YEAR + 1 })]);
    estimateWaypoints([j], [e]);
    expect(j.waypoints[1].at).toBe(YEAR + 0.9);
    expect(j.waypoints[2].at).toBeGreaterThanOrEqual(YEAR + 0.9);
    expect(j.waypoints[2].at).toBeLessThanOrEqual(YEAR + 1);
  });
});
