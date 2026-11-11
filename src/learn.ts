// Learning on demand (docs/DESIGN.md §3.5): how to say a hard name, where to read an event in
// the books, and the stage's "About this scene" panel (who is this, where is this, what came
// before, what comes next). Built from what the index already has: character and place
// summaries, story order, an event's arcs and `source`. Event pages (reader.ts) use the same pieces.

import { characterMap, index } from './chronicle';
import { readItIn } from './books';
import { syllables } from './data/pronounce';
import type { EventSummary, Lang, LocalizedText } from './data/types';
import { h } from './dom';
import { honestDate } from './format';
import { foretoldBadge } from './foretold';
import { ICONS } from './icons';
import { t as ui, tr, type UiKey } from './i18n';
import { hasLane } from './lanes';
import { eventHref, livesHref } from './routes';

/**
 * The small "how to say it" hint after a name: `ee-LOO-va-tar`, the stressed syllable in gold
 * capitals. Screen readers hear "How to say it: ee-loo-va-tar" (small letters, so it is read as
 * a word, not spelled out). Nothing when there is no respelling for this language (or English).
 */
export function sayHint(p: LocalizedText | undefined, L: Lang): HTMLElement | null {
  const s = p ? (p[L] ?? p.en) : '';
  if (!s) return null;
  const shown = h('span', { class: 'say-text', 'aria-hidden': 'true' });
  syllables(s).forEach((word, w) => {
    if (w) shown.append(' ');
    word.forEach((syl, k) => {
      if (k) shown.append(h('span', { class: 'say-dash' }, '-'));
      shown.append(syl.stressed ? h('b', {}, syl.text) : syl.text);
    });
  });
  return h('span', { class: 'say', title: ui('sayIt', L) },
    h('span', { class: 'sr-only' }, `${ui('sayIt', L)}: ${s.toLowerCase()}`), shown);
}

/**
 * "Read this in The Hobbit, chapter 5, “Riddles in the Dark”." with a gentle line after it:
 * our telling is short, Tolkien's is the real thing. Nothing when the event cites no source.
 */
export function bookPointer(ev: EventSummary, L: Lang, cls = 'book-ptr'): HTMLElement | null {
  if (!ev.source) return null;
  const p = readItIn(ev.source, L);
  return h('div', { class: cls },
    h('span', { class: 'book-ptr-icon', html: ICONS.books }),
    h('p', {}, h('span', { class: 'book-ptr-line' }, p.before, h('cite', {}, p.book), p.after),
      h('span', { class: 'book-ptr-sub' }, ui('readInSub', L))));
}

/**
 * A small (i) button that opens a note under it on demand, like the "why likely" toggles
 * (placement.ts): a real button with aria-expanded, never hover-only.
 */
let infoCount = 0;
export function infoToggle(label: string, body: Node[]): [HTMLButtonElement, HTMLElement] {
  const id = `info-${++infoCount}`;
  const note = h('div', { class: 'info-note', id, hidden: true }, ...body);
  const btn = h('button', { class: 'why-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': id, 'aria-label': label, title: label }, 'i');
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = note.hidden;
    note.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  return [btn, note];
}

/** The event before and after this one: in its first story (arc) when it has one, else in the whole chronicle. */
export function storyNeighbours(ev: EventSummary): { prev?: EventSummary; next?: EventSummary } {
  const byId = (id?: string) => (id ? index.events.find((e) => e.id === id) : undefined);
  const arc = index.arcs.find((a) => ev.arcs.includes(a.id));
  const list = arc ? arc.events : index.events.map((e) => e.id);
  const i = list.indexOf(ev.id);
  return { prev: byId(list[i - 1]), next: byId(list[i + 1]) };
}

export interface LearnHost {
  lang(): Lang;
  /** Select a character on the stage (their card opens), when the stage has them. */
  select(id: string): boolean;
}

/**
 * The stage's "About this scene" panel: where it is, who is in it (with how to say their names),
 * what came before and what comes next, and where to read it.
 */
export function renderLearn(root: HTMLElement, ev: EventSummary, host: LearnHost): void {
  const L = host.lang();
  const S = (k: UiKey) => ui(k, L);
  root.innerHTML = '';
  root.setAttribute('lang', L);
  root.append(h('h2', { class: 'learn-title' }, S('aboutScene')));

  const section = (title: string, ...body: (Node | null)[]) => {
    root.append(h('h3', {}, title), ...body.filter((x): x is Node => !!x));
  };

  // A note on the sources, when the scene had to choose (it answers "why does it look like this?").
  if (ev.note) section(S('sceneNote'), h('p', { class: 'learn-note' }, tr(ev.note, L)));

  // Where is this?
  const place = index.places.find((p) => p.id === ev.place);
  const age = index.ages.find((a) => a.id === ev.age);
  if (place) {
    section(S('whereIsThis'),
      h('p', { class: 'learn-name' }, tr(place.name, L), sayHint(place.pronounce, L)),
      h('p', { class: 'learn-sum' }, tr(place.summary, L)));
  } else if (age) {
    // The Music has no place: say when instead, in the words of its age.
    section(S('whenIsThis'),
      h('p', { class: 'learn-name' }, tr(age.name, L), sayHint(age.pronounce, L)),
      h('p', { class: 'learn-sum' }, tr(age.summary, L)));
  }

  // Who is this?
  const people = ev.characters.map((id) => characterMap.get(id)).filter((c) => !!c);
  if (people.length) {
    const ul = h('ul', { class: 'learn-who' });
    for (const c of people) {
      const kind = ui(`kind_${c.kind}` as UiKey, L) || c.kind;
      const name = h('button', { type: 'button', class: 'learn-person', title: S('showOnStage') }, tr(c.name, L));
      name.addEventListener('click', () => { if (!host.select(c.id)) location.hash = livesHref([c.id], L); });
      ul.append(h('li', {},
        h('p', { class: 'learn-name' }, name, sayHint(c.pronounce, L), h('span', { class: 'learn-kind' }, kind)),
        h('p', { class: 'learn-sum' }, tr(c.summary, L)),
        hasLane(c.id) && h('a', { class: 'learn-more', href: livesHref([c.id], L) }, `${S('followLife')} →`)));
    }
    section(S('whoIsThis'), ul);
  }

  // What came before, what comes next (in this story).
  const { prev, next } = storyNeighbours(ev);
  const link = (e: EventSummary | undefined, label: string) => e && h('a', { class: `learn-ev${e.stage ? ' staged' : ''}`, href: eventHref(e.id, L) },
    h('span', { class: 'r-label' }, label),
    h('span', { class: 'learn-ev-title' }, h('span', { class: 'ev-dot', 'aria-hidden': 'true' }), tr(e.title, L), foretoldBadge(e, L)),
    h('span', { class: 'r-when' }, honestDate(e, L)));
  if (prev || next) section(S('beforeAndAfter'), h('div', { class: 'learn-nav' }, link(prev, S('happenedBefore')), link(next, S('comesNext'))));

  // In the books.
  const ptr = bookPointer(ev, L);
  if (ptr) section(S('inTheBooks'), ptr);
}
