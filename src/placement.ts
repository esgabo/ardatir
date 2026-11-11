// Explaining a best guess in words (docs/DESIGN.md §4.4): how an event is placed on the
// timeline (from its `atReason`), and why another event is "likely" or "possibly" at the
// same time. The guess itself is never shown as a date: only the honest range, and what
// the guess was placed between.

import { characterMap, eventById } from './chronicle';
import { likelyWindow, vaguer, within } from './data/calendar';
import type { EventSummary, Lang, Span } from './data/types';
import { h } from './dom';
import { honestDate } from './format';
import { t as ui, tr, type UiKey } from './i18n';
import { eventHref } from './routes';

/** A piece of an explanation: words, or an event named with its honest date. */
export type Part = string | { event: EventSummary };

/** A date label inside a sentence: "autumn, T.A. 2941" (seasons and "around" lowercased; months and abbreviations kept). */
export function inSentence(label: string, L: Lang): string {
  const word = L === 'en' ? /^(Spring|Summer|Autumn|Winter|Around)\b/ : /^\p{Lu}\p{Ll}/u;
  return word.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
}

/** Fill `{a}`-style slots in an interface string with parts (strings or events). */
function fill(key: UiKey, L: Lang, slots: Record<string, Part>): Part[] {
  const out: Part[] = [];
  for (const piece of ui(key, L).split(/(\{\w+\})/)) {
    const m = /^\{(\w+)\}$/.exec(piece);
    const v = m ? slots[m[1]] : piece;
    if (v !== undefined && v !== '') out.push(v);
  }
  return out;
}

/** "Bilbo's story", "Bilbo's and Thorin's stories" / "la historia de Bilbo", "las historias de Bilbo y Thorin". */
function storyOf(ids: string[], L: Lang): string {
  const names = ids.slice(0, 2).map((id) => tr(characterMap.get(id)?.name, L) || id);
  const s = names.length === 2
    ? ui('storyOf2', L).replace('{a}', names[0]).replace('{b}', names[1])
    : ui('storyOf1', L).replace('{a}', names[0] ?? '');
  // Spanish contracts "de El" in a name: "la historia del Gobernador de la Ciudad del Lago".
  return L === 'es' ? s.replace(/\bde El /g, 'del ') : s;
}

/**
 * How an event is placed on the timeline, from its `atReason`: its honest range, then what
 * the guess was placed between. Empty for timeless events and those with no reason.
 */
export function placementParts(ev: EventSummary, L: Lang): Part[] {
  const r = ev.atReason;
  if (!r || !ev.span) return [];
  const date = inSentence(honestDate(ev, L), L);
  if (r.kind === 'exact') return fill('place_exact', L, { date });
  const parts: Part[] = fill('place_range', L, { date });
  const sp = () => parts.push(' ');
  const a = r.after ? eventById(r.after) : undefined;
  const b = r.before ? eventById(r.before) : undefined;
  const story = storyOf(r.lane ?? [], L);
  switch (r.kind) {
    case 'between-anchors':
      if (a && b) { sp(); parts.push(...fill('place_between', L, { a: { event: a }, b: { event: b }, story })); }
      break;
    case 'after-anchor':
      if (a) { sp(); parts.push(...fill('place_after', L, { a: { event: a }, story })); }
      break;
    case 'before-anchor':
      if (b) { sp(); parts.push(...fill('place_before', L, { b: { event: b }, story })); }
      break;
    case 'range-midpoint':
      sp(); parts.push(...fill('place_middle', L, {}));
      return parts;
    case 'spaced-in-range':
      sp(); parts.push(...fill('place_spaced', L, { n: String((r.shared ?? 2) - 1) }));
      return parts;
    case 'after-predecessor': {
      const f = r.follows ? eventById(r.follows) : undefined;
      if (!f) break;
      const key: UiKey = r.via === 'caused-by' ? 'place_follows_caused' : r.via === 'enabled-by' ? 'place_follows_enabled' : 'place_follows_lane';
      sp(); parts.push(...fill(key, L, { a: { event: f }, story }));
      return parts;
    }
  }
  if (r.shared && r.shared > 1) { sp(); parts.push(...fill('place_shared', L, { n: String(r.shared - 1) })); }
  return parts;
}

/** Why `b` is "likely" at the same time as `a`: how close our guesses put them, then how `b` is placed. */
export function likelyParts(a: EventSummary, b: EventSummary, L: Lang): Part[] {
  const p = vaguer(a.when?.precision, b.when?.precision);
  const w = likelyWindow(p);
  const lead = w === undefined ? [] : fill('likelyWithin', L, { w: ui(`within_${p}` as UiKey, L) });
  const placed = placementParts(b, L);
  return placed.length ? [...lead, ' ', ...placed] : lead;
}

/**
 * Why `b` is "likely" at a moment of the time cursor: its best guess falls inside the moment,
 * or within its own window of it; then how `b` is placed. `label` is the moment in words.
 */
export function likelyAtParts(label: string, span: Span, b: EventSummary, L: Lang): Part[] {
  const p = b.when?.precision;
  const inside = b.at !== undefined && within(b.at, span);
  const m = inSentence(label, L);
  const lead = inside ? fill('likelyDuring', L, { m })
    : likelyWindow(p) !== undefined ? fill('likelyNear', L, { m, w: ui(`within_${p}` as UiKey, L) }) : [];
  const placed = placementParts(b, L);
  return placed.length ? [...lead, ' ', ...placed] : lead;
}

/** Render parts as inline nodes: events become links, with their honest date in brackets. */
export function renderParts(parts: Part[], L: Lang): Node[] {
  return parts.map((p) => typeof p === 'string'
    ? document.createTextNode(p)
    : h('span', { class: 'why-ev' },
      h('a', { href: eventHref(p.event.id, L) }, tr(p.event.title, L)),
      ` (${inSentence(honestDate(p.event, L), L)})`));
}

/** Parts as plain text (tests, labels): events as "Title (date)". */
export function partsText(parts: Part[], L: Lang): string {
  return parts.map((p) => (typeof p === 'string' ? p : `${tr(p.event.title, L)} (${inSentence(honestDate(p.event, L), L)})`)).join('');
}

let whyCount = 0;

/**
 * A small, accessible "why?" affordance: an info button that shows or hides a short
 * explanation right after it (not a hover-only tooltip). Returns the button and the note.
 */
export function whyToggle(label: string, parts: Part[], L: Lang): [HTMLButtonElement, HTMLElement] {
  const id = `why-${++whyCount}`;
  const note = h('p', { class: 'why-note', id, hidden: true }, ...renderParts(parts, L));
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
