// Content build: content/ (YAML, one file per thing) → public/data/ (JSON the site loads).
// Validates everything, places events on the shared time axis, adds reverse links,
// and derives the lookups the cross-views need. See docs/DESIGN.md §4 and §8.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { dateSpan, whenSpan } from '../../src/data/calendar.ts';
import {
  LANGS, LINK_TYPES, PRECISIONS, SEASONS, STATUSES,
  type Age, type Arc, type Beat, type Character, type ContentIndex, type EventDetail, type EventLink,
  type EventSummary, type Journey, type Keyframe, type Lang, type LinkType, type LocalizedText,
  type NarrationAudio, type NarrationSegment, type Place, type Precision, type Span, type StageKind,
  type Status, type StoryDate, type Track, type When,
} from '../../src/data/types.ts';
import { narrationHash, TEXT_HASH } from '../narration/text.ts';

export interface BuildResult {
  index: ContentIndex;
  details: EventDetail[];
  errors: string[];
  warnings: string[];
  /** Missing translations, counted per language. */
  missing: Record<string, number>;
  copies: { from: string; to: string }[];
}

const REVERSE: Record<LinkType, LinkType> = {
  'caused-by': 'causes', causes: 'caused-by',
  'enabled-by': 'enables', enables: 'enabled-by',
  concurrent: 'concurrent', crossing: 'crossing',
};
const STATUS_RANK: Record<Status, number> = { outline: 0, scripted: 1, staged: 2, animated: 3 };
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const AUDIO_EXT = ['.mp3', '.ogg', '.m4a', '.wav'];
const STAGES: StageKind[] = ['cosmos', 'diorama'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Collects problems with the file they came from. */
class Report {
  errors: string[] = [];
  warnings: string[] = [];
  missing: Record<string, number> = {};
  missingByFile = new Map<string, number>();
  private root: string;
  constructor(root: string) { this.root = root; }
  rel(file: string) { return path.relative(this.root, file) || file; }
  error(file: string, msg: string) { this.errors.push(`${this.rel(file)}: ${msg}`); }
  warn(file: string, msg: string) { this.warnings.push(`${this.rel(file)}: ${msg}`); }
}

export function buildContent(contentDir: string): BuildResult {
  const R = new Report(path.dirname(contentDir));

  // ---------- generic readers ----------
  const readYaml = (file: string): unknown => {
    try {
      const doc = YAML.parseDocument(fs.readFileSync(file, 'utf8'), { prettyErrors: true });
      for (const e of doc.errors) R.error(file, `YAML: ${e.message}`);
      return doc.toJS();
    } catch (e) {
      R.error(file, `cannot read: ${(e as Error).message}`);
      return undefined;
    }
  };
  const yamlFiles = (dir: string) =>
    fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort().map((f) => path.join(dir, f)) : [];

  const keys = (file: string, o: Obj, allowed: string[], what: string) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) R.warn(file, `unknown field "${k}" in ${what} (typo?)`);
  };
  const text = (file: string, v: unknown, what: string, required = true): LocalizedText | undefined => {
    if (v === undefined && !required) return undefined;
    if (!isObj(v) || typeof v.en !== 'string' || !v.en.trim()) { R.error(file, `${what}: needs an English text (en)`); return undefined; }
    for (const [k, s] of Object.entries(v)) {
      if (!(LANGS as readonly string[]).includes(k)) R.warn(file, `${what}: unknown language "${k}"`);
      else if (typeof s !== 'string') R.error(file, `${what}.${k}: must be text`);
    }
    for (const l of LANGS) {
      if (l !== 'en' && !(typeof v[l] === 'string' && v[l])) {
        R.missing[l] = (R.missing[l] ?? 0) + 1;
        const k = `${R.rel(file)}|${l}`;
        R.missingByFile.set(k, (R.missingByFile.get(k) ?? 0) + 1);
      }
    }
    return v as LocalizedText;
  };
  const strList = (file: string, v: unknown, what: string): string[] => {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) { R.error(file, `${what}: must be a list of ids`); return []; }
    return v as string[];
  };
  const id = (file: string, v: unknown, seen: Set<string>, kind: string): string | undefined => {
    if (typeof v !== 'string' || !ID.test(v)) { R.error(file, `${kind} id must be kebab-case, got ${JSON.stringify(v)}`); return undefined; }
    if (seen.has(v)) R.error(file, `duplicate ${kind} id "${v}"`);
    seen.add(v);
    const base = path.basename(file, '.yaml');
    if (base !== 'event' && base !== v) R.warn(file, `file name should match its id "${v}"`);
    return v;
  };

  // ---------- ages ----------
  const ages: Age[] = [];
  const ageIds = new Set<string>();
  for (const f of yamlFiles(path.join(contentDir, 'ages'))) {
    const o = readYaml(f);
    if (!isObj(o)) { R.error(f, 'expected a mapping'); continue; }
    keys(f, o, ['id', 'order', 'name', 'abbr', 'summary', 'timeless', 'axis'], 'age');
    const aid = id(f, o.id, ageIds, 'age');
    if (!aid) continue;
    if (typeof o.order !== 'number') R.error(f, 'order: must be a number');
    let axis: Age['axis'];
    if (o.timeless === true) {
      if (o.axis) R.error(f, 'a timeless age cannot have an axis');
    } else if (isObj(o.axis) && typeof o.axis.start === 'number') {
      const yl = o.axis.yearLength ?? 1;
      if (typeof yl !== 'number' || yl <= 0) R.error(f, 'axis.yearLength: must be a positive number');
      axis = { start: o.axis.start, yearLength: Number(yl) };
    } else R.error(f, 'needs either `timeless: true` or `axis: { start }`');
    ages.push({ id: aid, order: Number(o.order), name: text(f, o.name, 'name')!, abbr: text(f, o.abbr, 'abbr', false), summary: text(f, o.summary, 'summary')!, ...axis ? { axis } : {} });
  }
  ages.sort((a, b) => a.order - b.order);
  const ageMap = new Map(ages.map((a) => [a.id, a]));

  // ---------- dates ----------
  const date = (file: string, v: unknown, what: string): StoryDate | undefined => {
    if (!isObj(v)) { R.error(file, `${what}: expected { age, year, ... }`); return undefined; }
    keys(file, v, ['age', 'year', 'month', 'day', 'season'], what);
    const age = ageMap.get(String(v.age));
    if (!age) { R.error(file, `${what}.age: unknown age "${v.age}"`); return undefined; }
    if (!age.axis) { R.error(file, `${what}: age "${age.id}" is timeless and has no dates`); return undefined; }
    if (!Number.isInteger(v.year) || (v.year as number) < 1) { R.error(file, `${what}.year: must be a whole number ≥ 1`); return undefined; }
    if (v.month !== undefined && !(Number.isInteger(v.month) && (v.month as number) >= 1 && (v.month as number) <= 12)) R.error(file, `${what}.month: 1–12`);
    if (v.day !== undefined && !(Number.isInteger(v.day) && (v.day as number) >= 1 && (v.day as number) <= 30)) R.error(file, `${what}.day: 1–30`);
    if (v.day !== undefined && v.month === undefined) R.error(file, `${what}: a day needs a month`);
    if (v.season !== undefined && !(SEASONS as readonly string[]).includes(String(v.season))) R.error(file, `${what}.season: one of ${SEASONS.join(', ')}`);
    if (v.season !== undefined && v.month !== undefined) R.error(file, `${what}: give a month or a season, not both`);
    return v as unknown as StoryDate;
  };
  const precision = (file: string, v: unknown, d: StoryDate | undefined, what: string): Precision | undefined => {
    if (!(PRECISIONS as readonly string[]).includes(String(v))) { R.error(file, `${what}: precision must be one of ${PRECISIONS.join(', ')}`); return undefined; }
    const p = v as Precision;
    if (d) {
      if (p === 'day' && d.day === undefined) R.error(file, `${what}: precision "day" needs a day`);
      if (p === 'month' && d.month === undefined) R.error(file, `${what}: precision "month" needs a month`);
      if (p === 'season' && d.season === undefined) R.error(file, `${what}: precision "season" needs a season`);
    }
    return p;
  };

  // ---------- characters, places, arcs ----------
  const characters: Character[] = [];
  const charIds = new Set<string>();
  const charFile = new Map<string, string>();
  for (const f of yamlFiles(path.join(contentDir, 'characters'))) {
    const o = readYaml(f);
    if (!isObj(o)) { R.error(f, 'expected a mapping'); continue; }
    keys(f, o, ['id', 'name', 'kind', 'summary', 'color', 'scale', 'kin'], 'character');
    const cid = id(f, o.id, charIds, 'character');
    if (!cid) continue;
    if (typeof o.kind !== 'string') R.error(f, 'kind: required (hobbit, elf, man, ...)');
    if (o.color !== undefined && !/^#[0-9a-f]{6}$/i.test(String(o.color))) R.error(f, 'color: use #rrggbb');
    if (o.scale !== undefined && !(typeof o.scale === 'number' && o.scale > 0)) R.error(f, 'scale: a positive number');
    const kin = Array.isArray(o.kin) ? o.kin.filter(isObj).map((k) => ({ id: String(k.id), as: String(k.as) })) : undefined;
    characters.push({
      id: cid, name: text(f, o.name, 'name')!, kind: String(o.kind), summary: text(f, o.summary, 'summary')!,
      ...o.color ? { color: String(o.color) } : {}, ...o.scale ? { scale: Number(o.scale) } : {}, ...kin ? { kin } : {},
    });
    charFile.set(cid, f);
  }
  for (const c of characters) for (const k of c.kin ?? []) if (!charIds.has(k.id)) R.error(charFile.get(c.id)!, `kin: unknown character "${k.id}"`);

  const places: Place[] = [];
  const placeIds = new Set<string>();
  for (const f of yamlFiles(path.join(contentDir, 'places'))) {
    const o = readYaml(f);
    if (!isObj(o)) { R.error(f, 'expected a mapping'); continue; }
    keys(f, o, ['id', 'name', 'summary', 'world'], 'place');
    const pid = id(f, o.id, placeIds, 'place');
    if (!pid) continue;
    const world = isObj(o.world) && typeof o.world.x === 'number' && typeof o.world.z === 'number' ? { x: o.world.x, z: o.world.z } : undefined;
    places.push({ id: pid, name: text(f, o.name, 'name')!, summary: text(f, o.summary, 'summary')!, ...world ? { world } : {} });
  }

  const arcs: Arc[] = [];
  const arcIds = new Set<string>();
  for (const f of yamlFiles(path.join(contentDir, 'arcs'))) {
    const o = readYaml(f);
    if (!isObj(o)) { R.error(f, 'expected a mapping'); continue; }
    keys(f, o, ['id', 'title', 'summary'], 'arc');
    const aid = id(f, o.id, arcIds, 'arc');
    if (aid) arcs.push({ id: aid, title: text(f, o.title, 'title')!, summary: text(f, o.summary, 'summary')!, events: [] });
  }

  // ---------- journeys ----------
  const journeys: Journey[] = [];
  const journeyIds = new Set<string>();
  for (const f of yamlFiles(path.join(contentDir, 'journeys'))) {
    const o = readYaml(f);
    if (!isObj(o)) { R.error(f, 'expected a mapping'); continue; }
    keys(f, o, ['id', 'title', 'characters', 'waypoints'], 'journey');
    const jid = id(f, o.id, journeyIds, 'journey');
    if (!jid) continue;
    const chars = strList(f, o.characters, 'characters');
    for (const c of chars) if (!charIds.has(c)) R.error(f, `characters: unknown character "${c}"`);
    const waypoints: Journey['waypoints'] = [];
    (Array.isArray(o.waypoints) ? o.waypoints : []).forEach((w, i) => {
      const what = `waypoints[${i}]`;
      if (!isObj(w)) { R.error(f, `${what}: expected { place, date, precision }`); return; }
      keys(f, w, ['place', 'date', 'precision'], what);
      if (!placeIds.has(String(w.place))) R.error(f, `${what}.place: unknown place "${w.place}"`);
      const d = date(f, w.date, `${what}.date`);
      const p = precision(f, w.precision, d, what);
      const span = d && p && dateSpan(d, p, ageMap.get(d.age)!);
      if (d && p && span) waypoints.push({ place: String(w.place), date: d, precision: p, span, at: (span.from + span.to) / 2 });
    });
    if (waypoints.length < 2) R.error(f, 'a journey needs at least two waypoints');
    // Coarse dates may overlap their neighbours; only a waypoint that ends before the previous one starts is out of order.
    for (let i = 1; i < waypoints.length; i++) if (waypoints[i].span.to <= waypoints[i - 1].span.from) R.error(f, `waypoints[${i}]: earlier than the waypoint before it`);
    const span = waypoints.length ? { from: waypoints[0].span.from, to: waypoints.at(-1)!.span.to } : undefined;
    journeys.push({ id: jid, title: text(f, o.title, 'title')!, characters: chars, waypoints, ...span ? { span } : {}, events: [] });
  }

  // ---------- events ----------
  interface Raw { dir: string; file: string; summary: EventSummary; folder: string; ageOrder: number; staging?: Obj; narration?: NarrationSegment[]; beatsRaw: { id: string; label: LocalizedText }[] }
  const raws: Raw[] = [];
  const eventIds = new Set<string>();
  const eventsDir = path.join(contentDir, 'events');
  const eventDirs: string[] = [];
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    if (fs.existsSync(path.join(d, 'event.yaml'))) { eventDirs.push(d); return; }
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) if (e.isDirectory()) walk(path.join(d, e.name));
  };
  walk(eventsDir);

  for (const dir of eventDirs) {
    const f = path.join(dir, 'event.yaml');
    const o = readYaml(f);
    if (!isObj(o)) { R.error(f, 'expected a mapping'); continue; }
    keys(f, o, ['id', 'age', 'when', 'place', 'characters', 'arcs', 'journeys', 'tags', 'status', 'source', 'title', 'summary', 'links', 'beats'], 'event');
    const eid = id(f, o.id, eventIds, 'event');
    if (!eid) continue;
    const folder = path.basename(dir);
    if (folder !== eid && !folder.endsWith(`-${eid}`)) R.warn(f, `folder "${folder}" should end with the event id "${eid}"`);

    const age = ageMap.get(String(o.age));
    if (!age) R.error(f, `age: unknown age "${o.age}"`);
    const ageFolder = path.basename(path.dirname(dir));
    if (age && ageFolder !== age.id) R.warn(f, `event of age "${age.id}" is filed under events/${ageFolder}/`);

    let when: When | undefined;
    let span: Span | undefined;
    if (o.when !== undefined) {
      if (age && !age.axis) R.error(f, `when: age "${age.id}" is timeless; remove the date`);
      else if (isObj(o.when)) {
        keys(f, o.when, ['start', 'end', 'precision'], 'when');
        const start = date(f, o.when.start, 'when.start');
        const end = o.when.end !== undefined ? date(f, o.when.end, 'when.end') : undefined;
        const p = precision(f, o.when.precision, start, 'when');
        if (start && p) {
          when = { start, ...end ? { end } : {}, precision: p };
          span = whenSpan(when, ageMap);
          if (end && span) {
            const s0 = dateSpan(start, p, ageMap.get(start.age)!)!, s1 = dateSpan(end, p, ageMap.get(end.age)!)!;
            if (s1.from < s0.from) R.error(f, 'when.end is before when.start');
          }
          if (age && start.age !== age.id) R.warn(f, `when.start is in "${start.age}" but the event's age is "${age.id}"`);
        }
      } else R.error(f, 'when: expected { start, precision }');
    } else if (age?.axis) R.warn(f, 'no `when`: this event will not appear on the time cursor');

    const place = o.place === undefined ? undefined : String(o.place);
    if (place && !placeIds.has(place)) R.error(f, `place: unknown place "${place}"`);
    const chars = strList(f, o.characters, 'characters');
    for (const c of chars) if (!charIds.has(c)) R.error(f, `characters: unknown character "${c}"`);
    const evArcs = strList(f, o.arcs, 'arcs');
    for (const a of evArcs) if (!arcIds.has(a)) R.error(f, `arcs: unknown arc "${a}"`);
    const evJourneys = strList(f, o.journeys, 'journeys');
    for (const j of evJourneys) if (!journeyIds.has(j)) R.error(f, `journeys: unknown journey "${j}"`);

    const status = String(o.status) as Status;
    if (!(STATUSES as readonly string[]).includes(status)) R.error(f, `status: one of ${STATUSES.join(', ')}`);

    const links: EventLink[] = [];
    (Array.isArray(o.links) ? o.links : []).forEach((l, i) => {
      if (!isObj(l)) { R.error(f, `links[${i}]: expected { to, type }`); return; }
      keys(f, l, ['to', 'type', 'note'], `links[${i}]`);
      if (!(LINK_TYPES as readonly string[]).includes(String(l.type))) { R.error(f, `links[${i}].type: one of ${LINK_TYPES.join(', ')}`); return; }
      if (l.to === eid) { R.error(f, `links[${i}]: an event cannot link to itself`); return; }
      links.push({ to: String(l.to), type: l.type as LinkType, ...l.note !== undefined ? { note: text(f, l.note, `links[${i}].note`) } : {} });
    });

    const beatsRaw: Raw['beatsRaw'] = [];
    const beatIds = new Set<string>();
    (Array.isArray(o.beats) ? o.beats : []).forEach((b, i) => {
      if (!isObj(b) || typeof b.id !== 'string') { R.error(f, `beats[${i}]: expected { id, label }`); return; }
      if (beatIds.has(b.id)) R.error(f, `beats: duplicate id "${b.id}"`);
      beatIds.add(b.id);
      beatsRaw.push({ id: b.id, label: text(f, b.label, `beats[${i}].label`)! });
    });

    const source = isObj(o.source) ? { book: String(o.source.book), ...o.source.chapter !== undefined ? { chapter: o.source.chapter as string | number } : {} } : undefined;

    // narration.yaml
    const nf = path.join(dir, 'narration.yaml');
    let narration: NarrationSegment[] | undefined;
    if (fs.existsSync(nf)) {
      const n = readYaml(nf);
      if (!Array.isArray(n)) R.error(nf, 'expected a list of passages');
      else {
        const seen = new Set<string>();
        narration = [];
        n.forEach((p, i) => {
          if (!isObj(p) || typeof p.id !== 'string') { R.error(nf, `[${i}]: expected { id, en, es }`); return; }
          if (seen.has(p.id)) R.error(nf, `duplicate passage id "${p.id}"`);
          seen.add(p.id);
          const { id: pid, ...txt } = p;
          narration!.push({ id: pid as string, t: 0, text: text(nf, txt, `passage "${pid}"`)! });
        });
      }
    }

    // staging.yaml (read now, resolved after all events are known)
    const sf = path.join(dir, 'staging.yaml');
    const staging = fs.existsSync(sf) ? readYaml(sf) : undefined;

    // Status must match the files present.
    if (STATUS_RANK[status] >= STATUS_RANK.scripted && !narration) R.error(f, `status "${status}" needs a narration.yaml`);
    if (STATUS_RANK[status] >= STATUS_RANK.staged && !staging) R.error(f, `status "${status}" needs a staging.yaml`);
    if (staging && STATUS_RANK[status] < STATUS_RANK.staged) R.warn(f, `has a staging.yaml but status is "${status}"`);

    raws.push({
      dir, file: f, folder, ageOrder: age?.order ?? 99,
      staging: isObj(staging) ? staging : undefined, narration, beatsRaw,
      summary: {
        id: eid, age: String(o.age), ...when ? { when } : {}, ...span ? { span } : {}, ...place ? { place } : {},
        characters: chars, arcs: evArcs, journeys: evJourneys, tags: strList(f, o.tags, 'tags'), status,
        ...source ? { source } : {}, title: text(f, o.title, 'title')!, summary: text(f, o.summary, 'summary')!,
        links, audio: [],
      },
    });
  }

  // ---------- links: check targets, add reverses ----------
  const byId = new Map(raws.map((r) => [r.summary.id, r]));
  for (const r of raws) {
    r.summary.links = r.summary.links.filter((l) => {
      if (!byId.has(l.to)) { R.error(r.file, `links: unknown event "${l.to}"`); return false; }
      return true;
    });
  }
  for (const r of raws) {
    for (const l of r.summary.links.filter((x) => !x.reverse)) {
      const other = byId.get(l.to)!;
      const rev = REVERSE[l.type];
      if (!other.summary.links.some((x) => x.to === r.summary.id && x.type === rev)) {
        other.summary.links.push({ to: r.summary.id, type: rev, ...l.note ? { note: l.note } : {}, reverse: true });
      }
    }
  }

  // ---------- order ----------
  // Story order is authored, not inferred: by age, then by the folder's sort key.
  // Vague dates can't order events ("autumn" vs "November"), so the key decides,
  // and the build only checks that it doesn't contradict the dates.
  raws.sort((a, b) => a.ageOrder - b.ageOrder || a.folder.localeCompare(b.folder));
  for (let i = 1; i < raws.length; i++) {
    const prev = raws[i - 1].summary.span, cur = raws[i].summary.span;
    if (prev && cur && cur.to <= prev.from) R.warn(raws[i].file, `sorts after "${raws[i - 1].summary.id}" but its dates are earlier; check the folder sort key`);
  }

  // ---------- best-guess positions ----------
  estimatePositions(raws.map((r) => r.summary));
  estimateWaypoints(journeys, raws.map((r) => r.summary));
  for (let i = 1; i < raws.length; i++) {
    const a = raws[i - 1].summary.at, b = raws[i].summary.at;
    if (a !== undefined && b !== undefined && b < a - 1e-9 && raws[i].summary.characters.some((c) => raws[i - 1].summary.characters.includes(c))) {
      R.warn(raws[i].file, `its best-guess moment falls before "${raws[i - 1].summary.id}", which comes first in story order`);
    }
  }

  // ---------- staging, audio → details ----------
  const details: EventDetail[] = [];
  const copies: BuildResult['copies'] = [];
  for (const r of raws) {
    const s = r.staging;
    if (!s) continue;
    const sf = path.join(r.dir, 'staging.yaml');
    keys(sf, s, ['stage', 'duration', 'narration', 'beats', 'tracks'], 'staging');
    const stage = String(s.stage) as StageKind;
    if (!STAGES.includes(stage)) R.error(sf, `stage: one of ${STAGES.join(', ')}`);
    if (!(typeof s.duration === 'number' && s.duration > 0)) R.error(sf, 'duration: seconds, a positive number');

    // Narration timings.
    const narration = (r.narration ?? []).map((p) => ({ ...p }));
    const nt = isObj(s.narration) ? s.narration : {};
    for (const k of Object.keys(nt)) if (!narration.some((p) => p.id === k)) R.error(sf, `narration: no passage "${k}" in narration.yaml`);
    let last = -1;
    for (const p of narration) {
      const t = nt[p.id];
      if (typeof t !== 'number' || t < 0 || t > 1) { R.error(sf, `narration.${p.id}: needs a time 0–1`); continue; }
      if (t < last) R.error(sf, `narration.${p.id}: starts before the passage before it`);
      p.t = last = t;
    }

    // Beat timings.
    const bt = isObj(s.beats) ? s.beats : {};
    for (const k of Object.keys(bt)) if (!r.beatsRaw.some((b) => b.id === k)) R.error(sf, `beats: no beat "${k}" in event.yaml`);
    const beats: Beat[] = [];
    for (const b of r.beatsRaw) {
      const t = bt[b.id];
      if (typeof t !== 'number' || t < 0 || t > 1) { R.error(sf, `beats.${b.id}: needs a time 0–1`); continue; }
      beats.push({ id: b.id, t, label: b.label });
    }

    // Tracks.
    const tracks: Track[] = [];
    (Array.isArray(s.tracks) ? s.tracks : []).forEach((tr, i) => {
      if (!isObj(tr) || typeof tr.characterId !== 'string' || !Array.isArray(tr.keyframes)) { R.error(sf, `tracks[${i}]: expected { characterId, keyframes }`); return; }
      if (!r.summary.characters.includes(tr.characterId)) R.error(sf, `tracks[${i}]: "${tr.characterId}" is not in the event's characters`);
      const kfs: Keyframe[] = [];
      let lt = -1;
      tr.keyframes.forEach((k, j) => {
        const what = `tracks[${i}].keyframes[${j}]`;
        if (!isObj(k) || typeof k.t !== 'number' || typeof k.x !== 'number' || typeof k.z !== 'number') { R.error(sf, `${what}: needs t, x, z`); return; }
        if (k.t < lt || k.t < 0 || k.t > 1) R.error(sf, `${what}: t must rise from 0 to 1`);
        lt = k.t;
        kfs.push({ t: k.t, x: k.x, z: k.z, ...k.action ? { action: k.action as Keyframe['action'] } : {}, ...k.thought ? { thought: text(sf, k.thought, `${what}.thought`) } : {} });
      });
      tracks.push({ characterId: tr.characterId, keyframes: kfs });
    });

    // Recordings: audio/<lang>.yaml + audio/<lang>.<ext>
    const audioFiles: EventDetail['audioFiles'] = {};
    const ad = path.join(r.dir, 'audio');
    if (fs.existsSync(ad)) {
      for (const lang of LANGS) {
        const meta = path.join(ad, `${lang}.yaml`);
        const file = AUDIO_EXT.map((e) => path.join(ad, lang + e)).find((p) => fs.existsSync(p));
        if (!fs.existsSync(meta) && !file) continue;
        if (!file) { R.error(meta, 'timing file without a recording next to it'); continue; }
        if (!fs.existsSync(meta)) { R.error(file, `recording without ${lang}.yaml (duration and starts)`); continue; }
        const m = readYaml(meta);
        if (!isObj(m) || !(typeof m.duration === 'number' && m.duration > 0)) { R.error(meta, 'duration: seconds, a positive number'); continue; }
        // textHash ties the recording to the words it reads (content/README.md, "Recordings").
        const hash = narrationHash(narration, lang);
        if (m.textHash === undefined) R.warn(meta, `textHash: missing, so the build can't tell if the recording still matches narration.yaml (text now ${hash})`);
        else if (typeof m.textHash !== 'string' || !TEXT_HASH.test(m.textHash)) R.error(meta, 'textHash: expected sha256: and 16 hex digits');
        else if (m.textHash !== hash) R.warn(meta, `stale recording: narration.yaml changed since it was recorded (textHash ${m.textHash}, text now ${hash}); re-record with npm run narration:export -- --changed`);
        let starts: number[] | undefined;
        if (m.starts !== undefined) {
          const st = isObj(m.starts) ? m.starts : {};
          starts = [];
          for (const k of Object.keys(st)) if (!narration.some((p) => p.id === k)) R.error(meta, `starts: no passage "${k}"`);
          let prev = -1;
          for (const p of narration) {
            const v = st[p.id];
            if (typeof v !== 'number' || v < 0 || v > (m.duration as number)) { R.error(meta, `starts.${p.id}: needs a second within the recording`); starts = undefined; break; }
            if (v < prev) R.error(meta, `starts.${p.id}: earlier than the passage before it`);
            starts.push(prev = v);
          }
        }
        const ext = path.extname(file);
        const out = `data/audio/${r.summary.id}/${lang}${ext}`;
        copies.push({ from: file, to: out });
        const rec: NarrationAudio = { src: out, duration: m.duration as number, ...starts ? { starts } : {} };
        audioFiles[lang as Lang] = rec;
        r.summary.audio.push(lang as Lang);
      }
      for (const f of fs.readdirSync(ad)) {
        const base = path.basename(f, path.extname(f));
        if (!(LANGS as readonly string[]).includes(base)) R.warn(path.join(ad, f), 'unexpected file; name recordings <lang>.mp3 with <lang>.yaml');
      }
    }

    r.summary.stage = stage;
    details.push({ ...r.summary, stage, durationSeconds: Number(s.duration), narration, beats, tracks, audioFiles });
  }

  // ---------- derived lookups ----------
  const events = raws.map((r) => r.summary);
  const byCharacter: Record<string, string[]> = Object.fromEntries(characters.map((c) => [c.id, []]));
  const byPlace: Record<string, string[]> = Object.fromEntries(places.map((p) => [p.id, []]));
  const arcMap = new Map(arcs.map((a) => [a.id, a]));
  const journeyMap = new Map(journeys.map((j) => [j.id, j]));
  for (const e of events) {
    for (const c of e.characters) byCharacter[c]?.push(e.id);
    if (e.place) byPlace[e.place]?.push(e.id);
    for (const a of e.arcs) arcMap.get(a)?.events.push(e.id);
    for (const j of e.journeys) {
      const jr = journeyMap.get(j);
      if (!jr) continue;
      jr.events.push(e.id);
      for (const c of e.characters) if (jr.characters.includes(c) && e.span && jr.span && (e.span.to < jr.span.from || e.span.from > jr.span.to)) {
        R.warn(byId.get(e.id)!.file, `is part of journey "${j}" but falls outside its dates`);
        break;
      }
    }
  }
  for (const a of arcs) {
    const spans = a.events.map((id) => byId.get(id)!.summary.span).filter((s): s is Span => !!s);
    if (spans.length) a.span = { from: Math.min(...spans.map((s) => s.from)), to: Math.max(...spans.map((s) => s.to)) };
    if (!a.events.length) R.warn(path.join(contentDir, 'arcs', `${a.id}.yaml`), 'no events belong to this arc yet');
  }
  for (const c of characters) if (!byCharacter[c.id].length && !journeys.some((j) => j.characters.includes(c.id))) R.warn(charFile.get(c.id)!, 'appears in no event or journey');

  for (const [k, n] of R.missingByFile) {
    const [file, lang] = k.split('|');
    R.warnings.push(`${file}: ${n} text${n > 1 ? 's' : ''} missing "${lang}"`);
  }

  return {
    index: { ages, characters, places, arcs, journeys, events, byCharacter, byPlace },
    details, copies, errors: R.errors, warnings: R.warnings, missing: R.missing,
  };
}

/** Spans narrower than this (in years of the Sun, about a month) count as exact anchors. */
const ANCHOR_WIDTH = 0.1;

/**
 * Give every dated event a best-guess moment `at` within its honest span.
 *
 * `events` arrive in story order (age, then folder sort key). Exact-dated
 * events (anchors) sit at their middle. Every other event gets a window: its own
 * span, narrowed by the nearest anchors before and after it in its characters'
 * lanes. Events sharing the same window are spaced evenly across it in story order,
 * so six "summer 2941" events become a sequence through that summer, not a pile-up.
 */
export function estimatePositions(events: EventSummary[]): void {
  const mid = (s: Span) => (s.from + s.to) / 2;
  const isAnchor = (e: EventSummary) => !!e.span && e.span.to - e.span.from <= ANCHOR_WIDTH;
  const order = new Map(events.map((e, i) => [e.id, i]));
  const lanes = new Map<string, EventSummary[]>();
  for (const e of events) if (e.span) for (const c of e.characters) {
    if (!lanes.has(c)) lanes.set(c, []);
    lanes.get(c)!.push(e);
  }
  const groups = new Map<string, { from: number; to: number; members: EventSummary[] }>();
  for (const e of events) {
    if (!e.span) continue;
    if (isAnchor(e)) { e.at = mid(e.span); continue; }
    let from = e.span.from, to = e.span.to;
    const me = order.get(e.id)!;
    for (const c of e.characters) for (const o of lanes.get(c)!) {
      if (!isAnchor(o)) continue;
      const m = mid(o.span!);
      if (order.get(o.id)! < me && m < to) from = Math.max(from, m);
      if (order.get(o.id)! > me && m > from) to = Math.min(to, m);
    }
    const key = `${from.toFixed(4)}|${to.toFixed(4)}`;
    if (!groups.has(key)) groups.set(key, { from, to, members: [] });
    groups.get(key)!.members.push(e);
  }
  for (const g of groups.values()) {
    g.members.forEach((e, k) => { e.at = g.from + ((g.to - g.from) * (k + 1)) / (g.members.length + 1); });
  }

  // Forward pass in story order: nothing happens before what it follows, whether that's the
  // previous event in a shared character's lane or an event it is caused-by / enabled-by.
  const STEP = 1 / 360; // a day
  const byId = new Map(events.map((e) => [e.id, e]));
  const lastInLane = new Map<string, number>();
  for (const e of events) {
    if (e.at === undefined || !e.span) continue;
    let floor = -Infinity;
    for (const c of e.characters) floor = Math.max(floor, lastInLane.get(c) ?? -Infinity);
    for (const l of e.links) if (l.type === 'caused-by' || l.type === 'enabled-by') {
      const x = byId.get(l.to)?.at;
      if (x !== undefined && order.get(l.to)! < order.get(e.id)!) floor = Math.max(floor, x);
    }
    if (!isAnchor(e) && e.at <= floor) e.at = Math.min(floor + STEP, e.span.to);
    for (const c of e.characters) lastInLane.set(c, e.at);
  }
}

/**
 * Best-guess moments for journey waypoints. A waypoint that matches an event on the
 * journey (same place, overlapping dates) takes that event's `at`; exact-dated ones sit
 * at their middle; the rest are spaced between their neighbours, inside their own span.
 */
export function estimateWaypoints(journeys: Journey[], events: EventSummary[]): void {
  for (const j of journeys) {
    const known: (number | undefined)[] = [];
    let last = -Infinity;
    for (const w of j.waypoints) {
      let at: number | undefined;
      if (w.span.to - w.span.from <= ANCHOR_WIDTH) at = (w.span.from + w.span.to) / 2;
      else {
        const e = events.find((x) => x.journeys.includes(j.id) && x.place === w.place && x.span && x.at !== undefined
          && x.span.from < w.span.to && w.span.from < x.span.to && x.at >= last);
        at = e?.at;
      }
      known.push(at);
      if (at !== undefined) last = at;
    }
    for (let i = 0; i < j.waypoints.length; i++) {
      if (known[i] !== undefined) { j.waypoints[i].at = known[i]!; continue; }
      let k = i;
      while (k < j.waypoints.length && known[k] === undefined) k++;
      const run = j.waypoints.slice(i, k);
      const lo = i > 0 ? j.waypoints[i - 1].at : run[0].span.from;
      const hi = k < j.waypoints.length ? known[k]! : run.at(-1)!.span.to;
      run.forEach((w, n) => {
        const g = lo + ((hi - lo) * (n + 1)) / (run.length + 1);
        w.at = Math.min(Math.max(g, w.span.from), w.span.to);
      });
      i = k - 1;
    }
  }
}

/** Write the build result into `<publicDir>/data/`, replacing what was there. */
export function writeContent(result: BuildResult, publicDir: string): void {
  const out = path.join(publicDir, 'data');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'events'), { recursive: true });
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(result.index));
  for (const d of result.details) fs.writeFileSync(path.join(out, 'events', `${d.id}.json`), JSON.stringify(d));
  for (const c of result.copies) {
    const to = path.join(publicDir, c.to);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(c.from, to);
  }
}

/** One-paragraph summary for the console. */
export function describe(result: BuildResult): string {
  const ev = result.index.events;
  const by = (s: Status) => ev.filter((e) => e.status === s).length;
  const lines = [
    `content: ${ev.length} events (${by('outline')} outline, ${by('scripted')} scripted, ${by('staged')} staged, ${by('animated')} animated), ` +
    `${result.index.characters.length} characters, ${result.index.places.length} places, ${result.index.arcs.length} arcs, ${result.index.journeys.length} journeys`,
  ];
  for (const [l, n] of Object.entries(result.missing)) lines.push(`translations: ${n} texts missing "${l}"`);
  for (const w of result.warnings) lines.push(`  warning  ${w}`);
  for (const e of result.errors) lines.push(`  ERROR    ${e}`);
  lines.push(result.errors.length ? `✗ ${result.errors.length} error(s)` : '✓ content is valid');
  return lines.join('\n');
}
