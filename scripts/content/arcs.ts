// Arcs: a grouping of scenes (content/arcs/<id>.yaml) and an arc that tells its own story over
// the map of its age (content/arcs/<id>/: arc.yaml + narration.yaml + staging.yaml + audio/).
// Kept apart from build.ts, which calls these with its own readers and report, exactly as
// factions.ts and kin.ts are. See docs/DESIGN.md §4.10.

import fs from 'node:fs';
import path from 'node:path';
import {
  HOST_ACTIONS, HOST_MARKS, MAP_IDS, STATUSES,
  type Arc, type ArcDetail, type ArcScene, type Beat, type CameraKey, type EventSummary,
  type Host, type HostAction, type HostKeyframe, type HostMark, type Journey, type Lang,
  type LocalizedText, type MapId, type NarrationAudio, type NarrationSegment, type Place,
  type Road, type Status,
} from '../../src/data/types.ts';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const STATUS_RANK: Record<Status, number> = { outline: 0, scripted: 1, staged: 2, animated: 3 };
/** No map we draw reaches further than this from its origin (units of ten miles): a typo guard, as in build.ts. */
const MAP_LIMIT = 500;
/** What a `camera` key may hold in frame at map scale: less than a tile is pointless, more than every map is a typo. */
const WIDTH = { min: 1, max: 2 * MAP_LIMIT };
/** What a map-scale telling has no business carrying (docs/DESIGN.md §4.10): a country has no hour and a map no lid. */
const NOT_AT_MAP_SCALE: Record<string, string> = {
  light: 'a country has no hour: the map\'s own look belongs to the map, one per age',
  sound: 'an arc\'s telling carries the voice and nothing else, as the cosmos is silent (§9.5)',
  reveal: 'a map has no lid to lift',
  tracks: 'a figure is a scene\'s business; at map scale a body of people is a `hosts` mark',
  armies: '`armies` is tile scale; at map scale use `hosts`',
  set: 'the map is the set, named by `map:`',
  stage: 'an arc plays on the map it names (`map:`), and has no `stage` to choose',
};

/** Whether a place can be drawn on the arc's map, reported as an error or (for a road's stops) a warning. */
type OnMap = (pid: string, where: string, how?: 'error' | 'warn') => boolean;

/** What build.ts lends these readers: its report and its field readers. */
export interface ArcContext {
  error(file: string, msg: string): void;
  warn(file: string, msg: string): void;
  readYaml(file: string): unknown;
  yamlFiles(dir: string): string[];
  keys(file: string, o: Obj, allowed: string[], what: string): void;
  text(file: string, v: unknown, what: string, required?: boolean): LocalizedText | undefined;
  id(file: string, v: unknown, seen: Set<string>, kind: string): string | undefined;
  /** narration.yaml, read exactly as an event's (passages with ids and their words). */
  readNarration(file: string): NarrationSegment[] | undefined;
  /** `narration:` in a staging: each passage's `t`, rising. Sets `t` on the passages in place. */
  passageTimes(file: string, s: Obj, narration: NarrationSegment[]): void;
  /** `beats:` in a staging, against the beats declared beside it. */
  beatTimes(file: string, s: Obj, beatsRaw: { id: string; label: LocalizedText }[], declaredIn: string): Beat[];
  /** audio/<lang>.{mp3,yaml} beside a telling, with the same staleness checks an event's get. */
  readRecordings(dir: string, narration: NarrationSegment[], narratorAge: string | undefined, out: string):
  { audioFiles: Partial<Record<Lang, NarrationAudio>>; langs: Lang[] };
}

/** An arc as read off disk, before its events (and so its story order) are known. */
export interface ArcRaw {
  arc: Arc;
  /** The file the arc itself came from (`arcs/<id>.yaml` or `arcs/<id>/arc.yaml`). */
  file: string;
  /** The folder, for an arc that tells; a flat grouping has none. */
  dir?: string;
  narration?: NarrationSegment[];
  beatsRaw: { id: string; label: LocalizedText }[];
  staging?: Obj;
  stagingFile?: string;
}

/**
 * Read content/arcs/: a flat `<id>.yaml` for a grouping, a folder `<id>/` with `arc.yaml`,
 * `narration.yaml` and `staging.yaml` for one that tells its own story (§4.10). Both forms are
 * read; an arc that exists as both at once is an error, since the id would name two arcs.
 *
 * The staging is read but not resolved: `scenes` is checked against the arc's events, which the
 * build only knows once every event has been read (see `resolveArcTellings`).
 */
export function readArcs(C: ArcContext, contentDir: string, ageIds: Set<string>): ArcRaw[] {
  const dir = path.join(contentDir, 'arcs');
  const flat = new Map(C.yamlFiles(dir).map((f) => [path.basename(f, '.yaml'), f]));
  const folders = fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
    : [];

  // One entry per arc, in id order: the folder wins when both forms exist, and the clash is an error.
  const entries: { name: string; file: string; dir?: string }[] = [];
  for (const name of folders) {
    const file = path.join(dir, name, 'arc.yaml');
    if (!fs.existsSync(file)) { C.error(file, 'an arc folder needs an arc.yaml (a grouping stays one flat file: docs/DESIGN.md §4.10)'); continue; }
    if (flat.has(name)) C.error(file, `also exists as arcs/${name}.yaml: an arc is either one flat file or a folder, never both (move the flat file in as arc.yaml and delete it)`);
    flat.delete(name);
    entries.push({ name, file, dir: path.join(dir, name) });
  }
  for (const [name, file] of flat) entries.push({ name, file });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const raws: ArcRaw[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const o = C.readYaml(e.file);
    if (!isObj(o)) { C.error(e.file, 'expected a mapping'); continue; }
    C.keys(e.file, o, ['id', 'title', 'summary', 'status', 'sources', 'narratedBy', 'beats'], 'arc');
    const aid = C.id(e.file, o.id, seen, 'arc');
    if (!aid) continue;
    if (e.dir && aid !== e.name) C.warn(e.file, `folder "${e.name}" should be named after its id "${aid}"`);

    // The same four words an event runs, and the same meaning (§4.3); a grouping is an outline.
    let status: Status = 'outline';
    if (o.status !== undefined) {
      if (!(STATUSES as readonly string[]).includes(String(o.status))) C.error(e.file, `status: one of ${STATUSES.join(', ')}`);
      else status = String(o.status) as Status;
    }

    // The chapters the telling is drawn from: cited, never quoted.
    let sources: Arc['sources'];
    if (o.sources !== undefined) {
      if (!Array.isArray(o.sources)) C.error(e.file, 'sources: a list of { book, chapter }');
      else {
        sources = [];
        o.sources.forEach((src, i) => {
          if (!isObj(src) || typeof src.book !== 'string') { C.error(e.file, `sources[${i}]: expected { book, chapter }`); return; }
          C.keys(e.file, src, ['book', 'chapter'], `sources[${i}]`);
          sources!.push({ book: src.book, ...src.chapter !== undefined ? { chapter: src.chapter as string | number } : {} });
        });
      }
    }

    // A voice belongs to an age, never to a story (§5): `narratedBy` only picks which age's.
    let narratedBy: string | undefined;
    if (o.narratedBy !== undefined) {
      if (typeof o.narratedBy !== 'string' || !ageIds.has(o.narratedBy)) C.error(e.file, `narratedBy: unknown age ${JSON.stringify(o.narratedBy)}`);
      else narratedBy = o.narratedBy;
    }

    const beatsRaw: ArcRaw['beatsRaw'] = [];
    const beatIds = new Set<string>();
    (Array.isArray(o.beats) ? o.beats : []).forEach((b, i) => {
      if (!isObj(b) || typeof b.id !== 'string') { C.error(e.file, `beats[${i}]: expected { id, label }`); return; }
      if (beatIds.has(b.id)) C.error(e.file, `beats: duplicate id "${b.id}"`);
      beatIds.add(b.id);
      beatsRaw.push({ id: b.id, label: C.text(e.file, b.label, `beats[${i}].label`)! });
    });
    if (o.beats !== undefined && !Array.isArray(o.beats)) C.error(e.file, 'beats: a list of { id, label }');

    const narration = e.dir ? C.readNarration(path.join(e.dir, 'narration.yaml')) : undefined;
    const stagingFile = e.dir ? path.join(e.dir, 'staging.yaml') : undefined;
    const rawStaging = stagingFile && fs.existsSync(stagingFile) ? C.readYaml(stagingFile) : undefined;
    const staging = isObj(rawStaging) ? rawStaging : undefined;
    if (rawStaging !== undefined && !staging) C.error(stagingFile!, 'expected a mapping');

    // The status must match the files present, exactly as an event's does.
    if (STATUS_RANK[status] >= STATUS_RANK.scripted && !narration) C.error(e.file, `status "${status}" needs a narration.yaml (an arc that tells is a folder: docs/DESIGN.md §4.10)`);
    if (STATUS_RANK[status] >= STATUS_RANK.staged && !staging) C.error(e.file, `status "${status}" needs a staging.yaml`);
    if (staging && STATUS_RANK[status] < STATUS_RANK.staged) C.warn(e.file, `has a staging.yaml but status is "${status}"`);

    raws.push({
      arc: {
        id: aid, title: C.text(e.file, o.title, 'title')!, summary: C.text(e.file, o.summary, 'summary')!, events: [],
        status, ...sources?.length ? { sources } : {}, ...narratedBy ? { narratedBy } : {},
      },
      file: e.file, ...e.dir ? { dir: e.dir } : {}, ...narration ? { narration } : {}, beatsRaw,
      ...staging ? { staging, stagingFile: stagingFile! } : {},
    });
  }
  return raws;
}

/** What `resolveArcTellings` needs of the rest of the content, once all of it is read. */
export interface ArcWorld {
  /** Every event by id: the arcs' scenes are pinned from their places. */
  events: Map<string, EventSummary>;
  places: Map<string, Place>;
  journeys: Map<string, Journey>;
  factionIds: Set<string>;
  /** Each event's age, for the voice that reads the telling. */
  ageOfEvent: (id: string) => string | undefined;
}

/**
 * Everything about a telling that needs the rest of the content: its voice, its map, and the
 * checks §4.10 asks for — every place its events, hosts and roads name placed on the map it
 * names, every `scenes` id an event of this arc, every `t` in 0–1 and in the arc's story order.
 */
export function resolveArcTellings(C: ArcContext, raws: ArcRaw[], W: ArcWorld): ArcDetail[] {
  const details: ArcDetail[] = [];
  for (const r of raws) {
    const arc = r.arc;
    if (!r.narration && !r.staging) continue;

    // Who reads it: the narrator of the age of its first event in story order (§5), unless the
    // arc names an age because its events cross one.
    const ages = [...new Set(arc.events.map((id) => W.ageOfEvent(id)).filter((a): a is string => !!a))];
    if (ages.length > 1 && !arc.narratedBy) {
      C.warn(r.file, `its events cross ages (${ages.join(', ')}), so say whose voice tells it: narratedBy: <age id> (docs/DESIGN.md §4.10)`);
    }
    const voiceOf = arc.narratedBy ?? ages[0];
    if (voiceOf) arc.voiceOf = voiceOf;

    // The narration as a script, under the arc's own namespace, so a recording of an arc can
    // never be written over an event's (§4.10).
    if (W.events.has(arc.id)) C.error(r.file, `an arc that tells cannot share an id with an event ("${arc.id}"): their narration would record over each other`);

    if (!r.staging || !r.stagingFile) continue;
    const s = r.staging, sf = r.stagingFile;
    C.keys(sf, s, ['map', 'duration', 'narration', 'beats', 'camera', 'scenes', 'hosts', 'roads'], 'arc staging');
    for (const [k, why] of Object.entries(NOT_AT_MAP_SCALE)) {
      if (s[k] !== undefined) C.error(sf, `${k}: not at map scale — ${why} (docs/DESIGN.md §4.10)`);
    }

    const map = String(s.map) as MapId;
    if (!(MAP_IDS as readonly string[]).includes(map)) { C.error(sf, `map: one of ${MAP_IDS.join(', ')} (got ${JSON.stringify(s.map)})`); continue; }
    if (!(typeof s.duration === 'number' && s.duration > 0)) C.error(sf, 'duration: seconds, a positive number');

    /**
     * Can this place carry a mark or a diamond on the map the arc plays on? A telling that
     * cannot place its own scenes or hosts is an error (§4.10). A journey is written for its own
     * sake and may legitimately run through a place nobody has placed yet, and a road is drawn
     * from the waypoints that can be drawn, so an unplaced stop on one is a warning: the leg is
     * a stretch of road left out, not a telling that cannot be shown.
     */
    const onMap = (pid: string, where: string, how: 'error' | 'warn' = 'error'): boolean => {
      const p = W.places.get(pid);
      if (!p) { C[how](sf, `${where}: unknown place "${pid}"`); return false; }
      if (!p.map?.some((m) => m.on === map)) {
        C[how](sf, `${where}: "${pid}" has no position on the ${map} map, so it cannot be drawn (content/places/${pid}.yaml \`map:\`, docs/MAP.md)`);
        return false;
      }
      return true;
    };

    const narration = (r.narration ?? []).map((p) => ({ ...p }));
    C.passageTimes(sf, s, narration);
    const beats = C.beatTimes(sf, s, r.beatsRaw, 'arc.yaml');

    // Every event of the arc is pinned from its place, so every one of them needs coordinates:
    // a telling that cannot place half its scenes is an error, not a map with holes in it.
    for (const id of arc.events) {
      const ev = W.events.get(id)!;
      if (!ev.place) C.error(sf, `the arc's event "${id}" has no place, so the map cannot pin it`);
      else onMap(ev.place, `the arc's event "${id}"`);
    }

    const scenes = readScenes(C, sf, s.scenes, arc);
    const hosts = readHosts(C, sf, s.hosts, W, onMap);
    const roads = readRoads(C, sf, s.roads, W, onMap);
    const camera = readCamera(C, sf, s.camera);

    const rec = r.dir && fs.existsSync(path.join(r.dir, 'audio'))
      ? C.readRecordings(path.join(r.dir, 'audio'), narration, voiceOf, `data/audio/arc/${arc.id}`)
      : { audioFiles: {}, langs: [] as Lang[] };
    if (rec.langs.length) arc.audio = rec.langs;
    arc.map = map;

    details.push({
      ...arc, map, durationSeconds: Number(s.duration), narration, beats,
      ...camera?.length ? { camera } : {}, scenes, hosts, roads, audioFiles: rec.audioFiles,
    });
  }
  return details;
}

/**
 * `scenes`: which of the arc's events the telling stops at, and when. The diamonds are not
 * authored — every event of the arc is derived and carries a place — so this says only when the
 * words arrive, and the `t`s must rise in the arc's own story order.
 */
function readScenes(C: ArcContext, sf: string, v: unknown, arc: Arc): ArcScene[] {
  if (v === undefined) return [];
  if (!isObj(v)) { C.error(sf, 'scenes: a mapping of event id to a time 0–1'); return []; }
  const times = new Map<string, number>();
  for (const [id, t] of Object.entries(v)) {
    if (!arc.events.includes(id)) { C.error(sf, `scenes: "${id}" is not an event of this arc`); continue; }
    if (typeof t !== 'number' || t < 0 || t > 1) { C.error(sf, `scenes.${id}: needs a time 0–1`); continue; }
    times.set(id, t);
  }
  // In story order, so a telling cannot claim the city fell before it was founded.
  const scenes: ArcScene[] = [];
  let last: { id: string; t: number } | undefined;
  for (const id of arc.events) {
    const t = times.get(id);
    if (t === undefined) continue;
    if (last && t < last.t) C.error(sf, `scenes.${id}: at ${t}, before "${last.id}" at ${last.t}, which comes earlier in the arc's story order`);
    last = { id, t };
    scenes.push({ event: id, t });
  }
  return scenes;
}

/** `hosts`: a body of people as a mark on the map, moving between keyframes (§4.10). */
function readHosts(C: ArcContext, sf: string, v: unknown, W: ArcWorld, onMap: OnMap): Host[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) { C.error(sf, 'hosts: a list of { faction | label + color, mark, weight, keyframes }'); return []; }
  const hosts: Host[] = [];
  v.forEach((h, i) => {
    const what = `hosts[${i}]`;
    if (!isObj(h)) { C.error(sf, `${what}: expected { mark, weight, keyframes } with a faction or a label`); return; }
    C.keys(sf, h, ['faction', 'label', 'color', 'mark', 'weight', 'keyframes'], what);

    // A fighting side is a faction and says the same words everywhere; refugees are not a side
    // in anybody's battle, and a faction file for them would claim they fought something.
    let faction: string | undefined;
    let label: LocalizedText | undefined;
    let color: string | undefined;
    const named = h.label !== undefined || h.color !== undefined;
    if (h.faction !== undefined && named) {
      C.error(sf, `${what}: a faction, or a label and a color of its own — never both (docs/DESIGN.md §4.10)`);
    } else if (h.faction !== undefined) {
      if (typeof h.faction !== 'string' || !W.factionIds.has(h.faction)) C.error(sf, `${what}.faction: unknown faction ${JSON.stringify(h.faction)}`);
      else faction = h.faction;
    } else if (named) {
      label = C.text(sf, h.label, `${what}.label`);
      if (!/^#[0-9a-f]{6}$/i.test(String(h.color ?? ''))) C.error(sf, `${what}.color: the colour to draw it in, as #rrggbb`);
      else color = String(h.color).toLowerCase();
    } else {
      C.error(sf, `${what}: needs a faction, or a label and a color of its own`);
    }

    const mark = h.mark as HostMark;
    if (!(HOST_MARKS as readonly string[]).includes(String(h.mark))) C.error(sf, `${what}.mark: one of ${HOST_MARKS.join(', ')}`);
    const weight = readWeight(C, sf, h.weight, `${what}.weight`, true);

    const keyframes: HostKeyframe[] = [];
    if (!Array.isArray(h.keyframes) || !h.keyframes.length) C.error(sf, `${what}.keyframes: at least one { t, at | x + z, action }`);
    else {
      let lt = -1;
      h.keyframes.forEach((k, j) => {
        const kw = `${what}.keyframes[${j}]`;
        if (!isObj(k) || typeof k.t !== 'number') { C.error(sf, `${kw}: needs a time t, 0–1`); return; }
        C.keys(sf, k, ['t', 'at', 'x', 'z', 'action', 'mark', 'weight'], kw);
        if (k.t < lt || k.t < 0 || k.t > 1) C.error(sf, `${kw}: t must rise from 0 to 1`);
        lt = k.t;
        // A place wherever one exists: it reads better than numbers and survives the map being
        // redrawn. x/z are for a point that is no place — a pass, a crossing, open sea.
        const hasAt = k.at !== undefined;
        const hasXZ = k.x !== undefined || k.z !== undefined;
        let at: string | undefined;
        let x: number | undefined;
        let z: number | undefined;
        if (hasAt === hasXZ) {
          C.error(sf, `${kw}: exactly one of \`at\` (a place) or \`x\`/\`z\` (a point that is no place)`);
        } else if (hasAt) {
          if (typeof k.at !== 'string') C.error(sf, `${kw}.at: a place id`);
          else if (onMap(k.at, `${kw}.at`)) at = k.at;
        } else {
          for (const key of ['x', 'z'] as const) {
            const n = k[key];
            if (typeof n !== 'number' || !Number.isFinite(n)) C.error(sf, `${kw}.${key}: a finite number of map units (one unit ten miles)`);
            else if (Math.abs(n) > MAP_LIMIT) C.error(sf, `${kw}.${key}: ${n} is off every map (keep it within ±${MAP_LIMIT} units)`);
            else if (key === 'x') x = n; else z = n;
          }
        }
        let action: HostAction | undefined;
        if (k.action !== undefined) {
          if (!(HOST_ACTIONS as readonly string[]).includes(String(k.action))) C.error(sf, `${kw}.action: one of ${HOST_ACTIONS.join(', ')}`);
          else action = String(k.action) as HostAction;
        }
        // A keyframe may change the mark or the weight from there on: a column that arrives and
        // becomes a mass besieging a city is one body of people, not two hosts.
        let keyMark: HostMark | undefined;
        if (k.mark !== undefined) {
          if (!(HOST_MARKS as readonly string[]).includes(String(k.mark))) C.error(sf, `${kw}.mark: one of ${HOST_MARKS.join(', ')}`);
          else keyMark = String(k.mark) as HostMark;
        }
        const keyWeight = k.weight === undefined ? undefined : readWeight(C, sf, k.weight, `${kw}.weight`, false);
        keyframes.push({
          t: k.t, ...at ? { at } : {}, ...x !== undefined ? { x } : {}, ...z !== undefined ? { z } : {},
          ...action ? { action } : {}, ...keyMark ? { mark: keyMark } : {}, ...keyWeight !== undefined ? { weight: keyWeight } : {},
        });
      });
    }
    hosts.push({ ...faction ? { faction } : {}, ...label ? { label } : {}, ...color ? { color } : {}, mark, weight: weight ?? 1, keyframes });
  });
  return hosts;
}

/** `weight`: how much of the country the mark fills, 1 to 5 — never a count of soldiers. */
function readWeight(C: ArcContext, sf: string, v: unknown, what: string, required: boolean): number | undefined {
  if (v === undefined) {
    if (required) C.error(sf, `${what}: 1 to 5 — how much of the country the mark fills, never a number of soldiers (docs/DESIGN.md §4.10)`);
    return undefined;
  }
  if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 5) {
    C.error(sf, `${what}: 1 to 5 — how much of the country the mark fills, never a number of soldiers (docs/DESIGN.md §4.10)`);
    return undefined;
  }
  return v as number;
}

/** `roads`: a journey painted along its waypoints between `from` and `to`. */
function readRoads(C: ArcContext, sf: string, v: unknown, W: ArcWorld, onMap: OnMap): Road[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) { C.error(sf, 'roads: a list of { journey, from, to }'); return []; }
  const roads: Road[] = [];
  v.forEach((rd, i) => {
    const what = `roads[${i}]`;
    if (!isObj(rd)) { C.error(sf, `${what}: expected { journey, from, to }`); return; }
    C.keys(sf, rd, ['journey', 'from', 'to'], what);
    const journey: Journey | undefined = typeof rd.journey === 'string' ? W.journeys.get(rd.journey) : undefined;
    if (!journey) { C.error(sf, `${what}.journey: unknown journey ${JSON.stringify(rd.journey)}`); return; }
    let ok = true;
    for (const key of ['from', 'to'] as const) {
      const n = rd[key];
      if (typeof n !== 'number' || n < 0 || n > 1) { C.error(sf, `${what}.${key}: a time 0–1`); ok = false; }
    }
    if (!ok) return;
    const from = rd.from as number, to = rd.to as number;
    if (!(from < to)) { C.error(sf, `${what}: from (${from}) must come before to (${to}); the road paints itself between them`); return; }
    // Every stop on the road has to be somewhere on this map, or the line cannot be drawn.
    for (const [j, w] of journey.waypoints.entries()) onMap(w.place, `${what}: waypoints[${j}]`, 'warn');
    roads.push({ journey: journey.id, from, to });
  });
  return roads;
}

/**
 * `camera` at map scale: the same `{ t, x, z, width }` keys an event's framing uses (§9.3),
 * with `width` in map units instead of tile units.
 */
function readCamera(C: ArcContext, sf: string, v: unknown): CameraKey[] | undefined {
  if (v === undefined) return undefined;
  const camera: CameraKey[] = [];
  if (!Array.isArray(v) || !v.length) { C.error(sf, 'camera: a list of { t, x, z, width }'); return camera; }
  let ct = -1;
  v.forEach((k, i) => {
    const at = `camera[${i}]`;
    if (!isObj(k) || typeof k.t !== 'number' || k.t < 0 || k.t > 1) { C.error(sf, `${at}: needs a time t, 0–1`); return; }
    if (typeof k.x !== 'number' || typeof k.z !== 'number' || Math.abs(k.x) > MAP_LIMIT || Math.abs(k.z) > MAP_LIMIT) {
      C.error(sf, `${at}: x and z are a point on the map, within ±${MAP_LIMIT} units`); return;
    }
    if (typeof k.width !== 'number' || !(k.width >= WIDTH.min && k.width <= WIDTH.max)) {
      C.error(sf, `${at}.width: how much ground to hold in frame, ${WIDTH.min} to ${WIDTH.max} map units`); return;
    }
    if (k.t < ct) C.error(sf, `${at}: t must rise`);
    ct = k.t;
    camera.push({ t: k.t, x: k.x, z: k.z, width: k.width });
  });
  return camera;
}

/** The factions an arc's telling names: being in one is a reason to exist, as being on a battle's sides is. */
export function factionsInArcs(details: ArcDetail[]): Set<string> {
  const out = new Set<string>();
  for (const d of details) for (const h of d.hosts) if (h.faction) out.add(h.faction);
  return out;
}
