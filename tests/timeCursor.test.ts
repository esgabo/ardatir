// The time cursor (docs/DESIGN.md §3.1): moments in the URL (src/moment.ts), the control's
// segments and scales (src/timeAxis.ts), where everyone is (src/whereabouts.ts), and what the
// page lists, against the real content.

import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildContent } from '../scripts/content/build.ts';
import { index, loadIndex } from '../src/chronicle.ts';
import { momentLabel } from '../src/format.ts';
import { DEFAULT_MOMENT, momentOfEvent, momentPath, momentSpan, parseMoment } from '../src/moment.ts';
import { MOMENTS } from '../src/moments.ts';
import { atMoment } from '../src/related.ts';
import { parseRoute, timeHref } from '../src/routes.ts';
import { axisExtent, buildSegments, defaultZoom, fitZoom, pickAt, scaleWindow, stepMoment, stepOutside, zoomsFor, type Zoom } from '../src/timeAxis.ts';
import { entryMoment, resolveMoment, segments } from '../src/timeCursor.ts';
import { atHome, whereabouts, whereOnJourney } from '../src/whereabouts.ts';
import type { Journey, Waypoint } from '../src/data/types.ts';

const content = path.resolve(import.meta.dirname, '..', 'content');

beforeAll(async () => {
  const ix = buildContent(content).index;
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ix }));
  await loadIndex();
  vi.unstubAllGlobals();
});

const P = (s: string) => parseMoment(s, index.ages)!;
const segs = () => buildSegments(index.ages, 7053);

describe('moments in the URL', () => {
  it('reads every precision and writes it back the same', () => {
    for (const s of ['third-age/3019-03-15', 'third-age/3019-03', 'third-age/3019', 'third-age/3019-midyear', 'third-age/3019-1-lithe', 'third-age/2941-summer', 'first-age/495', 'before-time']) {
      expect(momentPath(P(s)), s).toBe(s);
    }
    expect(P('third-age/3019-03-15')).toEqual({ age: 'third-age', date: { age: 'third-age', year: 3019, month: 3, day: 15 }, precision: 'day' });
    expect(P('third-age/3019').precision).toBe('year');
    expect(P('third-age/3019-1-lithe').date!.day).toBe('1-lithe');
  });

  it('turns an axis position into the day it falls on', () => {
    const d = momentSpan(P('third-age/3019-03-15'), index.ages)!;
    expect(momentPath(parseMoment(String((d.from + d.to) / 2), index.ages)!)).toBe('third-age/3019-03-15');
  });

  it('rejects days that do not exist, and keeps only whole years in Valian years', () => {
    expect(parseMoment('third-age/3019-13', index.ages)).toBeUndefined();
    expect(parseMoment('third-age/3019-02-31', index.ages)).toBeUndefined();
    expect(momentPath(P('third-age/3019-overlithe'))).toBe('third-age/3019-midyear'); // 3019 has no Overlithe: as stepDate does
    expect(momentPath(P('third-age/3020-overlithe'))).toBe('third-age/3020-overlithe');
    expect(momentPath(P('first-age/591'))).toBe('first-age/590'); // the First Age has 590 years: its last
    expect(momentPath(P('third-age/4000-03-15'))).toBe('third-age/3021');
    expect(parseMoment('middle-age/3', index.ages)).toBeUndefined();
    expect(parseMoment('before-time/3', index.ages)).toBeUndefined();
    expect(momentPath(P('years-of-the-trees/1495-03-02'))).toBe('years-of-the-trees/1495');
  });

  it('says the moment as precisely as it was picked, in both languages', () => {
    expect(momentLabel(P('third-age/3019'), 'en')).toBe('T.A. 3019');
    expect(momentLabel(P('third-age/3019-03'), 'en')).toBe('March, T.A. 3019');
    expect(momentLabel(P('third-age/3019-03-15'), 'en')).toBe('15 March, T.A. 3019');
    expect(momentLabel(P('third-age/3019-03-15'), 'es')).toBe('15 de marzo, T.E. 3019');
    expect(momentLabel(P('third-age/2941-summer'), 'es')).toBe('Verano, T.E. 2941');
    expect(momentLabel(P('before-time'), 'es')).toBe('Antes del Tiempo');
  });

  it("an event's moment is its start at its own precision; vaguer than a season gives the year", () => {
    const ev = (id: string) => momentPath(momentOfEvent(index.events.find((e) => e.id === id)!, index.ages));
    expect(ev('unexpected-party')).toBe('third-age/2941-04-26');
    expect(ev('roast-mutton')).toBe('third-age/2941-05');
    expect(ev('spiders-of-mirkwood')).toBe('third-age/2941-summer');
    expect(ev('smeagol-takes-the-ring')).toBe('third-age/2463'); // approximate
    expect(ev('ainulindale')).toBe('before-time');
  });

  it('routes: #/time/<moment>?zoom=&from=, and back to an href', () => {
    expect(parseRoute('#/time/third-age/3019-03-15?zoom=year&from=roast-mutton&lang=es'))
      .toEqual({ kind: 'time', where: 'third-age/3019-03-15', zoom: 'year', from: 'roast-mutton', lang: 'es' });
    expect(parseRoute('#/time')).toEqual({ kind: 'time', where: undefined, zoom: undefined, from: undefined, lang: undefined });
    expect(timeHref('first-age/495', 'es', { zoom: 'age' })).toBe('#/time/first-age/495?zoom=age&lang=es');
    expect(parseMoment(DEFAULT_MOMENT, index.ages)).toBeDefined();
  });
});

describe('opening the time cursor', () => {
  it('a year past what the open Fourth Age shows becomes the last year shown, never an inverted window', () => {
    const shown = segments().find((s) => s.age.id === 'fourth-age')!.years!;
    const m = resolveMoment('fourth-age/500')!;
    expect(m.date!.year).toBe(shown);
    const w = scaleWindow(m, defaultZoom(m), segments())!;
    expect(w.to).toBeGreaterThan(w.from);
    expect(resolveMoment('fourth-age/61')!.date!.year).toBe(61);
  });

  it('an age opens on its first well-dated event, not on a poem placed anywhere in sixteen centuries', () => {
    const ta = index.ages.find((a) => a.id === 'third-age')!;
    expect(entryMoment(ta).date!.year).not.toBe(1636);
    const first = index.events.filter((e) => e.age === 'third-age' && e.span && e.span.to - e.span.from <= 1 + 1e-9).sort((a, b) => a.span!.from - b.span!.from)[0];
    expect(entryMoment(ta).date!.year).toBe(first.when!.start.year);
  });
});

describe('the control', () => {
  it('timeless ages first, apart from the axis; every dated age gets room, longer ones more', () => {
    const s = segs();
    expect(s.slice(0, 2).map((x) => [x.age.id, x.timeless])).toEqual([['before-time', true], ['years-of-the-lamps', true]]);
    const dated = s.filter((x) => !x.timeless);
    expect(dated.map((x) => x.age.id)).toEqual(['years-of-the-trees', 'first-age', 'second-age', 'third-age', 'fourth-age']);
    expect(dated[0].left).toBeGreaterThan(s[1].left + s[1].width); // a gap before the axis
    for (const x of dated) expect(x.width).toBeGreaterThan(0.1);
    expect(dated.find((x) => x.age.id === 'second-age')!.width).toBeGreaterThan(dated.find((x) => x.age.id === 'first-age')!.width);
    const last = dated[dated.length - 1];
    expect(axisExtent(s)).toEqual({ left: dated[0].left, right: last.left + last.width });
    expect(dated.map((x) => x.years)).toEqual([1500, 590, 3441, 3021, 120]);
  });

  it('what is foretold comes last, timeless, apart after the axis (#57)', () => {
    const s = segs();
    const end = s[s.length - 1];
    expect([end.age.id, end.timeless, end.after, end.age.foretold]).toEqual(['foretold', true, true, true]);
    expect(s.filter((x) => x.after).map((x) => x.age.id)).toEqual(['foretold']);
    expect(end.left).toBeGreaterThan(axisExtent(s).right); // a gap after the axis
    expect(end.left + end.width).toBeCloseTo(1, 9);
    expect(s[0].after).toBeUndefined();
    // Its moment is the age itself, outside time, like before-time.
    expect(momentSpan(P('foretold'), index.ages)).toBeUndefined();
    expect(momentPath(momentOfEvent(index.events.find((e) => e.id === 'turin-slays-morgoth')!, index.ages))).toBe('foretold');
    expect(resolveMoment('foretold')).toEqual({ age: 'foretold' });
  });

  it('steps out of timeless ages towards the axis only', () => {
    const s = segs();
    const entry = (a: { id: string }) => ({ age: a.id, marker: true }) as never;
    expect(stepOutside(P('before-time'), 'next', s, index.ages, entry)).toEqual({ age: 'years-of-the-trees', marker: true });
    expect(stepOutside(P('before-time'), 'prev', s, index.ages, entry)).toBeUndefined();
    expect(momentPath(stepOutside(P('foretold'), 'prev', s, index.ages, entry)!)).toBe('fourth-age/120');
    expect(stepOutside(P('foretold'), 'next', s, index.ages, entry)).toBeUndefined();
    expect(stepOutside(P('third-age/3019'), 'next', s, index.ages, entry)).toBeUndefined();
  });

  it('a bar without foretold ages keeps the axis to the end', () => {
    const s = buildSegments(index.ages.filter((a) => !a.foretold), 7053);
    expect(s.some((x) => x.after)).toBe(false);
    expect(axisExtent(s).right).toBeCloseTo(1, 9);
  });

  it('only whole years and centuries in Valian years; default scales follow the precision', () => {
    const yt = index.ages.find((a) => a.id === 'years-of-the-trees');
    expect(zoomsFor(yt)).toEqual(['age', 'century']);
    expect(fitZoom('month', P('years-of-the-trees/1495'), index.ages)).toBe('century');
    expect(defaultZoom(P('third-age/3019-03-15'))).toBe('month');
    expect(defaultZoom(P('third-age/3019-03'))).toBe('year');
    expect(defaultZoom(P('third-age/3019'))).toBe('century');
  });

  it('reaches a single day: picking on each scale gives a moment of its unit', () => {
    const m = P('third-age/3019-03-15');
    const pick = (z: Zoom, f: number) => { const w = scaleWindow(m, z, segs())!; return momentPath(pickAt(w.from + f * (w.to - w.from), w, index.ages)); };
    expect(pick('month', 14.5 / 30)).toBe('third-age/3019-03-15');
    expect(pick('year', 0.2)).toBe('third-age/3019-03');
    expect(pick('century', 0.5)).toBe('third-age/3011'); // 3000–3021: the last century runs to the age's end
    expect(pick('age', 0)).toBe('third-age/1');
    const june = P('third-age/3019-06-30');
    const w = scaleWindow(june, 'month', segs())!;
    expect(w.ticks.filter((t) => t.kind === 'extra').map((t) => [t.date.day, !!t.empty])).toEqual([['1-lithe', false], ['midyear', false], ['overlithe', true], ['2-lithe', false]]);
  });

  it('keys: arrows by the unit, into a coarser moment first; Page Up/Down by more; Home/End', () => {
    const step = (s: string, z: Zoom, k: Parameters<typeof stepMoment>[2]) => momentPath(stepMoment(P(s), z, k, segs(), index.ages));
    expect(step('third-age/3019-03-15', 'month', 'next')).toBe('third-age/3019-03-16');
    expect(step('third-age/3019-03-15', 'month', 'bigPrev')).toBe('third-age/3019-02-15');
    expect(step('third-age/3019-06-30', 'month', 'next')).toBe('third-age/3019-1-lithe');
    expect(step('third-age/3019', 'year', 'next')).toBe('third-age/3019-01');
    expect(step('third-age/3019', 'year', 'prev')).toBe('third-age/3019-12');
    expect(step('third-age/3019-03', 'year', 'bigNext')).toBe('third-age/3020-03');
    expect(step('third-age/3019-03-15', 'century', 'next')).toBe('third-age/3020');
    expect(step('third-age/3019', 'century', 'home')).toBe('third-age/3000');
    expect(step('third-age/3019', 'century', 'end')).toBe('third-age/3021');
    expect(step('third-age/3021', 'age', 'next')).toBe('fourth-age/1');
    expect(step('first-age/1', 'age', 'prev')).toBe('years-of-the-trees/1500');
    expect(step('fourth-age/120', 'age', 'next')).toBe('fourth-age/120'); // the control's end
    expect(step('years-of-the-trees/1495', 'century', 'end')).toBe('years-of-the-trees/1500'); // no one-year century
  });
});

describe('what is happening then', () => {
  it('15 March 3019: the Pelennor and Cirith Ungol likely, by day', () => {
    const am = atMoment(momentSpan(P('third-age/3019-03-15'), index.ages)!);
    const ids = am.likely.map((e) => e.id);
    expect(ids).toContain('battle-of-the-pelennor-fields');
    expect(ids).toContain('frodo-and-sam-escape-the-tower');
    expect(ids).not.toContain('the-ring-is-destroyed');
  });

  it('F.A. 495, a whole year: Nargothrond and Ivrin likely, year-dated events only possibly', () => {
    const am = atMoment(momentSpan(P('first-age/495'), index.ages)!);
    expect(am.likely.map((e) => e.id)).toEqual(['fall-of-nargothrond', 'tuor-sees-turin-at-ivrin']);
    expect(am.possibly.map((e) => e.id)).toContain('battle-of-tumhalad');
  });

  it('every moment to visit resolves and has something happening', () => {
    for (const mo of MOMENTS) {
      const m = parseMoment(mo.path, index.ages);
      expect(m, mo.path).toBeDefined();
      if (mo.event) expect(index.events.some((e) => e.id === mo.event), mo.event).toBe(true);
      const span = momentSpan(m!, index.ages);
      const n = span ? atMoment(span) : { likely: index.events.filter((e) => e.age === m!.age), possibly: [] };
      expect(n.likely.length + n.possibly.length, mo.path).toBeGreaterThan(0);
    }
  });
});

describe('where everyone is', () => {
  const groupsAt = (s: string, guess = true) => whereabouts(index.journeys, momentSpan(P(s), index.ages)!, guess);

  it('during the Spiders of Mirkwood: the company in the Wild, Gandalf away toward Dol Guldur (the issue\'s example)', () => {
    const g = groupsAt('third-age/2941-08');
    const of = (c: string) => g.find((x) => x.characters.includes(c))!;
    expect(of('thorin').where.stops.map((s) => s.place)).toContain('mirkwood');
    expect(of('gandalf').where.stops.at(-1)!.place).toBe('dol-guldur');
    expect(of('gandalf').where.kind).toBe('between');
    expect(of('gandalf').where.guess).toBeDefined();
  });

  it('at the Unexpected Party: everyone at Bag End, as one company', () => {
    const g = groupsAt('third-age/2941-04-26');
    expect(g).toHaveLength(1);
    expect(g[0].where).toMatchObject({ kind: 'at' });
    expect(g[0].where.stops[0].place).toBe('bag-end');
    expect(g[0].characters).toEqual(expect.arrayContaining(['bilbo', 'gandalf', 'thorin']));
    expect(g[0].journeys).toHaveLength(3);
  });

  it('27 September 3018: the hobbits at Tom\'s in the Old Forest, Old Man Willow (the day before) not happening then', () => {
    const g = groupsAt('third-age/3018-09-27');
    const hobbits = g.find((x) => x.characters.includes('frodo'))!;
    expect(hobbits.where).toMatchObject({ kind: 'at' });
    expect(hobbits.where.stops.map((s) => s.place)).toEqual(['old-forest']);
    const m = atMoment(momentSpan(P('third-age/3018-09-27'), index.ages)!);
    expect([...m.likely, ...m.possibly].map((e) => e.id)).not.toContain('old-man-willow');
    expect(m.likely.map((e) => e.id)).toContain('tom-bombadils-tales');
  });

  it('1 November 3019: the hobbits in the Shire, Gandalf with Tom, each in one group', () => {
    const g = groupsAt('third-age/3019-11-01');
    expect(g.filter((x) => x.characters.includes('gandalf'))).toHaveLength(1);
    expect(g.find((x) => x.characters.includes('frodo'))!.where.stops.map((s) => s.place)).toEqual(['the-shire']);
    expect(g.find((x) => x.characters.includes('gandalf'))!.where.stops.map((s) => s.place)).toEqual(['old-forest']);
  });

  it('on a handoff day each character is listed once, on the journey that is starting (30 October 3019)', () => {
    const g = groupsAt('third-age/3019-10-30');
    for (const c of ['gandalf', 'frodo', 'sam']) expect(g.filter((x) => x.characters.includes(c)), c).toHaveLength(1);
    expect(g.find((x) => x.characters.includes('gandalf'))!.journeys.map((j) => j.id)).toEqual(['gandalf-goes-to-bombadil']);
    expect(g.find((x) => x.characters.includes('frodo'))!.journeys.map((j) => j.id)).toEqual(['the-scouring-road']);
  });

  it('a whole year makes no guess', () => {
    for (const g of groupsAt('third-age/2941', false)) expect(g.where.guess).toBeUndefined();
  });

  const wp = (place: string, from: number, to: number, at = (from + to) / 2): Waypoint =>
    ({ place, date: { age: 'third-age', year: 1 }, precision: 'year', span: { from, to }, at });
  const j = (ws: Waypoint[]): Journey => ({ id: 'j', title: { en: 'j' }, characters: ['a'], waypoints: ws, events: [] });

  it('between two stops when none covers the moment; nothing before the start or after the end', () => {
    const road = j([wp('rivendell', 0, 1), wp('misty-mountains', 3, 4)]);
    expect(whereOnJourney(road, { from: 1.5, to: 2 })).toMatchObject({ kind: 'between' });
    expect(whereOnJourney(road, { from: 1.5, to: 2 })!.stops.map((s) => s.place)).toEqual(['rivendell', 'misty-mountains']);
    expect(whereOnJourney(road, { from: 0.2, to: 0.3 })).toMatchObject({ kind: 'at' });
    expect(whereOnJourney(road, { from: -2, to: -1 })).toBeUndefined();
    expect(whereOnJourney(road, { from: 5, to: 6 })).toBeUndefined();
  });

  it('a stay written as two stops at the same place is one place', () => {
    expect(whereOnJourney(j([wp('rivendell', 0, 1), wp('rivendell', 2, 3)]), { from: 1.2, to: 1.4 })).toMatchObject({ kind: 'at' });
  });

  it('several possible stops: somewhere between the first and last, with our guess of the last reached', () => {
    const w = whereOnJourney(j([wp('a', 0, 10, 2), wp('b', 0, 10, 5), wp('c', 0, 10, 8)]), { from: 6, to: 6.5 }, true)!;
    expect(w.stops.map((s) => s.place)).toEqual(['a', 'b', 'c']);
    expect(w.guess).toMatchObject({ atStop: false });
    expect(w.guess!.reached.place).toBe('b');
    expect(w.guess!.next!.place).toBe('c');
  });

  it("those who don't travel are at home, only between their first and last events, unless a journey places them", () => {
    const chars = [{ id: 'tom', home: 'old-forest' }, { id: 'frodo' }];
    const events = [
      { span: { from: 10, to: 11 }, characters: ['tom'] },
      { span: { from: 20, to: 21 }, characters: ['tom', 'frodo'] },
    ];
    expect(atHome(chars, events, { from: 15, to: 16 }, new Set())).toEqual([{ place: 'old-forest', characters: ['tom'] }]);
    expect(atHome(chars, events, { from: 5, to: 6 }, new Set())).toEqual([]);
    expect(atHome(chars, events, { from: 25, to: 26 }, new Set())).toEqual([]);
    expect(atHome(chars, events, { from: 15, to: 16 }, new Set(['tom']))).toEqual([]);
  });
});

describe('atHome: a visiting journey extends the home span', () => {
  it('keeps Tom at home while Gandalf stays with him (1 Nov 3019)', () => {
    const m = momentSpan(P('third-age/3019-11-01'), index.ages)!;
    const ids = (gs: { characters: string[] }[]) => gs.flatMap((g) => g.characters);
    expect(ids(atHome(index.characters, index.events, m, new Set(), index.journeys))).toContain('tom-bombadil');
    expect(ids(atHome(index.characters, index.events, m, new Set()))).not.toContain('tom-bombadil');
  });
});
