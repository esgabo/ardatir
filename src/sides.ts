// A battle's sides in words, with each faction's banner colour as a small chip:
// "Elves of Mirkwood, Men of Lake-town and Dwarves of the Iron Hills against the Goblins and the
// Wargs" (docs/DESIGN.md §2, battles; §4.9). Used by event pages, the stage's event card,
// the time cursor's rows and the sidebar's search.

import { index } from './chronicle';
import type { EventSummary, Faction, Lang } from './data/types';
import { h } from './dom';
import { placeInSentence } from './format';
import { t as ui, tr } from './i18n';

export const factionById = (id: string): Faction | undefined => index.factions?.find((f) => f.id === id);

/** A faction's name with its banner colour; its summary on hover. `name` overrides the text (mid-sentence). */
export function factionChip(f: Faction, L: Lang, name = tr(f.name, L)): HTMLElement {
  return h('span', { class: 'fx', title: tr(f.summary, L) },
    h('span', { class: 'fx-dot', style: `background:${f.color}`, 'aria-hidden': 'true' }), name);
}

/** Nodes said as a list in the language: "A, B and C", "A, B y C". `labels` are their texts. */
export function listNodes(nodes: Node[], labels: string[], L: Lang): Node[] {
  let k = 0;
  return new Intl.ListFormat(L, { style: 'long', type: 'conjunction' }).formatToParts(labels)
    .map((p) => (p.type === 'element' ? nodes[k++] : document.createTextNode(p.value)));
}

/** One side as "A, B and C", each a chip; names after the first of the line take a small article ("and the Wargs"). */
function sideNodes(ids: string[], L: Lang, first: boolean): Node[] {
  const fs = ids.map(factionById).filter((f): f is Faction => !!f);
  const names = fs.map((f, k) => (first && !k ? tr(f.name, L) : placeInSentence(tr(f.name, L), L)));
  return listNodes(fs.map((f, k) => factionChip(f, L, names[k])), names, L);
}

/** The whole line, sides joined by "against" / "contra"; null when the event names no sides. */
export function sidesLine(ev: EventSummary, L: Lang, cls = 'fx-line'): HTMLElement | null {
  if (!ev.sides?.length) return null;
  const line = h('span', { class: cls });
  ev.sides.forEach((side, i) => {
    if (i) line.append(h('span', { class: 'fx-against' }, ` ${ui('against', L)} `));
    line.append(...sideNodes(side, L, i === 0));
  });
  return line;
}
