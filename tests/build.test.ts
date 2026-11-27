// The content build: the real content/ is valid, a small fixture builds as expected,
// and each deliberately broken copy of that fixture fails with its own error.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildContent, type BuildResult } from '../scripts/content/build.ts';
import { narrationHash, passageHash } from '../scripts/narration/text.ts';
import { nearness } from '../src/data/calendar.ts';
import { KIN_WORDS } from '../src/data/types.ts';

const root = path.resolve(import.meta.dirname, '..');
const FIXTURE = path.join(import.meta.dirname, 'fixtures/valid/content');
/** The fixture's models, beside its content/ (the test model: scripts/models/make-test-model.ts). */
const ASSETS = path.join(import.meta.dirname, 'fixtures/valid/assets');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ardatir-content-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

type Change =
  | { file: string; replace: [string, string] }   // swap text in a fixture file (must be found)
  | { file: string; write: string | Uint8Array }   // add or overwrite a file (`../assets/…` for models)
  | { file: string; remove: true };                // delete a file

const PARTY = 'events/third-age/2941-04-26-the-party';
const LETTERS = 'events/third-age/2941-06-moon-letters/event.yaml';
const ROAD = 'journeys/the-road.yaml';
const END = 'events/foretold/0001-the-end/event.yaml';
/** A foretold age after the axis, with one event in it (docs/DESIGN.md §4.8). */
const FORETOLD: Change[] = [
  { file: 'ages/foretold.yaml', write: 'id: foretold\norder: 7\nname: { en: What Is Foretold, es: Lo Profetizado }\nsummary: { en: Prophecy., es: Profecía. }\ntimeless: true\nforetold: true\n' },
  { file: END, write: [
    'id: the-end', 'age: foretold', 'characters: [ gandalf ]', 'status: outline', 'foretoldBy: bilbo',
    'source: { book: the-lost-road, chapter: Quenta Silmarillion }',
    'title: { en: The End, es: El Fin }', 'summary: { en: It will come., es: Vendrá. }',
    'links:', '  - { to: leaving, type: caused-by }', '',
  ].join('\n') },
];

/** The fixture's arc that tells its own story over the map (docs/DESIGN.md §4.10). */
const RIDE = 'arcs/the-ride/arc.yaml';
const RIDE_STAGING = 'arcs/the-ride/staging.yaml';

/**
 * The fixture without its telling: for the cases that take a place off the map, which an arc
 * played over that map is right to refuse (§4.10).
 */
const NO_TELLING: Change[] = [
  { file: RIDE, remove: true },
  { file: 'arcs/the-ride/narration.yaml', remove: true },
  { file: RIDE_STAGING, remove: true },
  { file: `${PARTY}/event.yaml`, replace: ['arcs: [ the-quest, the-ride ]', 'arcs: [ the-quest ]'] },
  { file: 'events/third-age/2941-07-leaving/event.yaml', replace: ['arcs: [ the-quest, the-ride ]', 'arcs: [ the-quest ]'] },
];

const GANDALF = 'characters/gandalf.yaml';
// Parentage (#89, docs/DESIGN.md §4.11). The fixture's hobbits carry a small family: Mungo →
// Bungo and Longo, Bungo married to Belladonna, and Bilbo their child. The extra relations the
// cases below add (a second marriage, a pair of twins) are invented for the fixture.
const BILBO = 'characters/bilbo.yaml';
const BUNGO = 'characters/bungo.yaml';
const MUNGO = 'characters/mungo.yaml';
const char = (id: string, yaml: string): Change => ({
  file: `characters/${id}.yaml`,
  write: `id: ${id}\nname: { en: ${id}, es: ${id} }\nkind: hobbit\nsummary: { en: A hobbit., es: Un hobbit. }\n${yaml}`,
});
/** A half-sibling for Bilbo: a second marriage of Bungo's, and a child of it. */
const HALF: Change[] = [char('laura', 'spouse: [ bungo ]\n'), char('dudo', 'parents: [ bungo, laura ]\n')];
/** A pair of twins, which parentage cannot reach: the one fact that must be authored. */
const TWINS: Change[] = [char('ponto', 'parents: [ bungo, belladonna ]\ntwin: porto\n'), char('porto', 'parents: [ bungo, belladonna ]\n')];
const TEST_KIT = 'kits/test-place/test-place.glb';
const SET_AND_LIGHT = `set: ${TEST_KIT}\nlight:\n  - { t: 0, preset: morning }\n  - { t: 0.6, preset: dusk }\n`
  + 'camera:\n  - { t: 0, x: 0, z: 0, width: 12 }\n  - { t: 0.5, x: -1.5, z: -1, width: 3.4 }\n'
  + 'reveal:\n  - { t: 0.2, cover: roof, amount: 0 }\n  - { t: 0.5, cover: roof, amount: 1 }\n'
  + 'sound:\n  - { t: 0.1, cue: knock }\n  - { t: 0.4, cue: clatter, gain: 0.7 }\n';
/** The fixture kit names one cover, so a `reveal` has something real to lift (scene/reveal.ts). */
const KIT_GLB = { scenes: [{}], nodes: [{ name: 'terrain' }, { name: 'cover-roof' }], extensionsUsed: ['EXT_meshopt_compression'] };
const withSet = (yaml: string) => ({ file: `${PARTY}/staging.yaml`, replace: ['duration: 12\n', `duration: 12\n${yaml}`] as [string, string] });
const TEST_MODEL = 'characters/test-figure/test-figure.glb';
/** A staging on the fixture kit, for the checks that need a set with a real cover in it. */
const withKit = (yaml: string) => [{ file: `../assets/${TEST_KIT}`, write: glb(KIT_GLB) }, withSet(`set: ${TEST_KIT}\n${yaml}`)];
/** A minimal .glb around a glTF JSON (no buffers): enough for the build's checks, which read only the JSON. */
function glb(json: object): Uint8Array {
  let text = JSON.stringify({ asset: { version: '2.0' }, ...json });
  while (text.length % 4) text += ' ';
  const b = Buffer.alloc(20 + text.length);
  b.write('glTF', 0, 'ascii'); b.writeUInt32LE(2, 4); b.writeUInt32LE(b.length, 8);
  b.writeUInt32LE(text.length, 12); b.write('JSON', 16, 'ascii'); b.write(text, 20, 'utf8');
  return b;
}

/** Build a copy of the valid fixture with some changes applied. */
let n = 0;
function buildWith(changes: Change[]): BuildResult {
  const dir = path.join(tmp, `case-${n++}`, 'content');
  fs.cpSync(FIXTURE, dir, { recursive: true });
  fs.cpSync(ASSETS, path.join(dir, '../assets'), { recursive: true });
  for (const c of changes) {
    const f = path.join(dir, c.file);
    if ('remove' in c) {
      fs.rmSync(f);
      // An empty folder would still be read (an arc folder with no arc.yaml is an error), so a
      // case that removes the last file in one removes the folder with it.
      const d = path.dirname(f);
      if (d !== dir && !fs.readdirSync(d).length) fs.rmdirSync(d);
    }
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
    // Until the Third Age narrator is auditioned (docs/superpowers/plans/2026-11-10-narration-voices.md).
    // Only Before Time has a narrator so far; the other ages get theirs at audition.
    // Crowding (#81) is a backlog the check itself uncovered: twenty of the staged events were
    // written before anything looked at whether two figures share a spot, and most of what is
    // left is companies of fourteen crossing a small tile. Restaging them is composition work,
    // one scene at a time, so the warnings stand as the list of what to go through, and this
    // allows them rather than pretending they are not there.
    const known = /^content\/ages\/[\w-]+\.yaml: has staged events but no narrator|(stand inside|walk through) each other at t|more pairs of figures overlapping/;
    expect(r.warnings.filter((w) => !known.test(w))).toEqual([]);
  });

  it('has migrated every `kin` word, and derives what those words used to state (#89)', () => {
    // The closed vocabulary (docs/DESIGN.md §4.11) is an error now that the 36 files are migrated,
    // so the only words left are the ones parentage cannot say.
    for (const c of r.index.characters) for (const k of c.kin ?? []) {
      expect(KIN_WORDS as readonly string[], `${c.id} → ${k.id}`).toContain(k.as);
    }
    expect(r.warnings.filter((w) => /\bkin\b/.test(w))).toEqual([]);
    const f = r.index.family;
    // Thorin's brother and his sister Dís, who used to be `brother` and nothing at all.
    expect(f.thorin.siblings.map((s) => s.id).sort()).toEqual(['dis', 'frerin']);
    // Fíli and Kíli reach Thorin only through Dís, and their father is unnamed in any source.
    expect(f.fili.parents).toEqual(['dis']);
    expect(f.fili.siblings.map((s) => s.id)).toEqual(['kili']);
    expect(f.dis.children.sort()).toEqual(['fili', 'kili']);
    // Éomer's `uncle` ran through Théodwyn, who had no file; now it is two sibling edges.
    expect(f.theoden.siblings.map((s) => s.id)).toEqual(['theodwyn']);
    expect(f.eomer.parents.sort()).toEqual(['eomund', 'theodwyn']);
    // The marriages the old `kin` could not hold, with the reverse derived on the other side.
    expect(f.turin.spouses).toEqual([{ id: 'nienor' }]);
    expect(f.nienor.spouses).toEqual([{ id: 'turin', reverse: true }]);
    expect(f.nienor.siblings.map((s) => s.id)).toEqual(['turin']);
    expect(f.aragorn.spouses).toEqual([{ id: 'arwen', reverse: true }]);
    // Bofur and Bombur: brothers in the published Hobbit, and no source names a parent of either.
    expect(f.bofur.kin).toEqual([{ id: 'bombur', as: 'sibling' }, { id: 'bifur', as: 'cousin' }]);
    // Durin's line is one house, and generation depth counts rows, not years.
    expect(r.index.houses.find((h) => h.members.includes('thorin'))!.members)
      .toEqual(['dis', 'fili', 'frerin', 'kili', 'thorin', 'thrain', 'thror']);
    expect(f.thror.generation).toBe(0);
    expect(f.fili.generation).toBe(3);
    // A character no parentage edge touches stands in no house at all.
    expect(f.gandalf.house).toBeUndefined();
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

  it('carries how to say a name through to the index', () => {
    expect(r.index.places.find((p) => p.id === 'rivendell')!.pronounce).toEqual({ en: 'RIV-en-del', es: 'RI-ven-del' });
    expect(r.index.places.find((p) => p.id === 'bag-end')!.pronounce).toBeUndefined();
  });

  it('carries a place\'s map coordinates through to the index', () => {
    expect(r.index.places.find((p) => p.id === 'bag-end')!.map).toEqual([{ on: 'middle-earth', x: -12.2, z: -1.3 }]);
    expect(r.index.places.find((p) => p.id === 'rivendell')!.map).toEqual([{ on: 'middle-earth', x: 34, z: -7, radius: 1 }]);
  });

  it('keeps a character\'s home', () => {
    expect(r.index.characters.find((c) => c.id === 'bilbo')!.home).toBe('bag-end');
    expect(r.index.characters.find((c) => c.id === 'gandalf')!.home).toBeUndefined();
  });

  it('derives the family from the one authored edge, with the reverses marked (#89)', () => {
    const f = r.index.family;
    expect(f.bilbo.parents).toEqual(['bungo', 'belladonna']);
    expect(f.bungo.children).toEqual(['bilbo']);
    expect(f.bungo.siblings).toEqual([{ id: 'longo', half: false, shared: ['mungo'] }]);
    expect(f.bungo.spouses).toEqual([{ id: 'belladonna' }]);
    expect(f.belladonna.spouses).toEqual([{ id: 'bungo', reverse: true }]);
    expect(f.bilbo.siblings).toEqual([]);
    // Generation rows, counted from the people the content gives no parents: never a date.
    expect(f.mungo.generation).toBe(0);
    expect(f.bungo.generation).toBe(1);
    expect(f.bilbo.generation).toBe(2);
    // The house is the part of the graph, named where the books name it (`house:` on the founder).
    expect(r.index.houses).toEqual([{ id: 'mungo', name: { en: 'The Bagginses', es: 'Los Bolsón' }, members: ['belladonna', 'bilbo', 'bungo', 'longo', 'mungo'] }]);
    expect(f.bilbo.house).toBe('mungo');
    // Gandalf stands in no tree, and still has an entry.
    expect(f.gandalf).toMatchObject({ parents: [], children: [], siblings: [], generation: 0 });
  });

  it('derives half-siblings as half-siblings, and says which parent they share', () => {
    const ok = buildWith(HALF);
    expect(ok.errors).toEqual([]);
    expect(ok.warnings).toEqual([]);
    expect(ok.index.family.bilbo.siblings).toEqual([{ id: 'dudo', half: true, shared: ['bungo'] }]);
    expect(ok.index.family.dudo.siblings).toEqual([{ id: 'bilbo', half: true, shared: ['bungo'] }]);
  });

  it('carries a twin both ways, as a refinement of the sibling edge', () => {
    const ok = buildWith(TWINS);
    expect(ok.errors).toEqual([]);
    expect(ok.warnings).toEqual([]);
    const f = ok.index.family;
    expect(f.ponto.twin).toEqual({ id: 'porto' });
    expect(f.porto.twin).toEqual({ id: 'ponto', reverse: true });
    expect(f.ponto.siblings.find((s) => s.id === 'porto')).toMatchObject({ twin: true, half: false });
    expect(f.bilbo.siblings.find((s) => s.id === 'ponto')!.twin).toBeUndefined();
  });

  it('takes a character\'s dates from the event that declares them, at the event\'s honest range', () => {
    const ok = buildWith([{ file: LETTERS, replace: ['status: outline', 'status: outline\nborn: [ bilbo ]'] }]);
    expect(ok.errors).toEqual([]);
    const bilbo = ok.index.characters.find((c) => c.id === 'bilbo')!;
    expect(bilbo.born!.event).toBe('moon-letters');
    expect(bilbo.born!.precision).toBe('day');
    expect(bilbo.born!.span).toEqual(ok.index.events.find((e) => e.id === 'moon-letters')!.span);
    // Silence is silence: nothing infers a death.
    expect(bilbo.died).toBeUndefined();
  });

  it('keeps a date the character states for a life no scene of ours tells', () => {
    const bungo = r.index.characters.find((c) => c.id === 'bungo')!;
    expect(bungo.born!.date).toEqual({ age: 'third-age', year: 2846 });
    expect(bungo.born!.event).toBeUndefined();
    expect(bungo.died!.precision).toBe('year');
    expect(bungo.born!.span!.to).toBeLessThan(bungo.died!.span!.from);
    // An elf nobody says died is never given an end.
    expect(r.index.characters.find((c) => c.id === 'belladonna')!.died).toBeUndefined();
  });

  it('lets a genealogy character have no scene at all', () => {
    // Mungo is in no event and on no journey, and that is the whole point of his file.
    expect(r.index.byCharacter.mungo).toEqual([]);
    expect(r.warnings).toEqual([]);
    // Take him out of the tree and the warning comes back.
    const off = buildWith([{ file: 'characters/longo.yaml', replace: ['parents: [ mungo ]\n', ''] }, { file: BUNGO, replace: ['parents: [ mungo ]\n', ''] }]);
    expect(off.warnings.some((w) => w.includes('characters/mungo.yaml: appears in no event or journey')), off.warnings.join('\n')).toBe(true);
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
    // An arc that tells is read as text the same way, under its own namespace (§4.10).
    expect(r.scripts.map((s) => s.id)).toEqual(['the-party', 'arc/the-ride']);
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

  it('places what is foretold after the axis, as prophecy, after every journey leg', () => {
    const ok = buildWith([...FORETOLD, { file: ROAD, replace: [
      'season: autumn }, precision: season }',
      'season: autumn }, precision: season }\n  - { place: bag-end, date: { age: third-age, year: 2941, season: winter }, precision: season }',
    ] }]);
    expect(ok.errors).toEqual([]);
    expect(ok.warnings).toEqual([]);
    expect(ok.index.ages.at(-1)).toMatchObject({ id: 'foretold', foretold: true });
    expect(ok.index.ages.at(-1)!.axis).toBeUndefined();
    const end = ok.index.events.at(-1)!;
    expect(end).toMatchObject({ id: 'the-end', foretoldBy: 'bilbo', source: { book: 'the-lost-road' } });
    expect(end.note).toBeUndefined();
    expect(end.span).toBeUndefined();
    expect(end.at).toBeUndefined();
    // A link from prophecy into history is kept, with its reverse.
    expect(ok.index.events.find((e) => e.id === 'leaving')!.links).toContainEqual(expect.objectContaining({ to: 'the-end', type: 'causes', reverse: true }));
    // The winter leg comes before the prophecy in the lane, though the prophecy has no guess to sort by.
    expect(ok.index.lanes.gandalf.slice(-2)).toEqual([{ journey: 'the-road', waypoint: 2 }, { event: 'the-end' }]);
    // Other ages carry no flag.
    expect(ok.index.ages.find((a) => a.id === 'before-time')!.foretold).toBeUndefined();
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

  it('reads factions, a battle\'s sides and its armies, and finds a faction\'s battles', () => {
    expect(r.index.factions.map((f) => f.id)).toEqual(['bagginses', 'sackville-bagginses']);
    expect(r.index.factions[0]).toEqual({ id: 'bagginses', name: { en: 'The Bagginses', es: 'Los Bolsón' }, color: '#6a8a3a', kind: 'hobbit', summary: { en: 'Respectable hobbits.', es: 'Hobbits respetables.' }, leaders: ['bilbo'] });
    expect(r.index.factions[1].leaders).toEqual([]);
    expect(ev('the-party').sides).toEqual([['bagginses'], ['sackville-bagginses']]);
    expect(ev('moon-letters').sides).toBeUndefined();
    expect(r.index.byFaction).toEqual({ bagginses: ['the-party'], 'sackville-bagginses': ['the-party'] });
    const d = r.details.find((x) => x.id === 'the-party')!;
    expect(d.armies).toEqual([{ faction: 'bagginses', size: 'small', keyframes: [{ t: 0, x: -3, z: 2 }, { t: 0.5, x: -1, z: 1, action: 'walk' }] }]);
  });

  // Arcs that tell their own story over the map (docs/DESIGN.md §4.10).
  it('reads an arc that tells: its map, its framing, its scenes, hosts and roads', () => {
    const arc = r.index.arcs.find((a) => a.id === 'the-ride')!;
    expect(arc.status).toBe('staged');
    expect(arc.map).toBe('middle-earth');
    // A voice belongs to an age, and both of this arc's events are in one.
    expect(arc.voiceOf).toBe('third-age');
    expect(arc.narratedBy).toBeUndefined();
    expect(arc.sources).toEqual([{ book: 'the-hobbit', chapter: 3 }]);
    // The events are derived, exactly as a grouping arc's are.
    expect(arc.events).toEqual(['the-party', 'leaving']);
    // A grouping stays an outline with nothing more to read.
    expect(r.index.arcs.find((a) => a.id === 'the-quest')!.status).toBe('outline');

    const d = r.arcDetails.find((a) => a.id === 'the-ride')!;
    expect(r.arcDetails).toHaveLength(1);
    expect(d.durationSeconds).toBe(30);
    expect(d.narration.map((x) => [x.id, x.t])).toEqual([['start', 0], ['east', 0.5]]);
    expect(d.beats).toEqual([{ id: 'out', t: 0.2, label: { en: 'Out of the Shire', es: 'Fuera de la Comarca' } }]);
    expect(d.camera).toEqual([{ t: 0, x: 0, z: 0, width: 80 }, { t: 0.6, x: 34, z: -7, width: 20 }]);
    // `scenes` says only when the telling reaches each event, and comes back in story order.
    expect(d.scenes).toEqual([{ event: 'the-party', t: 0.1 }, { event: 'leaving', t: 0.6 }]);
    expect(d.hosts[0]).toEqual({
      faction: 'bagginses', mark: 'column', weight: 2,
      keyframes: [
        { t: 0.1, at: 'bag-end', action: 'hold' },
        { t: 0.5, x: 10, z: -4, action: 'march', mark: 'trickle', weight: 1 },
        { t: 0.6, at: 'rivendell', action: 'hold' },
      ],
    });
    expect(d.hosts[1]).toEqual({
      label: { en: 'The guests', es: 'Los invitados' }, color: '#8fb6c8', mark: 'trickle', weight: 1,
      keyframes: [{ t: 0, at: 'bag-end', action: 'hold' }],
    });
    expect(d.roads).toEqual([{ journey: 'the-road', from: 0.2, to: 0.8 }]);
    expect(d.audioFiles).toEqual({});
  });

  it('writes an arc\'s script in its own namespace, so no recording can land on an event\'s', () => {
    const script = r.scripts.find((x) => x.id === 'arc/the-ride')!;
    expect(script.passages.map((p) => p.id)).toEqual(['start', 'east']);
    expect(r.arcDirs['the-ride']).toMatch(/arcs[/\\]the-ride$/);
  });

  it('reads an arc\'s recording through the same pipeline an event\'s goes through', () => {
    const ok = buildWith([
      { file: 'arcs/the-ride/audio/en.yaml', write: 'duration: 40\nstarts: { start: 0.5, east: 21 }\n' },
      { file: 'arcs/the-ride/audio/en.mp3', write: '' }, // created for the test only; never committed
    ]);
    expect(ok.errors).toEqual([]);
    const d = ok.arcDetails.find((a) => a.id === 'the-ride')!;
    expect(d.audioFiles.en).toEqual({ src: 'data/audio/arc/the-ride/en.mp3', duration: 40, starts: [0.5, 21] });
    expect(d.audio).toEqual(['en']);
  });

  it('keeps an arc\'s telling off the time axis and out of the lanes', () => {
    // An arc's `t` is narration time, not history (§4.10), so nothing of it reaches either.
    expect(JSON.stringify(r.index.lanes)).not.toContain('the-ride');
    expect(r.index.events.some((e) => (e as unknown as { arc?: string }).arc !== undefined)).toBe(false);
  });

  it('links the test model to its character and per-event overrides, and copies it once', () => {
    const url = 'data/models/characters/test-figure/test-figure.glb';
    expect(r.index.characters.find((c) => c.id === 'gandalf')!.model).toBe(url);
    expect(r.index.characters.find((c) => c.id === 'bilbo')!.model).toBeUndefined();
    expect(r.copies.filter((c) => c.to === url)).toHaveLength(1);
    const over = buildWith([{ file: `${PARTY}/staging.yaml`, replace: ['characterId: bilbo\n', `characterId: bilbo\n    model: ${TEST_MODEL}\n`] }]);
    expect(over.errors).toEqual([]);
    expect(over.details.find((x) => x.id === 'the-party')!.tracks[0].model).toBe(url);
    expect(over.copies.filter((c) => c.to === url)).toHaveLength(1);
  });

  it('reads a track\'s second model, the one it becomes partway through', () => {
    const url = 'data/models/characters/test-figure/test-figure.glb';
    const ok = buildWith([{ file: `${PARTY}/staging.yaml`, replace: ['characterId: bilbo\n', `characterId: bilbo\n    becomes: { t: 0.8, model: ${TEST_MODEL} }\n`] }]);
    expect(ok.errors).toEqual([]);
    expect(ok.details.find((x) => x.id === 'the-party')!.tracks[0].becomes).toEqual({ t: 0.8, model: url });
    expect(r.details.find((x) => x.id === 'the-party')!.tracks[0].becomes).toBeUndefined();
  });

  it('reads an event\'s set (a kit), how its light changes, how it is framed and what it lifts away', () => {
    const kit = { file: `../assets/${TEST_KIT}`, write: glb(KIT_GLB) };
    const ok = buildWith([kit, { file: `${PARTY}/staging.yaml`, replace: ['duration: 12\n', `duration: 12\n${SET_AND_LIGHT}`] }]);
    expect(ok.errors).toEqual([]);
    const d = ok.details.find((x) => x.id === 'the-party')!;
    expect(d.set).toBe(`data/models/${TEST_KIT}`);
    expect(d.light).toEqual([{ t: 0, preset: 'morning' }, { t: 0.6, preset: 'dusk' }]);
    expect(d.camera).toEqual([{ t: 0, x: 0, z: 0, width: 12 }, { t: 0.5, x: -1.5, z: -1, width: 3.4 }]);
    expect(d.reveal).toEqual([{ t: 0.2, cover: 'roof', amount: 0 }, { t: 0.5, cover: 'roof', amount: 1 }]);
    expect(d.sound).toEqual([{ t: 0.1, cue: 'knock' }, { t: 0.4, cue: 'clatter', gain: 0.7 }]);
    expect(ok.copies.some((c) => c.to === `data/models/${TEST_KIT}`)).toBe(true);
    expect(r.details.find((x) => x.id === 'the-party')!.set).toBeUndefined();
  });

  it('reads a recording with uneven starts', () => {
    const ok = buildWith([
      { file: `${PARTY}/audio/en.yaml`, write: 'duration: 20\nstarts: { door: 1.5, tea: 14 }\n' },
      { file: `${PARTY}/audio/en.mp3`, write: '' }, // created for the test only; never committed
    ]);
    expect(ok.errors).toEqual([]);
    const d = ok.details.find((x) => x.id === 'the-party')!;
    expect(d.audioFiles.en).toEqual({ src: 'data/audio/the-party/en.mp3', duration: 20, starts: [1.5, 14] });
    expect(ok.copies.filter((c) => c.to.startsWith('data/audio/'))).toHaveLength(1);
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
  { name: 'unknown home', changes: [{ file: 'characters/bilbo.yaml', replace: ['home: bag-end', 'home: hobbiton'] }], error: 'home: unknown place "hobbiton"' },
  { name: 'pronunciation without a stressed syllable', changes: [{ file: 'places/rivendell.yaml', replace: ['en: RIV-en-del', 'en: riv-en-del'] }], error: 'pronounce.en: "riv-en-del": needs exactly one stressed syllable in CAPITALS' },
  { name: 'pronunciation with stray marks', changes: [{ file: 'places/rivendell.yaml', replace: ['es: RI-ven-del', 'es: RI/ven/del'] }], error: 'pronounce.es: only letters' },
  { name: 'pronunciation without English', changes: [{ file: 'characters/gandalf.yaml', replace: ['kind: wizard\n', 'kind: wizard\npronounce: { es: GAN-dalf }\n'] }], error: 'pronounce: needs an English text (en)' },
  // Map coordinates (docs/MAP.md): the world view puts an event where its place is.
  { name: 'a position on an unknown map', changes: [{ file: 'places/rivendell.yaml', replace: ['on: middle-earth', 'on: arda'] }], error: 'map.on: one of middle-earth, beleriand, aman, numenor (got "arda")' },
  { name: 'a position without x', changes: [{ file: 'places/rivendell.yaml', replace: ['map: { on: middle-earth, x: 34, z: -7, radius: 1 }', 'map: { on: middle-earth, z: -7 }'] }], error: 'map.x: required' },
  { name: 'a position that is not a number', changes: [{ file: 'places/rivendell.yaml', replace: ['map: { on: middle-earth, x: 34, z: -7, radius: 1 }', 'map: { on: middle-earth, x: east, z: -7 }'] }], error: 'map.x: a finite number' },
  { name: 'a position off every map', changes: [{ file: 'places/rivendell.yaml', replace: ['map: { on: middle-earth, x: 34, z: -7, radius: 1 }', 'map: { on: middle-earth, x: 3400, z: -7 }'] }], error: 'map.x: 3400 is off every map' },
  { name: 'a region with no size', changes: [{ file: 'places/rivendell.yaml', replace: ['radius: 1', 'radius: 0'] }], error: 'map.radius: a positive number' },
  { name: 'a place on one map twice', changes: [{ file: 'places/rivendell.yaml', replace: ['map: { on: middle-earth, x: 34, z: -7, radius: 1 }', 'map:\n  - { on: middle-earth, x: 34, z: -7 }\n  - { on: middle-earth, x: 1, z: 2 }'] }], error: 'map[1].on: "middle-earth" twice (one position per map)' },
  { name: 'a position that is not a mapping', changes: [{ file: 'places/rivendell.yaml', replace: ['map: { on: middle-earth, x: 34, z: -7, radius: 1 }', 'map: somewhere'] }], error: 'map: expected { on, x, z }, a list of those, or the word `nowhere`' },

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

  // What is foretold
  { name: 'foretold age with an axis', changes: [...FORETOLD, { file: 'ages/foretold.yaml', replace: ['timeless: true', 'axis: { start: 9000 }'] }], error: 'a foretold age must be timeless' },
  { name: 'foretold age before a dated age', changes: [...FORETOLD, { file: 'ages/foretold.yaml', replace: ['order: 7', 'order: 1'] }], error: 'order: a foretold age comes after every dated age' },
  { name: 'foretold event without a source', changes: [...FORETOLD, { file: END, replace: ['source: { book: the-lost-road, chapter: Quenta Silmarillion }', ''] }], error: 'source: required for what is foretold' },
  { name: 'note without English', changes: [{ file: LETTERS, replace: ['status: outline', 'status: outline\nnote: { es: Una nota }'] }], error: 'note: needs an English text (en)' },
  { name: 'foretoldBy outside a foretold age', changes: [{ file: LETTERS, replace: ['status: outline', 'status: outline\nforetoldBy: gandalf'] }], error: 'foretoldBy: only for events in a foretold age' },
  { name: 'foretoldBy an unknown character', changes: [...FORETOLD, { file: END, replace: ['foretoldBy: bilbo', 'foretoldBy: mandos'] }], error: 'foretoldBy: unknown character "mandos"' },

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

  // Arcs that tell their own story over the map (docs/DESIGN.md §4.10)
  { name: 'an arc that is both a flat file and a folder', changes: [{ file: 'arcs/the-ride.yaml', write: 'id: the-ride\ntitle: { en: The Ride, es: La Cabalgada }\nsummary: { en: X., es: X. }\n' }], error: 'also exists as arcs/the-ride.yaml: an arc is either one flat file or a folder' },
  { name: 'an arc folder with no arc.yaml', changes: [{ file: RIDE, remove: true }], error: 'an arc folder needs an arc.yaml' },
  { name: 'an arc status the pipeline has not got', changes: [{ file: RIDE, replace: ['status: staged', 'status: finished'] }], error: 'status: one of outline, scripted, staged, animated' },
  { name: 'a scripted arc with no narration.yaml', changes: [{ file: 'arcs/the-quest.yaml', replace: ['summary:', 'status: scripted\nsummary:'] }], error: 'status "scripted" needs a narration.yaml' },
  { name: 'a staged arc with no staging.yaml', changes: [{ file: RIDE_STAGING, remove: true }], error: 'status "staged" needs a staging.yaml' },
  { name: 'an arc narrated by an age that does not exist', changes: [{ file: RIDE, replace: ['status: staged', 'status: staged\nnarratedBy: fifth-age'] }], error: 'narratedBy: unknown age "fifth-age"' },
  { name: 'an arc id that collides with an event id', changes: [{ file: RIDE, replace: ['id: the-ride', 'id: leaving'] }], error: 'an arc that tells cannot share an id with an event ("leaving")' },
  { name: 'an arc beat with no time', changes: [{ file: RIDE_STAGING, replace: ['beats: { out: 0.2 }', 'beats: { away: 0.2 }'] }], error: 'beats: no beat "away" in arc.yaml' },
  { name: 'an arc on no map we draw', changes: [{ file: RIDE_STAGING, replace: ['map: middle-earth', 'map: arda'] }], error: 'map: one of middle-earth, beleriand, aman, numenor (got "arda")' },
  { name: 'an arc telling with no duration', changes: [{ file: RIDE_STAGING, replace: ['duration: 30', 'duration: 0'] }], error: 'duration: seconds, a positive number' },
  { name: 'light at map scale', changes: [{ file: RIDE_STAGING, replace: ['map: middle-earth', 'map: middle-earth\nlight:\n  - { t: 0, preset: dawn }'] }], error: 'light: not at map scale' },
  { name: 'sound at map scale', changes: [{ file: RIDE_STAGING, replace: ['map: middle-earth', 'map: middle-earth\nsound:\n  - { t: 0, cue: knock }'] }], error: 'sound: not at map scale' },
  { name: 'reveal at map scale', changes: [{ file: RIDE_STAGING, replace: ['map: middle-earth', 'map: middle-earth\nreveal:\n  - { t: 0, cover: roof, amount: 1 }'] }], error: 'reveal: not at map scale' },
  { name: 'armies at map scale', changes: [{ file: RIDE_STAGING, replace: ['map: middle-earth', 'map: middle-earth\narmies: []'] }], error: 'armies: not at map scale' },
  // `camera` is the event's framing at a different scale, so only its limits change.
  { name: 'an arc camera pointed off every map', changes: [{ file: RIDE_STAGING, replace: ['{ t: 0, x: 0, z: 0, width: 80 }', '{ t: 0, x: 900, z: 0, width: 80 }'] }], error: 'camera[0]: x and z are a point on the map, within ±500 units' },
  { name: 'an arc camera holding no ground', changes: [{ file: RIDE_STAGING, replace: ['width: 80', 'width: 0'] }], error: 'camera[0].width: how much ground to hold in frame, 1 to 1000 map units' },
  // `scenes`: the arc's own events, when the telling reaches each
  { name: 'a scene that is not an event of the arc', changes: [{ file: RIDE_STAGING, replace: ['the-party: 0.1', 'moon-letters: 0.1'] }], error: 'scenes: "moon-letters" is not an event of this arc' },
  { name: 'a scene at no time', changes: [{ file: RIDE_STAGING, replace: ['the-party: 0.1', 'the-party: 1.4'] }], error: 'scenes.the-party: needs a time 0–1' },
  { name: 'scenes out of the arc\'s story order', changes: [{ file: RIDE_STAGING, replace: ['scenes: { the-party: 0.1, leaving: 0.6 }', 'scenes: { the-party: 0.6, leaving: 0.1 }'] }], error: 'scenes.leaving: at 0.1, before "the-party" at 0.6, which comes earlier in the arc\'s story order' },
  { name: 'an arc event whose place is on another map', changes: [{ file: RIDE_STAGING, replace: ['map: middle-earth', 'map: beleriand'] }], error: 'the arc\'s event "the-party": "bag-end" has no position on the beleriand map' },
  { name: 'an arc event with no place at all', changes: [{ file: 'events/third-age/2941-07-leaving/event.yaml', replace: ['place: rivendell\n', ''] }], error: 'the arc\'s event "leaving" has no place, so the map cannot pin it' },
  // `hosts`: a body of people as a mark on the map
  { name: 'a host that is both a faction and a label', changes: [{ file: RIDE_STAGING, replace: ['  - faction: bagginses\n', '  - faction: bagginses\n    label: { en: X, es: X }\n    color: "#8fb6c8"\n'] }], error: 'hosts[0]: a faction, or a label and a color of its own — never both' },
  { name: 'a host that is neither', changes: [{ file: RIDE_STAGING, replace: ['  - faction: bagginses\n', '  - \n'] }], error: 'hosts[0]: needs a faction, or a label and a color of its own' },
  { name: 'a host of an unknown faction', changes: [{ file: RIDE_STAGING, replace: ['faction: bagginses', 'faction: tooks'] }], error: 'hosts[0].faction: unknown faction "tooks"' },
  { name: 'a labelled host with no colour', changes: [{ file: RIDE_STAGING, replace: ['    color: "#8fb6c8"\n', ''] }], error: 'hosts[1].color: the colour to draw it in, as #rrggbb' },
  { name: 'a mark the map cannot draw', changes: [{ file: RIDE_STAGING, replace: ['mark: column', 'mark: horde'] }], error: 'hosts[0].mark: one of column, mass, swarm, trickle, fleet, flight' },
  { name: 'a host weight that is a count of soldiers', changes: [{ file: RIDE_STAGING, replace: ['weight: 2', 'weight: 8000'] }], error: 'hosts[0].weight: 1 to 5 — how much of the country the mark fills, never a number of soldiers' },
  { name: 'a host with no weight', changes: [{ file: RIDE_STAGING, replace: ['    weight: 2\n', ''] }], error: 'hosts[0].weight: 1 to 5' },
  { name: 'a host with no keyframes', changes: [{ file: RIDE_STAGING, replace: ['    keyframes:\n      - { t: 0.1, at: bag-end, action: hold }\n', '    keyframes: []\n'] }], error: 'hosts[0].keyframes: at least one { t, at | x + z, action }' },
  { name: 'a host keyframe at a place and a point at once', changes: [{ file: RIDE_STAGING, replace: ['{ t: 0.1, at: bag-end, action: hold }', '{ t: 0.1, at: bag-end, x: 1, z: 2, action: hold }'] }], error: 'hosts[0].keyframes[0]: exactly one of `at` (a place) or `x`/`z`' },
  { name: 'a host keyframe nowhere at all', changes: [{ file: RIDE_STAGING, replace: ['{ t: 0.1, at: bag-end, action: hold }', '{ t: 0.1, action: hold }'] }], error: 'hosts[0].keyframes[0]: exactly one of `at` (a place) or `x`/`z`' },
  { name: 'a host keyframe at an unknown place', changes: [{ file: RIDE_STAGING, replace: ['{ t: 0.1, at: bag-end, action: hold }', '{ t: 0.1, at: hobbiton, action: hold }'] }], error: 'hosts[0].keyframes[0].at: unknown place "hobbiton"' },
  { name: 'a host keyframe off every map', changes: [{ file: RIDE_STAGING, replace: ['{ t: 0.5, x: 10, z: -4, action: march, mark: trickle, weight: 1 }', '{ t: 0.5, x: 900, z: -4, action: march }'] }], error: 'hosts[0].keyframes[1].x: 900 is off every map' },
  { name: 'a host doing something the map has no word for', changes: [{ file: RIDE_STAGING, replace: ['action: march', 'action: walk'] }], error: 'hosts[0].keyframes[1].action: one of march, ride, sail, fly, flee, hold, fight, fade' },
  { name: 'host keyframes out of order', changes: [{ file: RIDE_STAGING, replace: ['{ t: 0.6, at: rivendell, action: hold }', '{ t: 0.2, at: rivendell, action: hold }'] }], error: 'hosts[0].keyframes[2]: t must rise from 0 to 1' },
  // `roads`: a journey painted along its waypoints
  { name: 'a road along an unknown journey', changes: [{ file: RIDE_STAGING, replace: ['journey: the-road', 'journey: the-sea'] }], error: 'roads[0].journey: unknown journey "the-sea"' },
  { name: 'a road that ends before it starts', changes: [{ file: RIDE_STAGING, replace: ['from: 0.2, to: 0.8', 'from: 0.8, to: 0.2'] }], error: 'roads[0]: from (0.8) must come before to (0.2)' },
  { name: 'a road outside the telling', changes: [{ file: RIDE_STAGING, replace: ['from: 0.2, to: 0.8', 'from: 0.2, to: 1.8'] }], error: 'roads[0].to: a time 0–1' },

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

  // Factions, sides and armies
  { name: 'faction without English', changes: [{ file: 'factions/bagginses.yaml', replace: ['name: { en: The Bagginses, es: Los Bolsón }', 'name: { es: Los Bolsón }'] }], error: 'factions/bagginses.yaml: name: needs an English text (en)' },
  { name: 'faction with a bad colour', changes: [{ file: 'factions/bagginses.yaml', replace: ['"#6a8a3a"', 'green'] }], error: 'color: the banner colour, as #rrggbb' },
  { name: 'faction without kind', changes: [{ file: 'factions/bagginses.yaml', replace: ['kind: hobbit\n', ''] }], error: 'kind: required, a character kind' },
  { name: 'faction with an unknown leader', changes: [{ file: 'factions/bagginses.yaml', replace: ['[ bilbo ]', '[ bilbo, lobelia ]'] }], error: 'leaders: unknown character "lobelia"' },
  { name: 'sides with an unknown faction', changes: [{ file: `${PARTY}/event.yaml`, replace: ['[ sackville-bagginses ]', '[ sackville-bagginses, proudfoots ]'] }], error: 'sides: unknown faction "proudfoots"' },
  { name: 'a faction on two sides', changes: [{ file: `${PARTY}/event.yaml`, replace: ['[ sackville-bagginses ]', '[ sackville-bagginses, bagginses ]'] }], error: 'sides: "bagginses" is listed twice' },
  { name: 'only one side', changes: [{ file: `${PARTY}/event.yaml`, replace: ['sides: [ [ bagginses ], [ sackville-bagginses ] ]', 'sides: [ [ bagginses, sackville-bagginses ] ]'] }], error: 'sides: a list of at least two sides' },
  { name: 'army of a faction not on the sides', changes: [{ file: `${PARTY}/event.yaml`, replace: ['sides: [ [ bagginses ], [ sackville-bagginses ] ]', ''] }], error: 'armies[0]: "bagginses" is not on the event\'s sides' },
  { name: 'army of an unknown size', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['size: small', 'size: huge'] }], error: 'armies[0].size: one of small, medium, large' },
  { name: 'army keyframes not rising', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['{ t: 0.5, x: -1', '{ t: -0.2, x: -1'] }], error: 'armies[0].keyframes[1]: t must rise from 0 to 1' },
  { name: 'army with an unknown action', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['action: walk }\n', 'action: talk }\n'] }], error: 'armies[0].keyframes[1].action: one of idle, walk, run, fight' },

  // Staging and recordings
  { name: 'unknown stage', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['stage: diorama', 'stage: film'] }], error: 'stage: one of cosmos, diorama' },
  { name: 'narration not rising', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['{ door: 0, tea: 0.5 }', '{ door: 0.6, tea: 0.5 }'] }], error: 'narration.tea: starts before the passage before it' },
  { name: 'narration passage without a time', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['{ door: 0, tea: 0.5 }', '{ door: 0 }'] }], error: 'narration.tea: needs a time 0–1' },
  { name: 'timing for an unknown passage', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['tea: 0.5 }', 'tea: 0.5, cake: 0.9 }'] }], error: 'narration: no passage "cake" in narration.yaml' },
  { name: 'unknown beat', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['{ knock: 0.1 }', '{ knock: 0.1, song: 0.8 }'] }], error: 'beats: no beat "song" in event.yaml' },
  { name: 'track for a character not in the event', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['characterId: bilbo', 'characterId: thorin'] }], error: 'tracks[0]: "thorin" is not in the event\'s characters' },
  { name: 'keyframes not rising', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['{ t: 1, x: 1', '{ t: -0.5, x: 1'] }], error: 't must rise from 0 to 1' },
  // `y` is how high above the ground a figure stands — on a log, a bench, a doorstep (#81).
  // A tile is 14 units across, so a height in metres or centimetres is a typo, not a balcony.
  { name: 'a keyframe standing absurdly high', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['{ t: 0, x: 0, z: 0,', '{ t: 0, x: 0, z: 0, y: 40,'] }], error: 'keyframes[0].y: expected a height in tile units, -1 to 4' },
  { name: 'timing file without a recording', changes: [{ file: `${PARTY}/audio/en.yaml`, write: 'duration: 20\n' }], error: 'timing file without a recording next to it' },
  { name: 'recording without a timing file', changes: [{ file: `${PARTY}/audio/es.mp3`, write: '' }], error: 'recording without es.yaml' },
  { name: 'recording starts out of order', changes: [{ file: `${PARTY}/audio/en.yaml`, write: 'duration: 20\nstarts: { door: 10, tea: 4 }\n' }, { file: `${PARTY}/audio/en.mp3`, write: '' }], error: 'starts.tea: earlier than the passage before it' },
  { name: 'textHash not a hash', changes: [{ file: `${PARTY}/audio/en.yaml`, write: 'duration: 20\ntextHash: 12\n' }, { file: `${PARTY}/audio/en.mp3`, write: '' }], error: 'textHash: expected sha256: and 16 hex digits' },
  // Models (docs/MODELS.md)
  { name: 'missing model', changes: [{ file: GANDALF, replace: [TEST_MODEL, 'characters/gandalf/gandalf.glb'] }], error: 'model: assets/characters/gandalf/gandalf.glb not found' },
  { name: 'model over its budget', changes: [{ file: `../assets/${TEST_MODEL}`, write: new Uint8Array(300_001) }], error: /over the characters budget of 300 kB/ },
  { name: 'model not a .glb path', changes: [{ file: GANDALF, replace: [TEST_MODEL, '../gandalf.gltf'] }], error: 'model: a .glb path under assets/' },
  { name: 'character model outside characters/', changes: [{ file: GANDALF, replace: [TEST_MODEL, 'props/staff.glb'] }], error: 'model: expected a model under characters/' },
  { name: 'model of an unknown asset type', changes: [{ file: GANDALF, replace: [TEST_MODEL, 'people/gandalf.glb'] }], error: '"people/" is not an asset type' },
  { name: 'model that is not glTF', changes: [{ file: `../assets/${TEST_MODEL}`, write: 'not a model' }], error: 'not a binary glTF (.glb)' },
  { name: 'model with Draco', changes: [{ file: `../assets/${TEST_MODEL}`, write: glb({ scenes: [{}], extensionsUsed: ['KHR_draco_mesh_compression'] }) }], error: 'uses KHR_draco_mesh_compression' },
  { name: 'missing per-event model', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['characterId: bilbo\n', 'characterId: bilbo\n    model: characters/bilbo/barrel.glb\n'] }], error: 'tracks[0].model: assets/characters/bilbo/barrel.glb not found' },
  { name: 'becomes without a time', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['characterId: bilbo\n', `characterId: bilbo\n    becomes: { model: ${TEST_MODEL} }\n`] }], error: 'tracks[0].becomes: expected { t: 0–1, model }' },
  { name: 'becomes a model that is missing', changes: [{ file: `${PARTY}/staging.yaml`, replace: ['characterId: bilbo\n', 'characterId: bilbo\n    becomes: { t: 0.8, model: characters/bilbo/stone.glb }\n'] }], error: 'tracks[0].becomes.model: assets/characters/bilbo/stone.glb not found' },
  { name: 'set that is not a kit', changes: [withSet(`set: ${TEST_MODEL}\n`)], error: 'set: expected a model under kits/' },
  { name: 'missing set', changes: [withSet('set: kits/shire/nowhere.glb\n')], error: 'set: assets/kits/shire/nowhere.glb not found' },
  { name: 'light of an unknown preset', changes: [withSet('light:\n  - { t: 0, preset: twilight }\n')], error: 'light[0].preset: one of dawn, morning, day, evening, dusk, night' },
  { name: 'light keys out of order', changes: [withSet('light:\n  - { t: 0.5, preset: day }\n  - { t: 0.2, preset: dusk }\n')], error: 'light[1]: t must rise' },
  { name: 'light without a time', changes: [withSet('light:\n  - { preset: day }\n')], error: 'light[0]: needs a time t, 0–1' },
  // The framing (#28): a look-at point on the tile, and how much ground to hold around it.
  { name: 'camera looking off the tile', changes: [withSet('camera:\n  - { t: 0, x: 40, z: 0, width: 6 }\n')], error: 'camera[0]: x and z are a point on the tile, -7 to 7' },
  { name: 'camera framing less than a figure', changes: [withSet('camera:\n  - { t: 0, x: 0, z: 0, width: 0.4 }\n')], error: 'camera[0].width: how much ground to hold in frame, 2 to 30 tile units' },
  { name: 'camera keys out of order', changes: [withSet('camera:\n  - { t: 0.5, x: 0, z: 0, width: 6 }\n  - { t: 0.2, x: 1, z: 1, width: 4 }\n')], error: 'camera[1]: t must rise' },
  { name: 'camera without a time', changes: [withSet('camera:\n  - { x: 0, z: 0, width: 6 }\n')], error: 'camera[0]: needs a time t, 0–1' },
  // Covers the set lifts away: the name has to be one the kit really has.
  { name: 'reveal of a cover the kit has not got', changes: withKit('reveal:\n  - { t: 0, cover: chimney, amount: 1 }\n'), error: 'reveal[0].cover: the set has no cover "chimney" (it has roof)' },
  { name: 'reveal with no set to lift', changes: [withSet('reveal:\n  - { t: 0, cover: hill, amount: 1 }\n')], error: 'reveal: only a set has covers to lift; add set: <kit>.glb' },
  { name: 'reveal lifted past the top', changes: withKit('reveal:\n  - { t: 0, cover: roof, amount: 1.4 }\n'), error: 'reveal[0].amount: 0 (closed) to 1 (lifted away)' },
  { name: 'reveal keys out of order', changes: withKit('reveal:\n  - { t: 0.6, cover: roof, amount: 1 }\n  - { t: 0.2, cover: roof, amount: 0 }\n'), error: 'reveal[1]: t must rise within a cover' },
  // One-shot sounds: the vocabulary is closed, because a cue the engine cannot make is silence.
  { name: 'a sound cue nothing can make', changes: [withSet('sound:\n  - { t: 0.3, cue: dragonfire }\n')], error: 'sound[0].cue: one of knock, door' },
  { name: 'a footstep placed by hand', changes: [withSet('sound:\n  - { t: 0.3, cue: step }\n')], error: 'sound[0].cue: one of knock, door' },
  { name: 'a sound without a time', changes: [withSet('sound:\n  - { cue: knock }\n')], error: 'sound[0]: needs a time t, 0–1' },
  { name: 'sound keys out of order', changes: [withSet('sound:\n  - { t: 0.6, cue: knock }\n  - { t: 0.2, cue: door }\n')], error: 'sound[1]: t must rise' },
  { name: 'a sound louder than anything should be', changes: [withSet('sound:\n  - { t: 0.3, cue: knock, gain: 4 }\n')], error: "sound[0].gain: louder or softer than the cue's own level, 0–2" },
  // Parentage: the one authored edge, and everything checked about it (docs/DESIGN.md §4.11).
  { name: 'an unknown parent', changes: [{ file: BILBO, replace: ['[ bungo, belladonna ]', '[ bungo, bilba ]'] }], error: 'parents: unknown character "bilba"' },
  { name: 'three parents', changes: [{ file: BILBO, replace: ['[ bungo, belladonna ]', '[ bungo, belladonna, mungo ]'] }], error: 'parents: at most two' },
  { name: 'the same parent twice', changes: [{ file: BILBO, replace: ['[ bungo, belladonna ]', '[ bungo, bungo ]'] }], error: 'parents: "bungo" is listed twice' },
  { name: 'a character who is their own parent', changes: [{ file: BILBO, replace: ['[ bungo, belladonna ]', '[ bilbo ]'] }], error: 'parents: a character cannot be their own parents' },
  { name: 'a parentage cycle', changes: [{ file: MUNGO, replace: ['kind: hobbit', 'kind: hobbit\nparents: [ bilbo ]'] }], error: 'a parentage cycle (' },
  { name: 'a spouse who is also a parent', changes: [{ file: BILBO, replace: ['home: bag-end', 'spouse: [ bungo ]\nhome: bag-end'] }], error: 'spouse: "bungo" is also a parent or child of "bilbo"' },
  { name: 'an unknown spouse', changes: [{ file: BUNGO, replace: ['spouse: [ belladonna ]', 'spouse: [ bellazonna ]'] }], error: 'spouse: unknown character "bellazonna"' },
  { name: 'a twin who shares no parent', changes: [{ file: BILBO, replace: ['home: bag-end', 'twin: gandalf\nhome: bag-end'] }], error: 'twin: "gandalf" shares no parent with "bilbo"' },
  { name: 'a twin who is not mutual', changes: [...TWINS, char('porto', 'parents: [ bungo, belladonna ]\ntwin: bilbo\n')], error: 'twin: "porto" is the twin of "bilbo", not of "ponto"' },
  { name: 'a character who is their own twin', changes: [{ file: BILBO, replace: ['home: bag-end', 'twin: bilbo\nhome: bag-end'] }], error: 'twin: a character cannot be their own twin' },
  { name: 'an unknown kin', changes: [{ file: BILBO, replace: ['home: bag-end', 'kin:\n  - { id: bungus, as: kin }\nhome: bag-end'] }], error: 'kin: unknown character "bungus"' },
  { name: 'a birth declared for someone not in the scene', changes: [{ file: LETTERS, replace: ['status: outline', 'status: outline\nborn: [ bungo ]'] }], error: 'born: "bungo" is not in the event\'s characters' },
  { name: 'a death declared for someone not in the scene', changes: [{ file: LETTERS, replace: ['status: outline', 'status: outline\ndied: [ bungo ]'] }], error: 'died: "bungo" is not in the event\'s characters' },
  { name: 'two events declaring one birth', changes: [
    { file: LETTERS, replace: ['status: outline', 'status: outline\nborn: [ bilbo ]'] },
    { file: `${PARTY}/event.yaml`, replace: ['status: staged', 'status: staged\nborn: [ bilbo ]'] },
  ], error: 'already declares this birth of "bilbo"' },
  { name: 'a stated date outside the event that declares it', changes: [
    { file: LETTERS, replace: ['status: outline', 'status: outline\nborn: [ bilbo ]'] },
    { file: BILBO, replace: ['home: bag-end', 'born: { date: { age: third-age, year: 2890 }, precision: year }\nhome: bag-end'] },
  ], error: 'born: outside the honest range of "moon-letters", which declares this birth' },
  { name: 'a `kin` word the closed list has not got', changes: [{ file: BILBO, replace: ['home: bag-end', 'kin:\n  - { id: bungo, as: father }\nhome: bag-end'] }], error: 'kin[0].as: "father" is derived from `parents:` now — put the parentage on the child' },
  { name: 'a `kin` word nothing can draw', changes: [{ file: BILBO, replace: ['home: bag-end', 'kin:\n  - { id: gandalf, as: friend }\nhome: bag-end'] }], error: 'kin[0].as: "friend" is not one of ancestor, descendant, cousin, sibling, kin, foster-parent, fosterling' },
  { name: 'born after died', changes: [{ file: BUNGO, replace: ['year: 2846', 'year: 2990'] }], error: 'born: after `died`' },
  { name: 'recording start past its end', changes: [{ file: `${PARTY}/audio/en.yaml`, write: 'duration: 20\nstarts: { door: 0, tea: 25 }\n' }, { file: `${PARTY}/audio/en.mp3`, write: '' }], error: 'starts.tea: needs a second within the recording' },
];

describe('broken content', () => {
  for (const c of BROKEN) {
    it(`${c.name} → ${c.error}`, () => {
      const r = buildWith(c.changes);
      expect(r.errors.some((e) => (typeof c.error === 'string' ? e.includes(c.error) : c.error.test(e))), r.errors.join('\n') || '(no errors)').toBe(true);
    });
  }

  it('warns when a `kin` entry says what the parentage already says', () => {
    const r = buildWith([{ file: BILBO, replace: ['home: bag-end', 'kin:\n  - { id: mungo, as: ancestor }\nhome: bag-end'] }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('kin[0]: "mungo" is already the grandparent of "bilbo" by `parents:`; delete this entry')), r.warnings.join('\n')).toBe(true);
  });

  it('keeps a `kin` entry the parentage cannot reach', () => {
    const r = buildWith([{ file: BILBO, replace: ['home: bag-end', 'kin:\n  - { id: gandalf, as: kin }\nhome: bag-end'] }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('warns when a parent is born after their child, rather than refusing it', () => {
    const r = buildWith([{ file: BUNGO, replace: ['year: 2846', 'year: 2920'] }, { file: BILBO, replace: ['home: bag-end', 'born: { date: { age: third-age, year: 2890 }, precision: year }\nhome: bag-end'] }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('parents: "bungo" is born after "bilbo"')), r.warnings.join('\n')).toBe(true);
  });

  it('warns when a telling arc\'s events cross ages and it names no voice', () => {
    // A voice belongs to an age (§5), so an arc whose scenes span two has to choose.
    const crossing: Change[] = [{ file: 'events/before-time/0000-the-music/event.yaml', replace: ['characters: []', 'characters: []\nplace: bag-end\narcs: [ the-ride ]'] }];
    const r = buildWith(crossing);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('its events cross ages (before-time, third-age), so say whose voice tells it')), r.warnings.join('\n')).toBe(true);
    // Naming the age settles it, and that is the voice the telling is read in.
    const named = buildWith([...crossing, { file: RIDE, replace: ['status: staged', 'status: staged\nnarratedBy: third-age'] }]);
    expect(named.warnings.filter((w) => w.includes('cross ages'))).toEqual([]);
    expect(named.index.arcs.find((a) => a.id === 'the-ride')!.voiceOf).toBe('third-age');
  });

  it('counts being named by an arc\'s telling as a reason for a faction to exist', () => {
    // Being in a telling is a reason to exist, exactly as being on a battle's sides is (§4.10).
    const faction: Change = { file: 'factions/the-watch.yaml', write: 'id: the-watch\nname: { en: The Watch, es: La Guardia }\ncolor: "#404a5a"\nkind: hobbit\nsummary: { en: Shirriffs., es: Alguaciles. }\n' };
    const alone = buildWith([faction]);
    expect(alone.warnings.some((w) => w.includes('factions/the-watch.yaml: fights in no battle yet'))).toBe(true);
    const inArc = buildWith([faction, { file: RIDE_STAGING, replace: ['  - faction: bagginses\n', '  - faction: the-watch\n'] }]);
    expect(inArc.errors).toEqual([]);
    expect(inArc.warnings).toEqual([]);
  });

  it('warns, rather than refusing, when a painted road runs through a place nobody has placed', () => {
    // The scenes and the hosts are the telling's own; a journey is written for its own sake.
    const r = buildWith([{ file: ROAD, replace: ['place: rivendell', 'place: woody-end'] }, { file: 'places/woody-end.yaml', write: 'id: woody-end\nname: { en: Woody End, es: Frontera del Bosque }\nsummary: { en: Woods., es: Bosques. }\n' }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('roads[0]: waypoints[1]: "woody-end" has no position on the middle-earth map')), r.warnings.join('\n')).toBe(true);
  });

  it('warns when an arc folder is not named after its id', () => {
    const r = buildWith([
      { file: RIDE, replace: ['id: the-ride', 'id: the-walk'] },
      { file: `${PARTY}/event.yaml`, replace: ['the-quest, the-ride', 'the-quest, the-walk'] },
      { file: 'events/third-age/2941-07-leaving/event.yaml', replace: ['the-quest, the-ride', 'the-quest, the-walk'] },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('folder "the-ride" should be named after its id "the-walk"')), r.warnings.join('\n')).toBe(true);
  });

  it('warns when a told event\'s place has no position on any map', () => {
    const r = buildWith([...NO_TELLING, { file: 'places/bag-end.yaml', replace: ['map: { on: middle-earth, x: -12.2, z: -1.3 }\n', ''] }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('places/bag-end.yaml: has no map: position, but 1 told event happens here')), r.warnings.join('\n')).toBe(true);
  });

  it('does not warn about a place deliberately on no map', () => {
    const r = buildWith([...NO_TELLING, { file: 'places/bag-end.yaml', replace: ['map: { on: middle-earth, x: -12.2, z: -1.3 }', 'map: nowhere'] }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.index.places.find((p) => p.id === 'bag-end')!.map).toBeUndefined();
  });

  it('warns when a position has a typo in a field', () => {
    const r = buildWith([{ file: 'places/rivendell.yaml', replace: ['radius: 1', 'radius: 1, y: 3'] }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('unknown field "y" in map'))).toBe(true);
  });

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

  describe('narrators', () => {
    const VOICE = 'narrators/the-voice.yaml';
    const has = (list: string[], s: string) => list.some((e) => e.includes(s));

    it('the fixture\'s narrator loads', () => {
      const r = buildWith([]);
      expect(r.narrators.map((n) => n.id)).toEqual(['the-voice']);
      expect(r.narrators[0].voices.en?.seed).toBe(7);
      expect(r.index.ages.find((a) => a.id === 'before-time')!.narrator).toBe('the-voice');
    });

    it('unknown narrator on an age', () => {
      const r = buildWith([{ file: 'ages/before-time.yaml', replace: ['narrator: the-voice', 'narrator: nobody'] }]);
      expect(has(r.errors, 'narrator: unknown narrator "nobody"'), r.errors.join('\n')).toBe(true);
    });

    it('missing reference file', () => {
      const r = buildWith([{ file: 'narrators/the-voice.en.flac', remove: true }]);
      expect(has(r.errors, 'reference: no file "the-voice.en.flac"'), r.errors.join('\n')).toBe(true);
    });

    it('reference hash mismatch', () => {
      const r = buildWith([{ file: 'narrators/the-voice.en.flac', write: 'a different voice\n' }]);
      expect(has(r.errors, 'referenceHash: does not match'), r.errors.join('\n')).toBe(true);
    });

    it('voice without refText', () => {
      const r = buildWith([{ file: VOICE, replace: ['    refText: A calm voice that tells the history.\n', ''] }]);
      expect(has(r.errors, 'refText'), r.errors.join('\n')).toBe(true);
    });

    it('staged event in an age with no narrator', () => {
      const r = buildWith([{ file: 'ages/third-age.yaml', replace: ['narrator: the-voice\n', ''] }]);
      expect(r.errors).toEqual([]);
      expect(has(r.warnings, 'has staged events but no narrator'), r.warnings.join('\n')).toBe(true);
    });
  });

  describe('pronunciation', () => {
    it('loads the list', () => {
      const r = buildWith([{ file: 'pronunciation.yaml', write: 'en: { "Eä": "EH-ah" }\n' }]);
      expect(r.errors).toEqual([]);
      expect(r.pronunciation).toEqual({ en: { 'Eä': 'EH-ah' } });
    });

    it('respellings must be text', () => {
      const r = buildWith([{ file: 'pronunciation.yaml', write: 'en: { Eä: 5 }\n' }]);
      expect(r.errors.some((e) => e.includes('pronunciation.en.Eä: must be text')), r.errors.join('\n')).toBe(true);
    });

    it('only known languages', () => {
      const r = buildWith([{ file: 'pronunciation.yaml', write: 'fr: { Eä: "E-a" }\n' }]);
      expect(r.errors.some((e) => e.includes('pronunciation: unknown language "fr"')), r.errors.join('\n')).toBe(true);
    });
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

    const door = passageHash({ id: 'door', text: { en: 'Someone knocks at the green door.' } }, 'en');
    const tea = passageHash({ id: 'tea', text: { en: 'Tea is poured for far too many guests.' } }, 'en');
    const recorded = (extra: string): Change[] => [
      { file: `${PARTY}/audio/en.yaml`, write: `duration: 20\ntextHash: ${hash}\n${extra}` },
      { file: `${PARTY}/audio/en.mp3`, write: '' },
    ];

    it('gives no warning when the passages and narrator match', () => {
      const r = buildWith(recorded(`narrator: { id: the-voice, version: 1 }\npassages: { door: ${door}, tea: ${tea} }\n`));
      expect(r.errors).toEqual([]);
      expect(r.warnings).toEqual([]);
    });

    it('per-passage stale warning', () => {
      const r = buildWith(recorded(`passages: { door: ${door}, tea: sha256:0000000000000000 }\n`));
      expect(r.warnings.filter((w) => w.includes('stale passage'))).toEqual([expect.stringContaining('stale passage "tea"')]);
    });

    it('narrator version stale', () => {
      const r = buildWith(recorded('narrator: { id: the-voice, version: 0 }\n'));
      expect(r.warnings.some((w) => w.includes('recorded with the-voice v0, now v1')), r.warnings.join('\n')).toBe(true);
    });

    it('narrator of another age', () => {
      const r = buildWith([...recorded('narrator: { id: someone-else, version: 1 }\n')]);
      expect(r.warnings.some((w) => w.includes("the age's narrator is the-voice")), r.warnings.join('\n')).toBe(true);
    });

    it('a passage added after recording warns and drops the starts, instead of failing the build', () => {
      const r = buildWith([
        { file: `${PARTY}/audio/en.yaml`, write: `duration: 20\ntextHash: ${hash}\nstarts: { door: 0.8, tea: 9 }\n` },
        { file: `${PARTY}/audio/en.mp3`, write: '' },
        { file: `${PARTY}/narration.yaml`, replace: ['- id: tea', '- id: cake\n  en: Cake runs out.\n  es: Se acaba el pastel.\n- id: tea'] },
        { file: `${PARTY}/staging.yaml`, replace: ['narration: { door: 0, tea: 0.5 }', 'narration: { door: 0, cake: 0.3, tea: 0.5 }'] },
      ]);
      expect(r.errors).toEqual([]);
      expect(r.warnings.some((w) => w.includes('en.yaml: stale recording') && w.includes('passages were added or removed')), r.warnings.join('\n')).toBe(true);
      expect(r.details.find((d) => d.id === 'the-party')!.audioFiles.en?.starts).toBeUndefined();
    });

    it('a passage removed after recording warns too', () => {
      const r = buildWith([
        { file: `${PARTY}/audio/en.yaml`, write: `duration: 20\ntextHash: ${hash}\nstarts: { door: 0.8, tea: 9, gone: 12 }\n` },
        { file: `${PARTY}/audio/en.mp3`, write: '' },
      ]);
      expect(r.errors).toEqual([]);
      expect(r.warnings.some((w) => w.includes('passages were added or removed')), r.warnings.join('\n')).toBe(true);
    });

    it('warns "stale recording" when a recorded passage changes', () => {
      const r = buildWith([...recording(hash), { file: `${PARTY}/narration.yaml`, replace: ['far too many guests', 'a great many guests'] }]);
      expect(r.errors).toEqual([]);
      expect(r.warnings.some((w) => w.includes('en.yaml: stale recording'))).toBe(true);
    });
  });

  it('warns about a faction in no battle', () => {
    const r = buildWith([{ file: 'factions/proudfoots.yaml', write: 'id: proudfoots\nname: { en: The Proudfoots, es: Los Ganapié }\ncolor: "#444444"\nkind: hobbit\nsummary: { en: Big feet., es: Pies grandes. }\n' }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('factions/proudfoots.yaml: fights in no battle yet'))).toBe(true);
  });

  it('warns about a faction kind with no army look', () => {
    const r = buildWith([{ file: 'factions/bagginses.yaml', replace: ['kind: hobbit', 'kind: ent'] }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('factions/bagginses.yaml: kind: "ent" has no army look yet'))).toBe(true);
    expect(buildWith([]).warnings.some((w) => w.includes('has no army look'))).toBe(false);
  });

  it('warns about a model that is not meshopt-compressed, has extra scenes, or clips the diorama does not play', () => {
    const r = buildWith([{ file: `../assets/${TEST_MODEL}`, write: glb({ scenes: [{}, {}], animations: [{ name: 'idle' }, { name: 'dance' }] }) }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('test-figure.glb: not meshopt-compressed'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('has 2 scenes'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('animation "dance" is not one the diorama plays'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('"idle"'))).toBe(false);
  });

  it('warns about a character model with clips but no idle', () => {
    const r = buildWith([{ file: `../assets/${TEST_MODEL}`, write: glb({ scenes: [{}], animations: [{ name: 'walk' }] }) }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('no "idle" clip'))).toBe(true);
  });

  it('warns about a Blender source too big for git', () => {
    const r = buildWith([{ file: '../assets/characters/test-figure/test-figure.blend', write: new Uint8Array(20_000_001) }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('test-figure.blend: 20 MB, over 20 MB for a Blender source'))).toBe(true);
  });

  it('carries an event\'s note for readers into the index', () => {
    const r = buildWith([{ file: LETTERS, replace: ['status: outline', 'status: outline\nnote: { en: The sources disagree., es: Las fuentes no coinciden. }'] }]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.index.events.find((e) => e.id === 'moon-letters')?.note).toEqual({ en: 'The sources disagree.', es: 'Las fuentes no coinciden.' });
  });

  it('warns about missing Spanish and unknown fields', () => {
    const r = buildWith([...NO_TELLING, { file: 'places/rivendell.yaml', write: 'id: rivendell\nname: { en: Rivendell }\nsummary: { en: A house., es: Una casa. }\nheight: 3\n' }]);
    expect(r.errors).toEqual([]);
    expect(r.missing.es).toBe(1);
    expect(r.warnings.some((w) => w.includes('unknown field "height"'))).toBe(true);
  });
});
