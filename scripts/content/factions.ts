// Factions: the sides in battles (content/factions/<id>.yaml), a battle's `sides` in its
// event.yaml, and its `armies` in staging.yaml. Kept apart from build.ts, which calls these
// with its own readers and report. See docs/DESIGN.md §2 (battles) and §4.9.

import path from 'node:path';
import {
  ARMY_ACTIONS, ARMY_SIZES,
  type Army, type ArmyAction, type ArmyKeyframe, type ArmySize, type EventSummary, type Faction, type LocalizedText,
} from '../../src/data/types.ts';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const KIND = /^[a-z]+(-[a-z]+)*$/;

/** What build.ts lends these readers: its report and its field readers. */
export interface FactionContext {
  error(file: string, msg: string): void;
  warn(file: string, msg: string): void;
  readYaml(file: string): unknown;
  yamlFiles(dir: string): string[];
  keys(file: string, o: Obj, allowed: string[], what: string): void;
  text(file: string, v: unknown, what: string, required?: boolean): LocalizedText | undefined;
  id(file: string, v: unknown, seen: Set<string>, kind: string): string | undefined;
}

/** Read and check content/factions/: names, banner colour, kind, summary, leaders (known characters). */
export function readFactions(C: FactionContext, contentDir: string, charIds: Set<string>): Faction[] {
  const factions: Faction[] = [];
  const seen = new Set<string>();
  for (const f of C.yamlFiles(path.join(contentDir, 'factions'))) {
    const o = C.readYaml(f);
    if (!isObj(o)) { C.error(f, 'expected a mapping'); continue; }
    C.keys(f, o, ['id', 'name', 'color', 'kind', 'summary', 'leaders'], 'faction');
    const fid = C.id(f, o.id, seen, 'faction');
    if (!fid) continue;
    if (!/^#[0-9a-f]{6}$/i.test(String(o.color ?? ''))) C.error(f, 'color: the banner colour, as #rrggbb');
    if (typeof o.kind !== 'string' || !KIND.test(o.kind)) C.error(f, 'kind: required, a character kind (elf, man, dwarf, orc, wolf, eagle, ...)');
    let leaders: string[] = [];
    if (o.leaders !== undefined) {
      if (!Array.isArray(o.leaders) || o.leaders.some((x) => typeof x !== 'string')) C.error(f, 'leaders: must be a list of character ids');
      else leaders = o.leaders as string[];
    }
    for (const c of leaders) if (!charIds.has(c)) C.error(f, `leaders: unknown character "${c}"`);
    factions.push({
      id: fid, name: C.text(f, o.name, 'name')!, color: String(o.color ?? '').toLowerCase(), kind: String(o.kind ?? ''),
      summary: C.text(f, o.summary, 'summary')!, leaders,
    });
  }
  return factions;
}

/**
 * A battle's `sides`: a list of at least two groups of allied faction ids, each group
 * against the others. Every id known, and no faction on two sides or twice on one.
 */
export function readSides(C: FactionContext, file: string, v: unknown, factionIds: Set<string>): string[][] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length < 2 || v.some((s) => !Array.isArray(s) || !s.length || s.some((x: unknown) => typeof x !== 'string'))) {
    C.error(file, 'sides: a list of at least two sides, each a list of faction ids ([ [ elves, men ], [ goblins ] ])');
    return undefined;
  }
  const sides = v as string[][];
  const where = new Set<string>();
  for (const side of sides) for (const fid of side) {
    if (!factionIds.has(fid)) C.error(file, `sides: unknown faction "${fid}"`);
    else if (where.has(fid)) C.error(file, `sides: "${fid}" is listed twice`);
    where.add(fid);
  }
  return sides;
}

/**
 * A battle's `armies` in staging.yaml: each of the event's factions as a block of figures,
 * `{ faction, size, keyframes: [{ t, x, z, action? }] }`. The faction must be on one of the
 * event's sides.
 */
export function readArmies(C: FactionContext, file: string, v: unknown, ev: EventSummary): Army[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) { C.error(file, 'armies: a list of { faction, size, keyframes }'); return undefined; }
  const onSides = new Set((ev.sides ?? []).flat());
  const armies: Army[] = [];
  v.forEach((a, i) => {
    const what = `armies[${i}]`;
    if (!isObj(a) || typeof a.faction !== 'string' || !Array.isArray(a.keyframes)) { C.error(file, `${what}: expected { faction, size, keyframes }`); return; }
    C.keys(file, a, ['faction', 'size', 'keyframes'], what);
    if (!onSides.has(a.faction)) C.error(file, `${what}: "${a.faction}" is not on the event's sides (event.yaml \`sides\`)`);
    if (!(ARMY_SIZES as readonly string[]).includes(String(a.size))) C.error(file, `${what}.size: one of ${ARMY_SIZES.join(', ')}`);
    const kfs: ArmyKeyframe[] = [];
    let lt = -1;
    a.keyframes.forEach((k, j) => {
      const kw = `${what}.keyframes[${j}]`;
      if (!isObj(k) || typeof k.t !== 'number' || typeof k.x !== 'number' || typeof k.z !== 'number') { C.error(file, `${kw}: needs t, x, z`); return; }
      C.keys(file, k, ['t', 'x', 'z', 'action'], kw);
      if (k.t < lt || k.t < 0 || k.t > 1) C.error(file, `${kw}: t must rise from 0 to 1`);
      lt = k.t;
      if (k.action !== undefined && !(ARMY_ACTIONS as readonly string[]).includes(String(k.action))) C.error(file, `${kw}.action: one of ${ARMY_ACTIONS.join(', ')}`);
      kfs.push({ t: k.t, x: k.x, z: k.z, ...k.action ? { action: k.action as ArmyAction } : {} });
    });
    if (!kfs.length) C.error(file, `${what}: needs at least one keyframe`);
    armies.push({ faction: a.faction, size: String(a.size) as ArmySize, keyframes: kfs });
  });
  return armies;
}

/** Each faction's battles, in story order (`events` arrive in it). */
export function battlesByFaction(factions: Faction[], events: EventSummary[]): Record<string, string[]> {
  const by: Record<string, string[]> = Object.fromEntries(factions.map((f) => [f.id, []]));
  for (const e of events) for (const fid of (e.sides ?? []).flat()) by[fid]?.push(e.id);
  return by;
}
