// The content build: the real content/ is valid, a small fixture builds as expected,
// and each deliberately broken copy of that fixture fails with its own error.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildContent, type BuildResult } from '../scripts/content/build.ts';
import { narrationHash } from '../scripts/narration/text.ts';
import { nearness } from '../src/data/calendar.ts';

const root = path.resolve(import.meta.dirname, '..');
const FIXTURE = path.join(import.meta.dirname, 'fixtures/valid/content');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ardatir-content-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

type Change =
  | { file: string; replace: [string, string] }   // swap text in a fixture file (must be found)
  | { file: string; write: string }                // add or overwrite a file
  | { file: string; remove: true };                // delete a file

const PARTY = 'events/third-age/2941-04-26-the-party';
const LETTERS = 'events/third-age/2941-06-moon-letters/event.yaml';
const ROAD = 'journeys/the-road.yaml';

/** Build a copy of the valid fixture with some changes applied. */
let n = 0;
function buildWith(changes: Change[]): BuildResult {
  const dir = path.join(tmp, `case-${n++}`, 'content');
  fs.cpSync(FIXTURE, dir, { recursive: true });
  for (const c of changes) {
    const f = path.join(dir, c.file);
    if ('remove' in c) fs.rmSync(f);
    else if ('write' in c) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c.write); }
    else {
      const s = fs.readFileSync(f, 'utf8');
      if (!s.includes(c.replace[0])) throw new Error(`fixture ${c.file} has no ${JSON.stringify(c.replace[0])}`);
      fs.writeFileSync(f, s.replace(c.replace[0], c.replace[1]));
    }
  }
  return buildContent(dir);
}

describe('the real content', () => {
  const r = buildContent(path.join(root, 'content'));

  it('is valid, with no warnings', () => {
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('places every best guess inside its honest range', () => {
    for (const e of r.index.events) if (e.span) {
      expect(e.at, e.id).toBeGreaterThanOrEqual(e.span.from);
      expect(e.at, e.id).toBeLessThanOrEqual(e.span.to);
    }
    for (const j of r.index.journeys) for (const w of j.waypoints) {
      expect(w.at, `${j.id} ${w.place}`).toBeGreaterThanOrEqual(w.span.from);
      expect(w.at, `${j.id} ${w.place}`).toBeLessThanOrEqual(w.span.to);
    }
  });

  it('keeps story order in every character lane', () => {
    const last = new Map<string, number>();
    for (const e of r.index.events) {
      if (e.at === undefined) continue;
      for (const c of e.characters) {
        expect(e.at, `${e.id} (${c})`).toBeGreaterThanOrEqual((last.get(c) ?? -Infinity) - 1e-9);
        last.set(c, e.at);
      }
    }
  });

  it('gives every character a lane that keeps time, and crosses Tuor and Túrin at Ivrin', () => {
    const at = (x: (typeof r.index.lanes)[string][number]) => ('event' in x
      ? r.index.events.find((e) => e.id === x.event)!.at
      : r.index.journeys.find((j) => j.id === x.journey)!.waypoints[x.waypoint].at);
    for (const [c, lane] of Object.entries(r.index.lanes)) {
      expect(lane.filter((x) => 'event' in x).map((x) => (x as { event: string }).event), c).toEqual(r.index.byCharacter[c]);
      let last = -Infinity;
      for (const x of lane) { const a = at(x); if (a === undefined) continue; expect(a, `${c} ${JSON.stringify(x)}`).toBeGreaterThanOrEqual(last - 1e-9); last = a; }
    }
    expect(r.index.lanes.tuor).toContainEqual({ event: 'tuor-sees-turin-at-ivrin' });
    expect(r.index.lanes.turin).toContainEqual({ event: 'tuor-sees-turin-at-ivrin' });
  });

  it('never guesses an event before what enables or causes it', () => {
    const at = new Map(r.index.events.map((e) => [e.id, e.at]));
    for (const e of r.index.events) for (const l of e.links) {
      if (l.reverse || (l.type !== 'enabled-by' && l.type !== 'caused-by')) continue;
      const before = at.get(l.to), mine = at.get(e.id);
      if (before !== undefined && mine !== undefined) expect(mine, `${e.id} after ${l.to}`).toBeGreaterThanOrEqual(before);
    }
  });

  it('places the moon-letters on 1 Lithe and Gandalf at Dol Guldur within summer–autumn', () => {
    const letters = r.index.events.find((e) => e.id === 'elrond-reads-the-moon-letters')!;
    expect(letters.when?.precision).toBe('day');
    expect(letters.when?.start.day).toBe('1-lithe');
    const road = r.index.journeys.find((j) => j.id === 'gandalfs-road-2941')!;
    const dg = road.waypoints.find((w) => w.place === 'dol-guldur')!;
    expect(dg.end?.season).toBe('autumn');
    const year = 4032 + 2940;
    expect(dg.span.from).toBeGreaterThan(year + 0.4); // not the whole year: from summer
    expect(dg.span.to).toBeLessThan(year + 1);        // to the end of autumn
  });

  it('matches the Rivendell waypoints (June until 1 Lithe) to the moon-letters', () => {
    const letters = r.index.events.find((e) => e.id === 'elrond-reads-the-moon-letters')!;
    for (const id of ['there-and-back-again', 'the-road-to-erebor', 'gandalfs-road-2941']) {
      const w = r.index.journeys.find((j) => j.id === id)!.waypoints.find((x) => x.place === 'rivendell')!;
      expect(w.endPrecision, id).toBe('day');
      expect(w.at, id).toBe(letters.at);
    }
  });

  it('explains every dated best guess, and cites only real, earlier or later anchors', () => {
    const byId = new Map(r.index.events.map((e) => [e.id, e]));
    const order = new Map(r.index.events.map((e, i) => [e.id, i]));
    for (const e of r.index.events) {
      if (!e.span) { expect(e.atReason, e.id).toBeUndefined(); continue; }
      const why = e.atReason!;
      expect(why, e.id).toBeDefined();
      if (why.after) expect(order.get(why.after)!, e.id).toBeLessThan(order.get(e.id)!);
      if (why.before) expect(order.get(why.before)!, e.id).toBeGreaterThan(order.get(e.id)!);
      for (const id of [why.after, why.before]) if (id) expect(byId.get(id)?.atReason?.kind, `${e.id} → ${id}`).toBe('exact');
      if (why.follows) expect(byId.has(why.follows), e.id).toBe(true);
      if (why.window) expect(why.window[0], e.id).toBeLessThanOrEqual(why.window[1]);
    }
  });

  it('no longer calls the secret door "likely" during A Welcome at Lake-town (#2), and says why it is placed after it', () => {
    const lake = r.index.events.find((e) => e.id === 'welcome-at-lake-town')!;
    const door = r.index.events.find((e) => e.id === 'the-secret-door')!;
    expect(lake.when?.precision).toBe('day');
    expect(door.when?.precision).toBe('season');
    // Bilbo is in both and the door comes later in his story: only "possibly", never "likely".
    expect(nearness(lake, door)).toEqual({ kind: 'possibly', why: 'same-character' });
    // Its best guess cites the anchor it was placed after, in Bilbo's lane, within autumn.
    expect(door.atReason).toMatchObject({ kind: 'after-anchor', after: 'welcome-at-lake-town', lane: ['bilbo'] });
    expect(door.atReason!.window![0]).toBeCloseTo(lake.at!, 4);
    expect(door.atReason!.window![1]).toBeCloseTo(door.span!.to, 4);
  });
});

describe('the valid fixture', () => {
  const r = buildWith([]);
  const ev = (id: string) => r.index.events.find((e) => e.id === id)!;

  it('builds with no errors or warnings', () => {
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('records why each best guess landed where it did', () => {
    expect(ev('the-party').atReason).toEqual({ kind: 'exact' });
    expect(ev('moon-letters').atReason).toEqual({ kind: 'exact' });
    expect(ev('leaving').atReason).toMatchObject({ kind: 'after-anchor', after: 'moon-letters', lane: ['bilbo'] });
    expect(ev('leaving').atReason!.window![0]).toBeCloseTo(ev('moon-letters').at!, 4);
    expect(ev('the-music').atReason).toBeUndefined();
  });

  it('adds reverse links and derived lookups', () => {
    expect(ev('the-party').links).toContainEqual(expect.objectContaining({ to: 'moon-letters', type: 'enables', reverse: true }));
    expect(r.index.byCharacter.bilbo).toEqual(['the-party', 'moon-letters', 'leaving']);
    expect(r.index.journeys[0].events).toEqual(['the-party', 'moon-letters', 'leaving']);
    expect(r.index.arcs[0].span).toBeDefined();
  });

  it('times narration and beats from staging', () => {
    const d = r.details.find((x) => x.id === 'the-party')!;
    expect(d.narration.map((p) => p.t)).toEqual([0, 0.5]);
    expect(d.beats).toEqual([{ id: 'knock', t: 0.1, label: { en: 'A knock', es: 'Un golpe' } }]);
    expect(d.durationSeconds).toBe(12);
  });

  it('writes a readable script for every event with narration, staged or not', () => {
    expect(r.scripts.map((s) => s.id)).toEqual(['the-party']);
    const ok = buildWith([
      { file: LETTERS, replace: ['status: outline', 'status: scripted'] },
      { file: 'events/third-age/2941-06-moon-letters/narration.yaml', write: '- id: runes\n  en: The runes shine under the moon.\n  es: Las runas brillan bajo la luna.\n- id: door\n  en: A door, on Durin\'s Day.\n  es: Una puerta, el Día de Durin.\n' },
    ]);
    expect(ok.errors).toEqual([]);
    const s = ok.scripts.find((x) => x.id === 'moon-letters')!;
    expect(s.passages.map((p) => p.id)).toEqual(['runes', 'door']);
    expect(s.passages[0].text.es).toBe('Las runas brillan bajo la luna.');
    expect(ok.details.some((d) => d.id === 'moon-letters')).toBe(false); // not playable
  });

  it('builds lanes: events in story order, waypoints matched to them left out', () => {
    expect(r.index.lanes.bilbo).toEqual([{ event: 'the-party' }, { event: 'moon-letters' }, { event: 'leaving' }]);
    expect(r.index.journeys[0].waypoints.map((w) => w.event)).toEqual(['the-party', 'moon-letters']);
  });

  it('places the legs no event covers between the lane\'s events, by best guess', () => {
    const ok = buildWith([{ file: ROAD, replace: [
      '  - { place: rivendell,',
      '  - { place: bag-end, date: { age: third-age, year: 2941, month: 5 }, precision: month }\n  - { place: rivendell,',
    ] }, { file: ROAD, replace: [
      'season: autumn }, precision: season }',
      'season: autumn }, precision: season }\n  - { place: bag-end, date: { age: third-age, year: 2941, season: winter }, precision: season }',
    ] }]);
    expect(ok.errors).toEqual([]);
    const lane = [{ event: 'the-party' }, { journey: 'the-road', waypoint: 1 }, { event: 'moon-letters' }, { event: 'leaving' }, { journey: 'the-road', waypoint: 3 }];
    expect(ok.index.lanes.bilbo).toEqual(lane);
    expect(ok.index.lanes.gandalf).toEqual(lane);
  });

  it('keeps a matched waypoint in the lane of a traveller who is not in that event', () => {
    const ok = buildWith([{ file: LETTERS, replace: ['[ bilbo, gandalf ]', '[ bilbo ]'] }]);
    expect(ok.errors).toEqual([]);
    expect(ok.index.lanes.gandalf).toEqual([{ event: 'the-party' }, { journey: 'the-road', waypoint: 1 }, { event: 'leaving' }]);
  });

  it('matches a ranged waypoint to the event inside its range', () => {
    const w = r.index.journeys[0].waypoints[1];
    expect(w.end).toEqual({ age: 'third-age', year: 2941, season: 'autumn' });
    expect(w.at).toBe(ev('moon-letters').at);
  });

  it('lets a waypoint end at its own precision', () => {
    const ok = buildWith([{ file: ROAD, replace: [
      'date: { age: third-age, year: 2941, season: summer }, end: { age: third-age, year: 2941, season: autumn }, precision: season',
      'date: { age: third-age, year: 2941, month: 6 }, end: { age: third-age, year: 2941, day: 1-lithe }, precision: month, endPrecision: day',
    ] }, { file: 'events/third-age/2941-07-leaving/event.yaml', replace: ['season: summer }\n  precision: season', 'day: 1-lithe }\n  precision: day'] }]);
    expect(ok.errors).toEqual([]);
    expect(ok.warnings).toEqual([]);
    const w = ok.index.journeys[0].waypoints[1];
    expect(w.endPrecision).toBe('day');
    const year = 2940; // the fixture's Third Age starts at 0
    expect(w.span.from).toBeCloseTo(ok.index.ages.find((a) => a.id === 'third-age')!.axis!.start + year + 151 / 366, 6);
    expect(w.span.to).toBeCloseTo(ok.index.ages.find((a) => a.id === 'third-age')!.axis!.start + year + 182 / 366, 6);
    expect(w.at).toBe(ev('moon-letters').at);
  });

  it('accepts Overlithe in a leap year', () => {
    const ok = buildWith([{ file: LETTERS, replace: ['year: 2941, day: 1-lithe', 'year: 2940, day: overlithe'] }]);
    expect(ok.errors).toEqual([]);
  });

  it('reads a recording with uneven starts', () => {
    const ok = buildWith([
      { file: `${PARTY}/audio/en.yaml`, write: 'duration: 20\nstarts: { door: 1.5, tea: 14 }\n' },
      { file: `${PARTY}/audio/en.mp3`, write: '' }, // created for the test only; never committed
    ]);
    expect(ok.errors).toEqual([]);
    const d = ok.details.find((x) => x.id === 'the-party')!;
    expect(d.audioFiles.en).toEqual({ src: 'data/audio/the-party/en.mp3', duration: 20, starts: [1.5, 14] });
    expect(ok.copies).toHaveLength(1);
  });
});

/** Each broken fixture and the error (or, last, warning) it must produce. */
const BROKEN: { name: string; changes: Change[]; error: string | RegExp }[] = [
  // Files and ids
  { name: 'YAML syntax error', changes: [{ file: 'places/bag-end.yaml', write: 'id: bag-end\nname: { en: Bag End\n' }], error: 'YAML:' },
  { name: 'id not kebab-case', changes: [{ file: 'places/bag-end.yaml', replace: ['id: bag-end', 'id: Bag_End'] }], error: 'place id must be kebab-case' },
  { name: 'duplicate id', changes: [{ file: 'places/bag-end-2.yaml', write: 'id: bag-end\nname: { en: X, es: X }\nsummary: { en: X, es: X }\n' }], error: 'duplicate place id "bag-end"' },
  { name: 'text without English', changes: [{ file: 'arcs/the-quest.yaml', replace: ['title: { en: The Quest, es: La Búsqueda }', 'title: { es: La Búsqueda }'] }], error: 'title: needs an English text (en)' },
  { name: 'character without kind', changes: [{ file: 'characters/gandalf.yaml', replace: ['kind: wizard\n', ''] }], error: 'kind: required' },
  { name: 'bad colour', changes: [{ file: 'characters/bilbo.yaml', replace: ['"#6a8a3a"', 'green'] }], error: 'color: use #rrggbb' },
  { name: 'unknown kin', changes: [{ file: 'characters/bilbo.yaml', write: 'id: bilbo\nname: { en: Bilbo, es: Bilbo }\nkind: hobbit\nsummary: { en: A, es: A }\nkin:\n  - { id: frodo, as: cousin }\n' }], error: 'kin: unknown character "frodo"' },
  { name: 'age with neither axis nor timeless', changes: [{ file: 'ages/third-age.yaml', replace: ['axis: { start: 4032 }', ''] }], error: 'needs either `timeless: true` or `axis: { start }`' },

  // Events: references and status
  { name: 'unknown character', changes: [{ file: LETTERS, replace: ['[ bilbo, gandalf ]', '[ bilbo, elrond ]'] }], error: 'characters: unknown character "elrond"' },
  { name: 'unknown place', changes: [{ file: LETTERS, replace: ['place: rivendell', 'place: lothlorien'] }], error: 'place: unknown place "lothlorien"' },
  { name: 'unknown arc', changes: [{ file: LETTERS, replace: ['[ the-quest ]', '[ the-war ]'] }], error: 'arcs: unknown arc "the-war"' },
  { name: 'unknown journey', changes: [{ file: LETTERS, replace: ['[ the-road ]', '[ the-sea ]'] }], error: 'journeys: unknown journey "the-sea"' },
  { name: 'unknown age', changes: [{ file: LETTERS, replace: ['age: third-age\n', 'age: fifth-age\n'] }], error: 'age: unknown age "fifth-age"' },
  { name: 'unknown status', changes: [{ file: LETTERS, replace: ['status: outline', 'status: done'] }], error: 'status: one of' },
  { name: 'link to an unknown event', changes: [{ file: LETTERS, replace: ['to: the-party', 'to: the-feast'] }], error: 'links: unknown event "the-feast"' },
  { name: 'link to itself', changes: [{ file: LETTERS, replace: ['to: the-party', 'to: moon-letters'] }], error: 'an event cannot link to itself' },
  { name: 'unknown link type', changes: [{ file: LETTERS, replace: ['type: enabled-by', 'type: inspired-by'] }], error: 'links[0].type: one of' },
  { name: 'scripted without narration', changes: [{ file: `${PARTY}/narration.yaml`, remove: true }], error: 'status "staged" needs a narration.yaml' },
  { name: 'staged without staging', changes: [{ file: `${PARTY}/staging.yaml`, remove: true }], error: 'status "staged" needs a staging.yaml' },
  { name: 'timeless event with a date', changes: [{ file: 'events/before-time/0000-the-music/event.yaml', replace: ['status: outline', 'status: outline\nwhen: { start: { age: third-age, year: 1 }, precision: year }'] }], error: 'age "before-time" is timeless; remove the date' },

  // Dates
  { name: 'precision day without a day', changes: [{ file: `${PARTY}/event.yaml`, replace: ['month: 4, day: 26 }', 'month: 4 }'] }], error: 'precision "day" needs a day' },
  { name: 'precision month without a month', changes: [{ file: 'events/third-age/2941-07-leaving/event.yaml', replace: ['precision: season', 'precision: month'] }], error: 'precision "month" needs a month' },
  { name: 'precision season without a season', changes: [{ file: `${PARTY}/event.yaml`, replace: ['precision: day', 'precision: season'] }], error: 'precision "season" needs a season' },
  { name: 'unknown precision', changes: [{ file: `${PARTY}/event.yaml`, replace: ['precision: day', 'precision: hour'] }], error: 'precision must be one of' },
  { name: 'day out of range', changes: [{ file: `${PARTY}/event.yaml`, replace: ['day: 26', 'day: 31'] }], error: 'when.start.day: 1–30' },
  { name: 'month out of range', changes: [{ file: `${PARTY}/event.yaml`, replace: ['month: 4', 'month: 13'] }], error: 'when.start.month: 1–12' },
  { name: 'day without a month', changes: [{ file: `${PARTY}/event.yaml`, replace: ['month: 4, day: 26', 'day: 26'] }], error: 'a day needs a month' },
  { name: 'month and season', changes: [{ file: 'events/third-age/2941-07-leaving/event.yaml', replace: ['season: summer', 'season: summer, month: 7'] }], error: 'give a month or a season, not both' },
  { name: 'year zero', changes: [{ file: `${PARTY}/event.yaml`, replace: ['year: 2941', 'year: 0'] }], error: 'when.start.year: must be a whole number ≥ 1' },
  { name: 'end before start', changes: [{ file: `${PARTY}/event.yaml`, replace: ['precision: day', 'end: { age: third-age, year: 2941, month: 3, day: 1 }\n  precision: day'] }], error: 'when.end is before when.start' },
  { name: 'unknown extra day', changes: [{ file: LETTERS, replace: ['day: 1-lithe', 'day: midsummer'] }], error: 'day: 1–30, or one of 2-yule, 1-lithe, midyear, overlithe, 2-lithe, 1-yule' },
  { name: 'extra day with a month', changes: [{ file: LETTERS, replace: ['day: 1-lithe', 'month: 6, day: 1-lithe'] }], error: '"1-lithe" is outside the months; remove the month or season' },
  { name: 'Overlithe in a common year', changes: [{ file: LETTERS, replace: ['day: 1-lithe', 'day: overlithe'] }], error: '2941 is not a leap year, so it has no Overlithe' },

  // Journeys
  { name: 'journey with one waypoint', changes: [{ file: ROAD, replace: ['  - { place: bag-end, date: { age: third-age, year: 2941, month: 4, day: 26 }, precision: day }\n', ''] }], error: 'a journey needs at least two waypoints' },
  { name: 'waypoint at an unknown place', changes: [{ file: ROAD, replace: ['place: rivendell', 'place: moria'] }], error: 'waypoints[1].place: unknown place "moria"' },
  { name: 'waypoint earlier than the one before', changes: [{ file: ROAD, replace: ['year: 2941, month: 4, day: 26', 'year: 2942, month: 4, day: 26'] }], error: 'waypoints[1]: earlier than the waypoint before it' },
  { name: 'waypoint end before its date', changes: [{ file: ROAD, replace: ['end: { age: third-age, year: 2941, season: autumn }', 'end: { age: third-age, year: 2941, season: spring }'] }], error: 'waypoints[1].end is before its date' },
  { name: 'waypoint end at the wrong precision', changes: [{ file: ROAD, replace: ['end: { age: third-age, year: 2941, season: autumn }', 'end: { age: third-age, year: 2941, month: 10 }'] }], error: 'waypoints[1].end: precision "season" needs a season' },
  { name: 'waypoint endPrecision without an end', changes: [{ file: ROAD, replace: ['day: 26 }, precision: day }', 'day: 26 }, precision: day, endPrecision: month }'] }], error: 'waypoints[0].endPrecision: only with an end' },
  { name: 'waypoint end at the wrong endPrecision', changes: [{ file: ROAD, replace: ['season: autumn }, precision: season', 'season: autumn }, precision: season, endPrecision: day'] }], error: 'waypoints[1].end: precision "day" needs a day' },
  { name: 'waypoint end inside its coarser date', changes: [{ file: ROAD, replace: ['end: { age: third-age, year: 2941, season: autumn }, precision: season', 'end: { age: third-age, year: 2941, month: 7, day: 3 }, precision: season, endPrecision: day'] }], error: 'waypoints[1].end ends before its date does' },
  { name: 'waypoint end in an unknown age', changes: [{ file: ROAD, replace: ['end: { age: third-age,', 'end: { age: fifth-age,'] }], error: 'waypoints[1].end.age: unknown age "fifth-age"' },

  // Staging and recordings
  { name: 'unknown stage', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['stage: diorama', 'stage: film'] }], error: 'stage: one of cosmos, diorama' },
  { name: 'narration not rising', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['{ door: 0, tea: 0.5 }', '{ door: 0.6, tea: 0.5 }'] }], error: 'narration.tea: starts before the passage before it' },
  { name: 'narration passage without a time', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['{ door: 0, tea: 0.5 }', '{ door: 0 }'] }], error: 'narration.tea: needs a time 0–1' },
  { name: 'timing for an unknown passage', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['tea: 0.5 }', 'tea: 0.5, cake: 0.9 }'] }], error: 'narration: no passage "cake" in narration.yaml' },
  { name: 'unknown beat', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['{ knock: 0.1 }', '{ knock: 0.1, song: 0.8 }'] }], error: 'beats: no beat "song" in event.yaml' },
  { name: 'track for a character not in the event', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['characterId: bilbo', 'characterId: thorin'] }], error: 'tracks[0]: "thorin" is not in the event\'s characters' },
  { name: 'keyframes not rising', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['{ t: 1, x: 1', '{ t: -0.5, x: 1'] }], error: 't must rise from 0 to 1' },
  { name: 'timing file without a recording', changes: [{ file: `${PARTY}/audio/en.yaml`, write: 'duration: 20\n' }], error: 'timing file without a recording next to it' },
  { name: 'recording without a timing file', changes: [{ file: `${PARTY}/audio/es.mp3`, write: '' }], error: 'recording without es.yaml' },
  { name: 'recording starts out of order', changes: [{ file: `${PARTY}/audio/en.yaml`, write: 'duration: 20\nstarts: { door: 10, tea: 4 }\n' }, { file: `${PARTY}/audio/en.mp3`, write: '' }], error: 'starts.tea: earlier than the passage before it' },
  { name: 'textHash not a hash', changes: [{ file: `${PARTY}/audio/en.yaml`, write: 'duration: 20\ntextHash: 12\n' }, { file: `${PARTY}/audio/en.mp3`, write: '' }], error: 'textHash: expected sha256: and 16 hex digits' },
  { name: 'recording start past its end', changes: [{ file: `${PARTY}/audio/en.yaml`, write: 'duration: 20\nstarts: { door: 0, tea: 25 }\n' }, { file: `${PARTY}/audio/en.mp3`, write: '' }], error: 'starts.tea: needs a second within the recording' },
];

describe('broken content', () => {
  for (const c of BROKEN) {
    it(`${c.name} → ${c.error}`, () => {
      const r = buildWith(c.changes);
      expect(r.errors.some((e) => (typeof c.error === 'string' ? e.includes(c.error) : c.error.test(e))), r.errors.join('\n') || '(no errors)').toBe(true);
    });
  }

  it('warns when a sort key contradicts the dates', () => {
    const r = buildWith([{ file: 'events/third-age/2941-07-leaving/event.yaml', replace: ['year: 2941, season: summer', 'year: 2940, season: summer'] }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('sorts after "moon-letters" but its dates are earlier'))).toBe(true);
  });

  it('warns when a journey event at a waypoint\'s place overlaps none of its waypoints there', () => {
    const r = buildWith([{ file: ROAD, replace: [
      'date: { age: third-age, year: 2941, season: summer }, end: { age: third-age, year: 2941, season: autumn }, precision: season',
      'date: { age: third-age, year: 2941, month: 6 }, end: { age: third-age, year: 2941, season: autumn }, precision: month, endPrecision: season',
    ] }, { file: LETTERS, replace: ['year: 2941, day: 1-lithe', 'year: 2941, month: 5, day: 30'] }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('is at "rivendell" on journey "the-road" but overlaps none of its waypoints there'))).toBe(true);
  });

  describe('textHash', () => {
    // The fixture's English script, as narration.yaml has it.
    const hash = narrationHash([
      { id: 'door', text: { en: 'Someone knocks at the green door.' } },
      { id: 'tea', text: { en: 'Tea is poured for far too many guests.' } },
    ], 'en');
    const recording = (h: string): Change[] => [
      { file: `${PARTY}/audio/en.yaml`, write: `duration: 20\ntextHash: ${h}\n` },
      { file: `${PARTY}/audio/en.mp3`, write: '' }, // created for the test only; never committed
    ];

    it('gives no warning when the recording matches the script', () => {
      const r = buildWith(recording(hash));
      expect(r.errors).toEqual([]);
      expect(r.warnings).toEqual([]);
    });

    it('warns "stale recording" when a recorded passage changes', () => {
      const r = buildWith([...recording(hash), { file: `${PARTY}/narration.yaml`, replace: ['far too many guests', 'a great many guests'] }]);
      expect(r.errors).toEqual([]);
      expect(r.warnings.some((w) => w.includes('en.yaml: stale recording'))).toBe(true);
    });
  });

  it('warns about missing Spanish and unknown fields', () => {
    const r = buildWith([{ file: 'places/rivendell.yaml', write: 'id: rivendell\nname: { en: Rivendell }\nsummary: { en: A house., es: Una casa. }\nheight: 3\n' }]);
    expect(r.errors).toEqual([]);
    expect(r.missing.es).toBe(1);
    expect(r.warnings.some((w) => w.includes('unknown field "height"'))).toBe(true);
  });
});
