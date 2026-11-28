// Parentage: the one authored edge a family tree is drawn from (`parents`), the keys that go
// beside it (`spouse`, `betrothed`, `twin`, the narrowed `kin`, `born`, `died`, `fate`, `house`),
// and everything the build derives from them — children, siblings, half-siblings, generation
// depth and the houses. Kept apart from build.ts, which calls these with its own readers and
// report, exactly as factions.ts is. See docs/DESIGN.md §3.6 and §4.11.

import {
  KIN_WORDS,
  type Age, type Character, type EventSummary, type Family, type FamilySibling, type House,
  type Kin, type LifeDate, type LocalizedText, type Precision, type Span, type StoryDate,
} from '../../src/data/types.ts';
import { EPS, overlaps, whenSpan } from '../../src/data/calendar.ts';
import {
  derivedRelation, descendants, generations, houses as houseParts, kinGraph, parentageCycle, siblings,
  type KinGraph,
} from '../../src/kinGraph.ts';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** What build.ts lends these readers: its report and its field readers. */
export interface KinContext {
  error(file: string, msg: string): void;
  warn(file: string, msg: string): void;
  keys(file: string, o: Obj, allowed: string[], what: string): void;
  text(file: string, v: unknown, what: string, required?: boolean): LocalizedText | undefined;
  strList(file: string, v: unknown, what: string): string[];
  date(file: string, v: unknown, what: string): StoryDate | undefined;
  precision(file: string, v: unknown, d: StoryDate | undefined, what: string): Precision | undefined;
  ages: Map<string, Age>;
}

/** The family keys a character file may carry, for build.ts's unknown-field check. */
export const FAMILY_KEYS = ['parents', 'spouse', 'betrothed', 'twin', 'kin', 'born', 'died', 'fate', 'house'];

/**
 * An old `kin` word and what it becomes. §4.11 planned this as a warning while 36 files carried
 * the old vocabulary; the migration is done, so it is the error the design asks for in the end
 * state, and the message still names the exact replacement for the word it found.
 */
const REPLACEMENT: Record<string, string> = {
  father: 'child', mother: 'child', parent: 'child', son: 'child', daughter: 'child', child: 'child',
  brother: 'both', sister: 'both', twin: 'twin',
  grandfather: 'between', grandmother: 'between', grandson: 'between', granddaughter: 'between',
  uncle: 'between', aunt: 'between', nephew: 'between', niece: 'between',
  wife: 'spouse', husband: 'spouse', betrothed: 'spouse',
};

/** What to write instead, in words, so the warning names the exact replacement. */
const HOW: Record<string, string> = {
  child: 'is derived from `parents:` now — put the parentage on the child and delete this',
  both: 'is derived from `parents:` now — put the parentage on both and delete this (or, where no source names either parent, `as: sibling`)',
  between: 'is derived from `parents:` now — put the parentage on everyone in between and delete this',
  spouse: 'is `spouse:` now — write it on either side (the build adds the reverse) and delete this',
  twin: 'is `twin:` now — write it on either side (the build adds the reverse) and delete this',
};

/** A birth or a death an event declares (`born:`/`died:` in event.yaml). */
export interface LifeDeclaration {
  event: string;
  file: string;
  born: string[];
  died: string[];
}

/** The authored family keys on one character, read and shape-checked. */
export function readFamily(C: KinContext, file: string, cid: string, o: Obj): Partial<Character> {
  const ids = (v: unknown, what: string): string[] | undefined => {
    if (v === undefined) return undefined;
    const list = C.strList(file, v, what);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of list) {
      if (x === cid) { C.error(file, `${what}: a character cannot be their own ${what}`); continue; }
      if (seen.has(x)) { C.error(file, `${what}: "${x}" is listed twice`); continue; }
      seen.add(x);
      out.push(x);
    }
    return out;
  };

  const parents = ids(o.parents, 'parents');
  if (parents && parents.length > 2) C.error(file, `parents: at most two (list only the parents the sources name), got ${parents.length}`);
  const spouse = ids(o.spouse, 'spouse');
  const betrothed = ids(o.betrothed, 'betrothed');

  let twin: string | undefined;
  if (o.twin !== undefined) {
    if (typeof o.twin !== 'string') C.error(file, 'twin: a single character id (the texts have no triplets)');
    else if (o.twin === cid) C.error(file, 'twin: a character cannot be their own twin');
    else twin = o.twin;
  }

  const kin: Kin[] | undefined = o.kin === undefined ? undefined : (() => {
    if (!Array.isArray(o.kin)) { C.error(file, 'kin: a list of { id, as }'); return undefined; }
    const out: Kin[] = [];
    o.kin.forEach((k, i) => {
      const what = `kin[${i}]`;
      if (!isObj(k) || typeof k.id !== 'string' || typeof k.as !== 'string') { C.error(file, `${what}: expected { id, as }`); return; }
      C.keys(file, k, ['id', 'as'], what);
      if (k.id === cid) { C.error(file, `${what}: a character cannot be their own kin`); return; }
      out.push({ id: k.id, as: k.as });
    });
    return out;
  })();

  const life = (v: unknown, what: 'born' | 'died'): LifeDate | undefined => {
    if (v === undefined) return undefined;
    if (!isObj(v)) { C.error(file, `${what}: expected { date, precision }`); return undefined; }
    C.keys(file, v, ['date', 'precision'], what);
    const d = C.date(file, v.date, `${what}.date`);
    const p = C.precision(file, v.precision, d, what);
    if (!d || !p) return undefined;
    const span = whenSpan({ start: d, precision: p }, C.ages);
    return { date: d, precision: p, ...span ? { span } : {} };
  };

  const born = life(o.born, 'born');
  const died = life(o.died, 'died');

  return {
    ...parents?.length ? { parents } : {},
    ...spouse?.length ? { spouse } : {},
    ...betrothed?.length ? { betrothed } : {},
    ...twin ? { twin } : {},
    ...kin?.length ? { kin } : {},
    ...born ? { born } : {},
    ...died ? { died } : {},
    ...o.fate !== undefined ? { fate: C.text(file, o.fate, 'fate') } : {},
    ...o.house !== undefined ? { house: C.text(file, o.house, 'house') } : {},
  };
}

/**
 * `born:` and `died:` on an event: who begins or ends a life in it. Each id must be among the
 * event's own `characters`, so the scene really shows them (§4.11).
 */
export function readLifeEvents(C: KinContext, file: string, o: Obj, chars: string[]): { born: string[]; died: string[] } {
  const read = (what: 'born' | 'died') => {
    if (o[what] === undefined) return [];
    const list = C.strList(file, o[what], what);
    return list.filter((c) => {
      if (!chars.includes(c)) { C.error(file, `${what}: "${c}" is not in the event's characters`); return false; }
      return true;
    });
  };
  return { born: read('born'), died: read('died') };
}

/** Everything the build derives from the authored edges, plus the checks on them. */
export function deriveFamily(
  C: KinContext,
  characters: Character[],
  charFile: Map<string, string>,
  events: EventSummary[],
  declarations: LifeDeclaration[],
): { family: Record<string, Family>; houses: House[] } {
  const byId = new Map(characters.map((c) => [c.id, c]));
  const known = (id: string) => byId.has(id);
  const fileOf = (id: string) => charFile.get(id)!;

  // ---- unknown ids, everywhere ----
  for (const c of characters) {
    const f = fileOf(c.id);
    for (const [what, list] of [['parents', c.parents], ['spouse', c.spouse], ['betrothed', c.betrothed]] as const) {
      for (const x of list ?? []) if (!known(x)) C.error(f, `${what}: unknown character "${x}"`);
    }
    if (c.twin && !known(c.twin)) C.error(f, `twin: unknown character "${c.twin}"`);
    for (const k of c.kin ?? []) if (!known(k.id)) C.error(f, `kin: unknown character "${k.id}"`);
  }

  // ---- the graph (only edges between characters we hold) ----
  // Only the people a parentage edge touches stand in the graph: a character with no parents and
  // no children is in no house, rather than a house of one.
  const g = kinGraph(characters.filter((c) => (c.parents ?? []).some(known)).map((c) => [c.id, (c.parents ?? []).filter(known)] as const));
  const cycle = parentageCycle(g);
  if (cycle) C.error(fileOf(cycle[0]), `parents: a parentage cycle (${cycle.join(' → ')}): nobody is their own ancestor`);
  // With a cycle in it the graph cannot be walked honestly, so drop the edges and report the rest.
  const graph: KinGraph = cycle ? kinGraph([]) : g;

  // ---- a spouse who is also a parent or child of the same character ----
  for (const c of characters) for (const s of c.spouse ?? []) {
    if ((c.parents ?? []).includes(s) || (byId.get(s)?.parents ?? []).includes(c.id)) {
      C.error(fileOf(c.id), `spouse: "${s}" is also a parent or child of "${c.id}"`);
    }
  }

  // ---- twins: mutual, and sharing a parent ----
  for (const c of characters) {
    if (!c.twin || !known(c.twin)) continue;
    const other = byId.get(c.twin)!;
    if (other.twin !== undefined && other.twin !== c.id) C.error(fileOf(c.id), `twin: "${c.twin}" is the twin of "${other.twin}", not of "${c.id}"`);
    const shared = (c.parents ?? []).filter((p) => (other.parents ?? []).includes(p));
    if (!shared.length) C.error(fileOf(c.id), `twin: "${c.twin}" shares no parent with "${c.id}"; a twin is a sibling first (give both their \`parents\`)`);
  }

  // ---- the derived family of every character ----
  const depth = generations(graph);
  const family: Record<string, Family> = {};
  for (const c of characters) {
    const sibs: FamilySibling[] = siblings(graph, c.id).map((s) => ({
      id: s.id, half: s.half, shared: s.shared,
      ...c.twin === s.id || byId.get(s.id)?.twin === c.id ? { twin: true } : {},
    }));
    family[c.id] = {
      parents: (c.parents ?? []).filter(known),
      children: (graph.children.get(c.id) ?? []).slice(),
      spouses: (c.spouse ?? []).filter(known).map((id) => ({ id })),
      betrothed: (c.betrothed ?? []).filter(known).map((id) => ({ id })),
      ...c.twin && known(c.twin) ? { twin: { id: c.twin } } : {},
      siblings: sibs,
      kin: (c.kin ?? []).filter((k) => known(k.id)),
      generation: depth.get(c.id) ?? 0,
    };
  }
  // The reverses, marked as such, exactly as event links are (§4.5).
  for (const c of characters) {
    for (const key of ['spouses', 'betrothed'] as const) {
      for (const tie of family[c.id][key].filter((t) => !t.reverse)) {
        const other = family[tie.id];
        if (other && !other[key].some((t) => t.id === c.id)) other[key].push({ id: c.id, reverse: true });
      }
    }
    const twin = family[c.id].twin;
    if (twin && !twin.reverse && family[twin.id] && !family[twin.id].twin) family[twin.id].twin = { id: c.id, reverse: true };
  }

  // ---- houses: the connected parts of the parentage graph, named where the books name them ----
  const parts = houseParts(graph);
  const alone = characters.filter((c) => c.house && !parts.some((p) => p.includes(c.id))).map((c) => [c.id]);
  const houses: House[] = [];
  for (const members of [...parts, ...alone]) {
    const named = members.filter((m) => byId.get(m)?.house);
    for (const extra of named.slice(1)) {
      C.warn(fileOf(extra), `house: "${named[0]}" already names this house; one name per house (the members are derived)`);
    }
    // Among the shallowest members, the one the house actually descends from -- i.e. with the
    // most descendants -- not whichever sorts first. A spouse who married in stands at depth 0
    // too, and naming Rohan's house after Theodwyn's husband or the Noldor's after a queen of
    // Numenor who married into it reads as a mistake, because it is one.
    const reach = (id: string) => descendants(graph, id).length;
    const eldest = [...members].sort((a, b) => (depth.get(a) ?? 0) - (depth.get(b) ?? 0)
      || reach(b) - reach(a)
      || a.localeCompare(b))[0];
    const id = named[0] ?? eldest;
    houses.push({ id, ...byId.get(id)?.house ? { name: byId.get(id)!.house! } : {}, members });
    for (const m of members) family[m].house = id;
  }

  // ---- `kin`: the closed list, and what has become derivable ----
  for (const c of characters) {
    const f = fileOf(c.id);
    (c.kin ?? []).forEach((k, i) => {
      if (!known(k.id)) return;
      if (!(KIN_WORDS as readonly string[]).includes(k.as)) {
        const how = HOW[REPLACEMENT[k.as]];
        C.error(f, how
          ? `kin[${i}].as: "${k.as}" ${how} (docs/DESIGN.md §4.11)`
          : `kin[${i}].as: "${k.as}" is not one of ${KIN_WORDS.join(', ')}; a word the tree cannot draw is nothing on the screen (docs/DESIGN.md §4.11)`);
        return;
      }
      // Fostering is never a consequence of descent -- Frodo is Bilbo's cousin *and* his
      // fosterling, and the second fact is the one §4.11 keeps the word for -- so a derived
      // relation never makes it a duplicate.
      if (NEVER_DERIVED.has(k.as)) return;
      // Still in the list, but the parentage now says it: the migration's own end marker.
      const derived = derivedRelation(graph, c.id, k.id);
      if (derived) C.warn(f, `kin[${i}]: "${k.id}" is already the ${derived} of "${c.id}" by \`parents:\`; delete this entry`);
    });
  }

  // ---- dates: from the event that declares them, or from the character; they must agree ----
  const eventById = new Map(events.map((e) => [e.id, e]));
  const fromEvent = new Map<string, { born?: LifeDeclaration; died?: LifeDeclaration }>();
  for (const d of declarations) {
    for (const what of ['born', 'died'] as const) {
      for (const cid of d[what]) {
        const slot = fromEvent.get(cid) ?? {};
        const already = slot[what];
        if (already) C.error(d.file, `${what}: "${already.event}" already declares this ${what === 'born' ? 'birth' : 'death'} of "${cid}"`);
        else { slot[what] = d; fromEvent.set(cid, slot); }
      }
    }
  }
  for (const c of characters) {
    const f = fileOf(c.id);
    for (const what of ['born', 'died'] as const) {
      const decl = fromEvent.get(c.id)?.[what];
      const stated = c[what];
      if (!decl) continue;
      const e = eventById.get(decl.event);
      const theirs: LifeDate = {
        ...e?.when ? { date: e.when.start, precision: e.when.precision } : {},
        ...e?.span ? { span: e.span } : {},
        event: decl.event,
      };
      if (!stated) { c[what] = theirs; continue; }
      // Two sources are safe only because they are checked against each other.
      if (stated.span && theirs.span && !overlaps(stated.span, theirs.span)) {
        C.error(f, `${what}: outside the honest range of "${decl.event}", which declares this ${what === 'born' ? 'birth' : 'death'}`);
      }
      // The narrower of the two honest ranges, and always the event it came from.
      const width = (s?: Span) => (s ? s.to - s.from : Infinity);
      c[what] = width(theirs.span) < width(stated.span) ? theirs : { ...stated, event: decl.event };
    }
    if (c.born?.span && c.died?.span && c.born.span.from > c.died.span.to + EPS) {
      C.error(f, 'born: after `died` (check the dates, or which event declares which)');
    }
  }
  // A wide honest range often overlaps the next generation's, so this is a warning, not an error.
  for (const c of characters) for (const p of family[c.id].parents) {
    const parent = byId.get(p)!;
    if (parent.born?.span && c.born?.span && parent.born.span.from > c.born.span.to + EPS) {
      C.warn(fileOf(c.id), `parents: "${p}" is born after "${c.id}" (check the dates)`);
    }
  }

  return { family, houses };
}

/**
 * Does this character stand in the parentage graph? A genealogy person legitimately has no
 * scene — a hobbit grandparent exists to join two families — so they are exempt from the
 * "appears in no event or journey" warning.
 */
/**
 * Does a parentage edge, or a tie that stands in for one, reach this character? Such a character
 * needs no scene: a hobbit grandparent exists to join two families. `ancestor`/`descendant` and
 * `foster-parent`/`fosterling` count, because §4.11 names exactly those for the people parentage
 * cannot reach -- Durin I, who awoke and was not begotten and whose heirs descend through
 * generations no source names, and Frodo, who is Bilbo's heir and not his son. A `cousin` or `kin`
 * tie does not count: it joins two people already in the graph rather than anchoring one to it.
 */
export const standsInParentage = (f: Family | undefined): boolean => !!f
  && (!!f.parents.length || !!f.children.length
    || (f.kin ?? []).some((k) => STANDS_IN.has(k.as)));

/** Ties that put somebody in the graph on their own (docs/DESIGN.md §4.11). */
const STANDS_IN = new Set(['ancestor', 'descendant', 'foster-parent', 'fosterling']);

/** Words descent cannot restate, so a derived relation never duplicates them. */
const NEVER_DERIVED = new Set(['foster-parent', 'fosterling']);
