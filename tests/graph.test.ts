// npm run graph: the five queries that find stories the content knows but doesn't tell.
//
// Each query runs against the small valid fixture in tests/fixtures/valid/content/, with the
// shape it looks for added to a throwaway copy — the same way tests/build.test.ts makes its
// deliberately broken copies, so the committed fixture stays the one minimal valid tree.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildContent } from '../scripts/content/build.ts';
import {
  CLOSE_DAYS, daysApart, droppedThreads, islands, markdown, missingLinks, report,
  samePlaceUnlinked, spanWords, summary, untoldLegs,
} from '../scripts/content/graph.ts';
import { ONE_DAY } from '../src/data/calendar.ts';
import type { ContentIndex } from '../src/data/types.ts';

const FIXTURE = path.join(import.meta.dirname, 'fixtures/valid/content');
const ASSETS = path.join(import.meta.dirname, 'fixtures/valid/assets');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ardatir-graph-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

type Add = { file: string; write: string } | { file: string; replace: [string, string] };
let n = 0;

/** The fixture plus these files, built. Errors fail the test: every case must stay valid content. */
function indexWith(adds: Add[]): ContentIndex {
  const dir = path.join(tmp, `case-${n++}`, 'content');
  fs.cpSync(FIXTURE, dir, { recursive: true });
  fs.cpSync(ASSETS, path.join(dir, '../assets'), { recursive: true });
  for (const a of adds) {
    const f = path.join(dir, a.file);
    if ('write' in a) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, a.write); }
    else {
      const s = fs.readFileSync(f, 'utf8');
      if (!s.includes(a.replace[0])) throw new Error(`fixture ${a.file} has no ${JSON.stringify(a.replace[0])}`);
      fs.writeFileSync(f, s.replace(a.replace[0], a.replace[1]));
    }
  }
  const r = buildContent(dir);
  expect(r.errors, r.errors.join('\n')).toEqual([]);
  return r.index;
}

const place = (id: string, name: string): Add => ({
  file: `places/${id}.yaml`,
  write: `id: ${id}\nname: { en: ${name}, es: ${name} }\nsummary: { en: A place., es: Un lugar. }\nmap: nowhere\n`,
});

const character = (id: string, name: string): Add => ({
  file: `characters/${id}.yaml`,
  write: `id: ${id}\nname: { en: ${name}, es: ${name} }\nkind: hobbit\nsummary: { en: A hobbit., es: Un hobbit. }\n`,
});

/** A minimal valid outline event. */
function event(o: { key: string; id: string; when: string; place: string; characters: string[]; links?: string }): Add {
  return {
    file: `events/third-age/${o.key}-${o.id}/event.yaml`,
    write: [
      `id: ${o.id}`, 'age: third-age', 'when:', `  start: { age: third-age, ${o.when} }`,
      `  precision: ${o.when.includes('day:') ? 'day' : o.when.includes('month:') ? 'month' : 'year'}`,
      `place: ${o.place}`, `characters: [ ${o.characters.join(', ')} ]`, 'journeys: []', 'status: outline',
      `title: { en: ${o.id}, es: ${o.id} }`, 'summary: { en: It happened., es: Pasó. }',
      ...(o.links ? [o.links] : []), '',
    ].join('\n'),
  };
}

describe('the honest-range helpers', () => {
  it('counts the days that certainly passed between two ranges, either way round', () => {
    const a = { from: 0, to: 1 * ONE_DAY }, b = { from: 11 * ONE_DAY, to: 12 * ONE_DAY };
    expect(Math.round(daysApart(a, b))).toBe(10);
    expect(Math.round(daysApart(b, a))).toBe(10);
    expect(daysApart(a, { from: 0.5 * ONE_DAY, to: 3 * ONE_DAY })).toBe(0); // overlapping: no gap
  });

  it('says a duration in days while that reads, then in years', () => {
    expect(spanWords(ONE_DAY)).toBe('1 day');
    expect(spanWords(10 * ONE_DAY)).toBe('10 days');
    expect(spanWords(3)).toBe('3 years');
  });
});

describe('1. journey legs with no scene on them', () => {
  // Two stops added in the middle of the fixture's road, neither of them a scene.
  const ROAD_WITH_GAPS: Add[] = [
    place('woody-end', 'The Woody End'),
    place('bree', 'Bree'),
    { file: 'journeys/the-road.yaml', replace: [
      '  - { place: rivendell',
      '  - { place: woody-end, date: { age: third-age, year: 2941, month: 5, day: 1 }, precision: day }\n' +
      '  - { place: bree, date: { age: third-age, year: 2941, month: 5, day: 10 }, precision: day }\n' +
      '  - { place: rivendell',
    ] },
  ];

  it('finds nothing while every stop on a journey has its scene', () => {
    expect(untoldLegs(indexWith([]))).toEqual([]);
  });

  it('names the characters, both places, the dates and the length of the gap', () => {
    const found = untoldLegs(indexWith(ROAD_WITH_GAPS));
    expect(found.map((f) => f.what.includes('no scene at either end'))).toContain(true);
    const both = found.find((f) => f.what.includes('no scene at either end'))!;
    expect(both.what).toContain('Bilbo Baggins and Gandalf');       // who walked it
    expect(both.what).toContain('The Woody End → Bree');            // from where to where
    expect(both.what).toContain('9 days');                          // how long the gap is
    expect(both.detail.join(' ')).toContain('1 May T.A. 2941');     // the dates
    expect(both.detail.join(' ')).toContain('10 May T.A. 2941');
    expect(both.suggestion).toContain('Bree');
    // A leg arriving at an untold stop is reported too, below the one with nothing at all.
    expect(found[0]).toBe(both);
    expect(found.some((f) => f.what.includes('nothing told at The Woody End'))).toBe(true);
    // Each untold stop is the arrival of exactly one leg, so nothing is reported twice.
    expect(found).toHaveLength(2);
  });
});

describe('2. two scenes of one life with nothing between them', () => {
  // Bilbo at a third place four days after the party: no link, and no journey covering it.
  const DETOUR: Add[] = [
    place('woody-end', 'The Woody End'),
    event({ key: '2941-04-30', id: 'the-detour', when: 'year: 2941, month: 4, day: 30', place: 'woody-end', characters: ['bilbo'] }),
  ];

  it('finds nothing in the fixture, where every pair is linked or in one place', () => {
    expect(missingLinks(indexWith([]))).toEqual([]);
  });

  it('finds the unjoined pair, within the window of the vaguer precision', () => {
    const found = missingLinks(indexWith(DETOUR));
    expect(found).toHaveLength(1);
    expect(found[0].events).toEqual(['the-party', 'the-detour']);
    expect(found[0].characters).toEqual(['bilbo']);
    expect(found[0].what).toContain('3 days apart');
    expect(found[0].detail.join(' ')).toContain('no journey covers both');
    expect(CLOSE_DAYS.day).toBe(30);
  });

  it('says nothing when the two scenes are too far apart for the window', () => {
    const far = indexWith([
      place('woody-end', 'The Woody End'),
      // 31 days after the party and 32 before the moon-letters: outside the window either way.
      event({ key: '2941-05-28', id: 'the-detour', when: 'year: 2941, month: 5, day: 28', place: 'woody-end', characters: ['bilbo'] }),
    ]);
    expect(missingLinks(far)).toEqual([]);
  });

  it('says nothing when a typed link already joins them', () => {
    const linked = indexWith([
      place('woody-end', 'The Woody End'),
      event({
        key: '2941-04-30', id: 'the-detour', when: 'year: 2941, month: 4, day: 30', place: 'woody-end',
        characters: ['bilbo'], links: 'links:\n  - { to: the-party, type: enabled-by }\n',
      }),
    ]);
    expect(missingLinks(linked)).toEqual([]);
  });

  it('says nothing when a journey already draws the road between the two places', () => {
    const onTheRoad = indexWith([
      place('woody-end', 'The Woody End'),
      event({ key: '2941-04-30', id: 'the-detour', when: 'year: 2941, month: 4, day: 30', place: 'woody-end', characters: ['bilbo'] }),
      { file: 'events/third-age/2941-04-30-the-detour/event.yaml', replace: ['journeys: []', 'journeys: [ the-road ]'] },
      { file: 'journeys/the-road.yaml', replace: [
        '  - { place: rivendell',
        '  - { place: woody-end, date: { age: third-age, year: 2941, month: 4, day: 30 }, precision: day }\n  - { place: rivendell',
      ] },
    ]);
    expect(missingLinks(onTheRoad)).toEqual([]);
  });
});

describe('3. two parties in one place, and neither knows', () => {
  // Two scenes at Bree a day apart, with nobody in common and no link.
  const CROSSING: Add[] = [
    place('bree', 'Bree'),
    character('rosie', 'Rosie Cotton'),
    event({ key: '2941-05-01', id: 'bilbo-at-bree', when: 'year: 2941, month: 5, day: 1', place: 'bree', characters: ['bilbo'] }),
    event({ key: '2941-05-02', id: 'rosie-at-bree', when: 'year: 2941, month: 5, day: 2', place: 'bree', characters: ['rosie'] }),
  ];

  it('finds nothing in the fixture, where the scenes in one place share their people', () => {
    expect(samePlaceUnlinked(indexWith([]))).toEqual([]);
  });

  it('finds the pair that passes through one place within days', () => {
    const found = samePlaceUnlinked(indexWith(CROSSING));
    expect(found).toHaveLength(1);
    expect(found[0].events.sort()).toEqual(['bilbo-at-bree', 'rosie-at-bree']);
    expect(found[0].what).toContain('Bree');
    expect(found[0].detail.join(' ')).toContain('No character in common');
    expect(found[0].suggestion).toContain('crossing');
  });

  it('says nothing once a link joins them', () => {
    const joined = indexWith([...CROSSING, {
      file: 'events/third-age/2941-05-02-rosie-at-bree/event.yaml',
      replace: ['status: outline', 'status: outline\nlinks:\n  - { to: bilbo-at-bree, type: crossing }'],
    }]);
    expect(samePlaceUnlinked(joined)).toEqual([]);
  });

  it('says nothing when they are further apart than a few days', () => {
    const apart = indexWith([
      place('bree', 'Bree'), character('rosie', 'Rosie Cotton'),
      event({ key: '2941-05-01', id: 'bilbo-at-bree', when: 'year: 2941, month: 5, day: 1', place: 'bree', characters: ['bilbo'] }),
      event({ key: '2941-05-20', id: 'rosie-at-bree', when: 'year: 2941, month: 5, day: 20', place: 'bree', characters: ['rosie'] }),
    ]);
    expect(samePlaceUnlinked(apart)).toEqual([]);
  });
});

describe('4. lives in pieces', () => {
  // Three scenes of one life, in three places, with no link and no journey joining any of them.
  const SCATTERED: Add[] = [
    place('woody-end', 'The Woody End'),
    character('rosie', 'Rosie Cotton'),
    event({ key: '2941-12-1', id: 'rosie-one', when: 'year: 2941', place: 'bag-end', characters: ['rosie'] }),
    event({ key: '2941-12-2', id: 'rosie-two', when: 'year: 2941', place: 'rivendell', characters: ['rosie'] }),
    event({ key: '2941-12-3', id: 'rosie-three', when: 'year: 2941', place: 'woody-end', characters: ['rosie'] }),
  ];

  it('finds nothing in the fixture, where one journey joins every scene of both lives', () => {
    expect(islands(indexWith([]))).toEqual([]);
  });

  it('reports the life once, counting its islands and naming the narrowest seams', () => {
    const found = islands(indexWith(SCATTERED));
    expect(found).toHaveLength(1);
    expect(found[0].characters).toEqual(['rosie']);
    expect(found[0].what).toContain('3 scenes in 3 islands');
    expect(found[0].detail.join(' ')).toContain('rosie-one');
    expect(found[0].detail.join(' ')).toContain('Bag End');
    expect(found[0].detail.join(' ')).toContain('Rivendell');
    expect(found[0].suggestion).toContain('A journey for Rosie Cotton');
  });

  it('counts a shared journey as a join, so the life is whole again', () => {
    const onOneRoad: Add[] = [
      { file: 'journeys/the-road.yaml', replace: ['characters: [ bilbo, gandalf ]', 'characters: [ bilbo, gandalf, rosie ]'] },
      ...['one', 'two', 'three'].map((k): Add => ({
        file: `events/third-age/2941-12-${k === 'one' ? 1 : k === 'two' ? 2 : 3}-rosie-${k}/event.yaml`,
        replace: ['journeys: []', 'journeys: [ the-road ]'],
      })),
    ];
    expect(islands(indexWith([...SCATTERED, ...onOneRoad]))).toEqual([]);
  });

  it('leaves out the seams the missing-link query already reports', () => {
    const index = indexWith(SCATTERED);
    const seams = islands(index);
    expect(seams).toHaveLength(1);
    const covered = new Set(['rosie-one|rosie-two', 'rosie-three|rosie-two']);
    expect(islands(index, covered)).toEqual([]);
  });
});

describe('5. threads let go', () => {
  // The party enables the moon-letters; make the moon-letters cause the leaving, and the
  // chain of three ends on a scene with no consequence of its own.
  const CHAIN: Add[] = [{
    file: 'events/third-age/2941-07-leaving/event.yaml',
    replace: ['status: outline', 'status: outline\nlinks:\n  - { to: moon-letters, type: caused-by }'],
  }];

  it('finds nothing while no chain runs longer than a single cause', () => {
    expect(droppedThreads(indexWith([]))).toEqual([]);
  });

  it('names the whole chain and the scene it stops on', () => {
    const found = droppedThreads(indexWith(CHAIN));
    expect(found).toHaveLength(1);
    expect(found[0].events).toEqual(['the-party', 'moon-letters', 'leaving']);
    expect(found[0].what).toContain('chain of 3');
    expect(found[0].detail[0]).toBe('"The Party" → "Moon-letters" → "Leaving".');
    expect(found[0].detail.join(' ')).toContain('nothing is caused or enabled by it');
    // Nothing later in the fixture has these people in it, so the consequence isn't told at all.
    expect(found[0].suggestion).toContain('The scene that came of');
  });

  it('points at the later scene of the same people, when there is one to link to', () => {
    const found = droppedThreads(indexWith([
      ...CHAIN,
      event({ key: '2942-01', id: 'the-homecoming', when: 'year: 2942', place: 'bag-end', characters: ['bilbo', 'gandalf'] }),
    ]));
    expect(found).toHaveLength(1);
    expect(found[0].detail.join(' ')).toContain('the-homecoming');
    expect(found[0].suggestion).toContain('`causes`');
  });

  it('leaves what is foretold alone: prophecy is the last word', () => {
    const index = indexWith(CHAIN);
    expect(droppedThreads(index, new Set(['third-age']))).toEqual([]);
  });
});

describe('the report', () => {
  it('runs all five queries, in the order it tells them, and says the window each used', () => {
    const sections = report(indexWith([]));
    expect(sections.map((s) => s.query)).toEqual(['untold-legs', 'missing-link', 'same-place', 'islands', 'dropped-thread']);
    for (const s of sections) expect(s.window.length).toBeGreaterThan(20);
  });

  it('writes markdown with a heading per query and the counts in the terminal summary', () => {
    const index = indexWith([
      place('woody-end', 'The Woody End'),
      event({ key: '2941-04-30', id: 'the-detour', when: 'year: 2941, month: 4, day: 30', place: 'woody-end', characters: ['bilbo'] }),
    ]);
    const sections = report(index);
    const md = markdown(index, sections, new Date('2941-04-26T00:00:00Z'));
    expect(md).toContain('# Stories not yet told');
    expect(md).toContain('2941-04-26');
    for (const s of sections) expect(md).toContain(`## ${s.title}`);
    expect(md).toContain('### 1. Bilbo Baggins: "The Party" → "the-detour"');
    const total = sections.reduce((k, x) => k + x.findings.length, 0);
    const said = summary(sections, 'out/graph.md');
    expect(said).toContain('out/graph.md');
    expect(said).toContain(`${total} ${total === 1 ? 'story' : 'stories'} not yet told`);
    for (const x of sections) expect(said).toContain(`${x.title}`);
  });
});
