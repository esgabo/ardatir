// The parentage graph (src/kinGraph.ts): the one authored edge in, every relation a tree needs
// out. Pure, so these are the real checks on siblings, half-siblings, generations, ancestors and
// the nearest common ancestor. docs/DESIGN.md §3.6, §4.11.

import { describe, expect, it } from 'vitest';
import {
  ancestorDepths, ancestors, derivedRelation, descendants, generations, houses, kinGraph,
  nearestCommonAncestor, parentageCycle, peopleOf, siblings,
} from '../src/kinGraph.ts';

/**
 * The half-elven crossing, which is the reason the view exists: Eärendil and Elwing's twin sons,
 * and one generation each side. Only the edge `parents` is given; everything else is derived.
 */
const HOUSE = kinGraph([
  ['earendil', ['tuor', 'idril']],
  ['elwing', ['dior']],
  ['elrond', ['earendil', 'elwing']],
  ['elros', ['earendil', 'elwing']],
  ['arwen', ['elrond', 'celebrian']],
  ['eldarion', ['aragorn', 'arwen']],
]);

describe('the graph itself', () => {
  it('derives children from parents, and knows everyone an edge touches', () => {
    expect(HOUSE.children.get('earendil')).toEqual(['elrond', 'elros']);
    expect(HOUSE.children.get('celebrian')).toEqual(['arwen']);
    expect(HOUSE.children.get('eldarion')).toBeUndefined();
    expect(peopleOf(HOUSE)).toContain('tuor');   // a parent with no file of his own here
    expect(peopleOf(HOUSE)).not.toContain('gandalf');
  });

  it('ignores a parent listed twice', () => {
    const g = kinGraph([['a', ['p', 'p']]]);
    expect(g.parents.get('a')).toEqual(['p']);
    expect(g.children.get('p')).toEqual(['a']);
  });
});

describe('siblings', () => {
  it('stands two full siblings side by side, and says which parents they share', () => {
    expect(siblings(HOUSE, 'elrond')).toEqual([{ id: 'elros', half: false, shared: ['earendil', 'elwing'] }]);
  });

  it('marks a half-sibling as half, where each has a second, different parent', () => {
    // Fëanor and Fingolfin: one father, two mothers, and most of the First Age out of that fact.
    const g = kinGraph([['feanor', ['finwe', 'miriel']], ['fingolfin', ['finwe', 'indis']], ['finarfin', ['finwe', 'indis']]]);
    expect(siblings(g, 'feanor')).toEqual([
      { id: 'fingolfin', half: true, shared: ['finwe'] },
      { id: 'finarfin', half: true, shared: ['finwe'] },
    ]);
    expect(siblings(g, 'fingolfin').find((s) => s.id === 'finarfin')).toEqual({ id: 'finarfin', half: false, shared: ['finwe', 'indis'] });
  });

  it('claims nothing where only one parent apiece is known: silence is silence', () => {
    const g = kinGraph([['fili', ['dis']], ['kili', ['dis']]]);
    expect(siblings(g, 'fili')).toEqual([{ id: 'kili', half: false, shared: ['dis'] }]);
  });

  it('gives an only child, and a person with no parents, no siblings', () => {
    expect(siblings(HOUSE, 'arwen')).toEqual([]);
    expect(siblings(HOUSE, 'tuor')).toEqual([]);
    expect(siblings(kinGraph([]), 'nobody')).toEqual([]);
  });
});

describe('ancestors and descendants', () => {
  it('counts how far above and below each one stands', () => {
    expect(ancestorDepths(HOUSE, 'eldarion').get('elrond')).toBe(2);
    expect(ancestorDepths(HOUSE, 'eldarion').get('earendil')).toBe(3);
    expect(ancestors(HOUSE, 'arwen').slice(0, 2).sort()).toEqual(['celebrian', 'elrond']);
    expect(descendants(HOUSE, 'earendil')).toEqual(['elrond', 'elros', 'arwen', 'eldarion']);
    expect(ancestors(HOUSE, 'tuor')).toEqual([]);
    expect(descendants(HOUSE, 'eldarion')).toEqual([]);
  });

  it('never makes anybody their own ancestor or their own descendant', () => {
    expect(ancestorDepths(HOUSE, 'elrond').get('elrond')).toBeUndefined();
    expect(descendants(HOUSE, 'elrond')).not.toContain('elrond');
  });
});

describe('the nearest common ancestor', () => {
  it('finds the brothers two lines rejoin through, and how far up each side', () => {
    expect(nearestCommonAncestor(HOUSE, 'arwen', 'elros')).toEqual({ id: 'earendil', upA: 2, upB: 1 });
  });

  it('counts a parent as the pair\'s own ancestor, zero generations above themselves', () => {
    expect(nearestCommonAncestor(HOUSE, 'elrond', 'earendil')).toEqual({ id: 'earendil', upA: 1, upB: 0 });
  });

  it('finds none between two unrelated people', () => {
    expect(nearestCommonAncestor(HOUSE, 'elrond', 'gandalf')).toBeUndefined();
  });
});

describe('generation depth', () => {
  it('counts rows from the people the content gives no parents', () => {
    const d = generations(HOUSE);
    expect(d.get('tuor')).toBe(0);
    expect(d.get('earendil')).toBe(1);
    expect(d.get('elrond')).toBe(2);
    expect(d.get('eldarion')).toBe(4);
  });

  it('takes the deeper parent, so a marriage inside a house does not flatten a row', () => {
    const g = kinGraph([['b', ['a']], ['c', ['a']], ['d', ['b', 'z']], ['e', ['c', 'd']]]);
    expect(generations(g).get('e')).toBe(3);   // through d (2), not through c (1)
  });

  it('is zero for a person with no kin at all', () => {
    expect(generations(kinGraph([['a', []]])).get('a')).toBe(0);
  });
});

describe('cycles and houses', () => {
  it('finds a parentage cycle, and says who is on it', () => {
    const g = kinGraph([['a', ['b']], ['b', ['c']], ['c', ['a']]]);
    const cycle = parentageCycle(g)!;
    expect(cycle[0]).toBe(cycle.at(-1));
    expect(new Set(cycle)).toEqual(new Set(['a', 'b', 'c']));
    expect(parentageCycle(HOUSE)).toBeUndefined();
  });

  it('splits the graph into its connected parts', () => {
    const g = kinGraph([['b', ['a']], ['c', ['a']], ['y', ['x']]]);
    expect(houses(g)).toEqual([['a', 'b', 'c'], ['x', 'y']]);
    expect(houses(kinGraph([]))).toEqual([]);
  });
});

describe('what the parentage already says', () => {
  const rel = (a: string, b: string) => derivedRelation(HOUSE, a, b);

  it('reads in the direction the authored `kin` words read in', () => {
    expect(rel('elrond', 'earendil')).toBe('parent');
    expect(rel('earendil', 'elrond')).toBe('child');
    expect(rel('elrond', 'elros')).toBe('sibling');
    expect(rel('arwen', 'earendil')).toBe('grandparent');
    expect(rel('earendil', 'arwen')).toBe('grandchild');
    expect(rel('eldarion', 'earendil')).toBe('ancestor');
    expect(rel('earendil', 'eldarion')).toBe('descendant');
    expect(rel('arwen', 'elros')).toBe('uncle');
    expect(rel('elros', 'arwen')).toBe('nephew');
  });

  it('says half-sibling where the parents say so', () => {
    const g = kinGraph([['feanor', ['finwe', 'miriel']], ['fingolfin', ['finwe', 'indis']]]);
    expect(derivedRelation(g, 'feanor', 'fingolfin')).toBe('half-sibling');
  });

  it('says cousin without printing a degree', () => {
    const g = kinGraph([['b', ['a']], ['c', ['a']], ['d', ['b']], ['e', ['c']], ['f', ['e']]]);
    expect(derivedRelation(g, 'd', 'e')).toBe('cousin');
    expect(derivedRelation(g, 'd', 'f')).toBe('cousin');   // once removed, and we do not say so
  });

  it('says nothing about two people the parentage cannot join, or about somebody and themselves', () => {
    expect(rel('elrond', 'gandalf')).toBeUndefined();
    expect(rel('elrond', 'elrond')).toBeUndefined();
    expect(derivedRelation(kinGraph([]), 'a', 'b')).toBeUndefined();
  });
});
