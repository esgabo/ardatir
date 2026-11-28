/**
 * The parentage graph: everything a family tree needs, derived from the one authored edge
 * `parents` (docs/DESIGN.md §3.6, §4.11). Pure and tested, like laneRows.ts and whereabouts.ts:
 * no files, no dates, no DOM — ids in, relations out.
 *
 * Nothing here is ever authored. Siblings, half-siblings, ancestors, descendants, cousins,
 * uncles, nephews, generation depth and the houses are all consequences of `parents`, and
 * authoring one of them would be writing the same fact twice (§4.11).
 */

/** Who each character's parents are: the authored edge, and the only input these functions need. */
export interface KinGraph {
  /** Parents of each character, 0–2 ids, order meaningless. */
  parents: Map<string, string[]>;
  /** Children of each character: derived from `parents`, in the order the parents were read. */
  children: Map<string, string[]>;
}

/** Build the graph from the authored parentage. Ids with no entry simply have no parents. */
export function kinGraph(parents: Iterable<readonly [string, readonly string[]]>): KinGraph {
  const p = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const [id, ps] of parents) {
    const mine = [...new Set(ps)];
    p.set(id, mine);
    for (const parent of mine) {
      const kids = children.get(parent) ?? [];
      if (!kids.includes(id)) kids.push(id);
      children.set(parent, kids);
    }
  }
  return { parents: p, children };
}

const parentsOf = (g: KinGraph, id: string) => g.parents.get(id) ?? [];
const childrenOf = (g: KinGraph, id: string) => g.children.get(id) ?? [];

/** Everyone the graph knows anything about (a parent, a child, or both). */
export function peopleOf(g: KinGraph): string[] {
  const all = new Set<string>();
  for (const [id, ps] of g.parents) { all.add(id); for (const p of ps) all.add(p); }
  return [...all];
}

/**
 * A sibling: someone who shares at least one parent. `half` is true only when the sources are
 * clear about it — one shared parent while each has a second, different one (Fëanor and
 * Fingolfin). One known parent apiece says nothing either way, so it stays a plain sibling:
 * silence is silence (§4.11).
 */
export interface Sibling {
  id: string;
  half: boolean;
  /** The parents the two share. */
  shared: string[];
}

export function siblings(g: KinGraph, id: string): Sibling[] {
  const mine = parentsOf(g, id);
  const out: Sibling[] = [];
  for (const p of mine) for (const other of childrenOf(g, p)) {
    if (other === id || out.some((s) => s.id === other)) continue;
    const theirs = parentsOf(g, other);
    const shared = mine.filter((x) => theirs.includes(x));
    out.push({ id: other, half: shared.length === 1 && mine.length > 1 && theirs.length > 1, shared });
  }
  return out;
}

/** How far above `id` each ancestor stands (a parent is 1). Cycle-safe. */
export function ancestorDepths(g: KinGraph, id: string): Map<string, number> {
  const depth = new Map<string, number>();
  let front = [id];
  for (let up = 1; front.length; up++) {
    const next: string[] = [];
    for (const x of front) for (const p of parentsOf(g, x)) {
      if (p === id || depth.has(p)) continue;
      depth.set(p, up);
      next.push(p);
    }
    front = next;
  }
  return depth;
}

/** Every ancestor, nearest first. */
export const ancestors = (g: KinGraph, id: string): string[] =>
  [...ancestorDepths(g, id)].sort((a, b) => a[1] - b[1]).map(([x]) => x);

/** How far below `id` each descendant stands (a child is 1). Cycle-safe. */
export function descendantDepths(g: KinGraph, id: string): Map<string, number> {
  const depth = new Map<string, number>();
  let front = [id];
  for (let down = 1; front.length; down++) {
    const next: string[] = [];
    for (const x of front) for (const c of childrenOf(g, x)) {
      if (c === id || depth.has(c)) continue;
      depth.set(c, down);
      next.push(c);
    }
    front = next;
  }
  return depth;
}

/** Every descendant, nearest first. */
export const descendants = (g: KinGraph, id: string): string[] =>
  [...descendantDepths(g, id)].sort((a, b) => a[1] - b[1]).map(([x]) => x);

/**
 * The nearest ancestor two people share, and how far above each of them it stands. The sentence
 * §3.6 puts under two cards (*They share an ancestor: Finwë, four generations above Galadriel
 * and six above Gil-galad*) comes straight from this. A person counts as their own ancestor
 * here, so a parent and child share the parent, one generation up and zero.
 */
export function nearestCommonAncestor(
  g: KinGraph, a: string, b: string,
): { id: string; upA: number; upB: number } | undefined {
  const up = (x: string) => { const m = ancestorDepths(g, x); m.set(x, 0); return m; };
  const ua = up(a), ub = up(b);
  let best: { id: string; upA: number; upB: number } | undefined;
  for (const [id, da] of ua) {
    const db = ub.get(id);
    if (db === undefined) continue;
    const sum = da + db;
    if (!best || sum < best.upA + best.upB) best = { id, upA: da, upB: db };
  }
  return best;
}

/**
 * Generation depth: 0 for everyone the content gives no parents, and one more than the deepest
 * parent otherwise. It is a row in the tree, never a date — descent is not time (§3.6).
 * Cycle-safe: a character caught in a cycle is given the depth of its entry point.
 */
export function generations(g: KinGraph): Map<string, number> {
  const depth = new Map<string, number>();
  const open = new Set<string>();
  const walk = (id: string): number => {
    const seen = depth.get(id);
    if (seen !== undefined) return seen;
    if (open.has(id)) return 0;
    open.add(id);
    const ps = parentsOf(g, id);
    const d = ps.length ? Math.max(...ps.map(walk)) + 1 : 0;
    open.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const id of peopleOf(g)) walk(id);
  return depth;
}

/** The ids on a parentage cycle, if there is one: nobody may be their own ancestor (§4.11). */
export function parentageCycle(g: KinGraph): string[] | undefined {
  const done = new Set<string>();
  const path: string[] = [];
  const open = new Set<string>();
  const walk = (id: string): string[] | undefined => {
    if (open.has(id)) return [...path.slice(path.indexOf(id)), id];
    if (done.has(id)) return undefined;
    open.add(id);
    path.push(id);
    for (const p of parentsOf(g, id)) {
      const found = walk(p);
      if (found) return found;
    }
    path.pop();
    open.delete(id);
    done.add(id);
    return undefined;
  };
  for (const id of peopleOf(g)) {
    const found = walk(id);
    if (found) return found;
  }
  return undefined;
}

/**
 * The houses: the connected parts of the parentage graph, each a list of ids. A house is the
 * graph, not a content kind (§4.11), so it is found here and named by the build.
 */
export function houses(g: KinGraph): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const start of peopleOf(g)) {
    if (seen.has(start)) continue;
    const members: string[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const x = queue.shift()!;
      members.push(x);
      for (const y of [...parentsOf(g, x), ...childrenOf(g, x)]) if (!seen.has(y)) { seen.add(y); queue.push(y); }
    }
    out.push(members.sort());
  }
  return out;
}

/**
 * What `other` is to `subject`, where the parentage can say it: the same direction the authored
 * `kin` words read in (on Frodo, `{ id: bilbo, as: cousin }` says *Bilbo, cousin of Frodo*).
 * Gender is never guessed, so the words are the gender-free ones i18n already keeps (§3.2).
 * This is what tells the build that a `kin` entry has become derivable (§4.11).
 */
export type DerivedRelation =
  | 'parent' | 'child' | 'sibling' | 'half-sibling'
  | 'grandparent' | 'grandchild' | 'ancestor' | 'descendant'
  | 'uncle' | 'nephew' | 'cousin';

export function derivedRelation(g: KinGraph, subject: string, other: string): DerivedRelation | undefined {
  if (subject === other) return undefined;
  if (parentsOf(g, subject).includes(other)) return 'parent';
  if (parentsOf(g, other).includes(subject)) return 'child';
  const sib = siblings(g, subject).find((s) => s.id === other);
  if (sib) return sib.half ? 'half-sibling' : 'sibling';
  const up = ancestorDepths(g, subject).get(other);
  if (up !== undefined) return up === 2 ? 'grandparent' : 'ancestor';
  const down = descendantDepths(g, subject).get(other);
  if (down !== undefined) return down === 2 ? 'grandchild' : 'descendant';
  // A sibling of a parent, or the child of a sibling: one word each way, no gender.
  if (parentsOf(g, subject).some((p) => siblings(g, p).some((s) => s.id === other))) return 'uncle';
  if (parentsOf(g, other).some((p) => siblings(g, p).some((s) => s.id === subject))) return 'nephew';
  const common = nearestCommonAncestor(g, subject, other);
  if (common && common.upA >= 2 && common.upB >= 2) return 'cousin';
  return undefined;
}
