// Character lanes (docs/DESIGN.md §3.2): lives side by side. Each chosen character is a lane
// of their events and journey legs (index.lanes, from the content build), all in one story
// order; where lanes share an event they cross. Dates shown are honest ranges only; the best
// guess (`at`) only places journey legs between events. The rows themselves are built in
// laneRows.ts.

import { index } from './chronicle';
import { valianYears } from './data/calendar';
import type { Character, Lang } from './data/types';
import { h } from './dom';
import { shortDate } from './format';
import { ICONS } from './icons';
import { kinPhrase, t as ui, tr, type UiKey } from './i18n';
import { buildRows, laneInitials, matchRank } from './laneRows';
import { eventHref, livesHref } from './routes';

export interface LanesHost {
  lang(): Lang;
  /** Change which lanes are shown (in this order), in place. */
  setLanes(ids: string[]): void;
}

export const MAX_LANES = 8;
/** Below this width (the phone layout) at most PHONE_LANES lanes are drawn, so the text keeps room. */
export const PHONE_QUERY = '(max-width: 720px)';
export const PHONE_LANES = 4;

/** Lane colours: light, distinct hues that read on the night ground; gold stays the accent. */
const PALETTE = ['#8fc1e3', '#e39a8f', '#a8d08d', '#c3a6e6', '#e6b98a', '#7fd1c1', '#e3a8c9', '#d9d6c3'];
export const laneColor = (i: number) => PALETTE[i % PALETTE.length];

/** Characters that have a lane worth showing. */
export const hasLane = (id: string) => (index.lanes[id]?.length ?? 0) > 0;

/** Up to one pair of characters per age who share the most events: a way in for new visitors. */
function crossingPairs(): { a: Character; b: Character; n: number }[] {
  const best = new Map<string, { a: string; b: string; n: number }>();
  const counts = new Map<string, number>();
  for (const e of index.events) {
    const cs = e.characters.filter(hasLane);
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const k = `${e.age}|${[cs[i], cs[j]].sort().join('|')}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  for (const [k, n] of counts) {
    const [age, a, b] = k.split('|');
    const cur = best.get(age);
    if (!cur || n > cur.n) best.set(age, { a, b, n });
  }
  const ch = (id: string) => index.characters.find((c) => c.id === id)!;
  const ageOrder = (id: string) => index.ages.find((x) => x.id === id)?.order ?? 99;
  return [...best.entries()].sort((x, y) => ageOrder(x[0]) - ageOrder(y[0])).map(([, p]) => ({ a: ch(p.a), b: ch(p.b), n: p.n }));
}

const isPhone = () => typeof matchMedia === 'function' && matchMedia(PHONE_QUERY).matches;

export function renderLanes(root: HTMLElement, idsIn: string[], host: LanesHost): void {
  const L = host.lang();
  const S = (k: UiKey) => ui(k, L);
  const ids = [...new Set(idsIn)].filter((id) => index.characters.some((c) => c.id === id)).slice(0, MAX_LANES);
  const char = (id: string) => index.characters.find((c) => c.id === id)!;
  const name = (id: string) => tr(char(id)?.name, L);
  const kind = (c: Character) => ui(`kind_${c.kind}` as UiKey, L) || c.kind;
  const placeName = (id?: string) => tr(index.places.find((p) => p.id === id)?.name, L);
  root.innerHTML = '';

  const art = h('article', { class: 'reader lanes-page', lang: L });
  art.append(
    h('p', { class: 'r-over' }, S('title_lives')),
    h('h1', { class: 'r-title', tabindex: '-1' }, S('livesTitle')),
    h('p', { class: 'lp-intro' }, S('livesIntro')),
  );

  // ---- The chosen lives, and a way to add more ----
  const picks = h('div', { class: 'lp-picks' });
  const chips = h('ul', { class: 'lp-chips' });
  ids.forEach((id, i) => {
    const x = h('button', { type: 'button', class: 'lp-x', 'aria-label': `${S('removeLife')}: ${name(id)}`, title: S('removeLife'), html: ICONS.close });
    x.addEventListener('click', () => host.setLanes(ids.filter((y) => y !== id)));
    chips.append(h('li', { class: 'lp-chip', style: `--c: ${laneColor(i)}` }, h('span', { class: 'lp-dot', 'aria-hidden': 'true' }), h('span', {}, name(id)), x));
  });
  picks.append(chips);
  if (ids.length < MAX_LANES) picks.append(addBox(ids, host, L, kind));
  else picks.append(h('p', { class: 'r-quiet' }, S('lanesMax')));
  art.append(picks);

  // ---- Kin suggestions: "Túrin Turambar, cousin of Tuor", each a link to the lanes with them added ----
  const kin: { id: string; text: string }[] = [];
  for (const id of ids) for (const k of char(id).kin ?? []) {
    if (ids.includes(k.id) || kin.some((x) => x.id === k.id) || !hasLane(k.id)) continue;
    kin.push({ id: k.id, text: kinPhrase(k.as, name(k.id), name(id), L) });
  }
  if (kin.length && ids.length < MAX_LANES) {
    const row = h('div', { class: 'lp-kin' }, h('span', { class: 'r-label' }, S('kinOf')));
    for (const k of kin.slice(0, 10)) {
      row.append(h('a', { class: 'lp-kin-btn', href: livesHref([...ids, k.id], L) }, h('span', { class: 'lp-plus', 'aria-hidden': 'true' }, '+'), k.text));
    }
    art.append(row);
  }

  // ---- No lives yet: pairs whose paths cross, one per age ----
  if (!ids.length) {
    const pairs = crossingPairs();
    if (pairs.length) {
      const ul = h('ul', { class: 'lp-pairs' });
      for (const p of pairs) {
        ul.append(h('li', {}, h('a', { class: 'lp-pair', href: livesHref([p.a.id, p.b.id], L) },
          h('span', { class: 'lp-pair-names' }, `${tr(p.a.name, L)}  &  ${tr(p.b.name, L)}`),
          h('span', { class: 'r-when' }, p.n === 1 ? S('sharedEvent') : `${p.n} ${S('sharedEvents')}`))));
      }
      art.append(h('section', { class: 'r-section' },
        h('h2', { class: 'r-h' }, h('span', {}, S('livesThatCross')), h('span', { class: 'rule' }), h('span', { class: 'diamond' })), ul));
    }
    art.append(h('footer', { class: 'r-foot' }, S('disclaimer')));
    root.append(art);
    return;
  }

  // ---- The lanes: on a phone only the first few, so the text keeps room ----
  const shown = isPhone() ? ids.slice(0, PHONE_LANES) : ids;
  if (shown.length < ids.length) {
    art.append(h('p', { class: 'r-quiet lp-showing' }, S('lanesShowing').replace('{n}', String(shown.length)).replace('{m}', String(ids.length))));
  }
  const rows = buildRows(index, shown);
  const first = shown.map((_, i) => rows.findIndex((r) => r.lanes.includes(i)));
  const last = shown.map((_, i) => rows.length - 1 - [...rows].reverse().findIndex((r) => r.lanes.includes(i)));
  const grid = h('div', { class: 'lanes', style: `--n: ${shown.length}` });
  const head = h('div', { class: 'ln-head' });
  const initials = laneInitials(shown.map(name));
  shown.forEach((id, i) => head.append(h('span', { class: 'ln-cell' },
    h('span', { class: `ln-initial${initials[i].length > 1 ? ' two' : ''}`, style: `--c: ${laneColor(i)}`, title: name(id), 'aria-label': name(id) }, initials[i]))));
  head.append(h('span', { class: 'ln-head-label' }, S('storyOrder')));
  grid.append(head);

  rows.forEach((r, ri) => {
    const crossing = r.kind === 'event' && r.lanes.length > 1;
    const row = h('div', { class: `ln-row ln-${r.kind}${crossing ? ' crossing' : ''}` });
    shown.forEach((_, i) => {
      const on = r.lanes.includes(i);
      const active = first[i] >= 0 && ri >= first[i] && ri <= last[i];
      const cls = ['ln-cell'];
      if (active && ri > first[i]) cls.push('up');
      if (active && ri < last[i]) cls.push('down');
      if (on) cls.push(r.kind === 'leg' ? 'ln-at-leg' : 'ln-at');
      row.append(h('span', { class: cls.join(' '), style: `--c: ${laneColor(i)}` }, on && h('i', { class: 'ln-dot' })));
    });
    if (crossing) {
      const lo = Math.min(...r.lanes), hi = Math.max(...r.lanes);
      row.append(h('span', { class: 'ln-x', 'aria-hidden': 'true', style: `--lo: ${lo}; --hi: ${hi}` }));
    }
    const body = h('div', { class: 'ln-body' });
    if (r.kind === 'event') {
      const e = r.event;
      if (crossing) {
        // Full names, each with its lane's colour, so lanes that share an initial are told apart.
        const who = h('span', { class: 'ln-cross' }, h('span', {}, `${S('pathsCross')} ·`));
        r.lanes.forEach((i, k) => {
          who.append(h('span', { class: 'ln-who', style: `--c: ${laneColor(i)}` },
            h('span', { class: 'lp-dot', 'aria-hidden': 'true' }), name(shown[i]) + (k < r.lanes.length - 1 ? ',' : '')));
        });
        body.append(who);
      }
      body.append(
        h('a', { class: `r-ev ln-title${e.stage ? ' staged' : ''}`, href: eventHref(e.id, L), title: S(e.stage ? 'playable' : 'readable') },
          h('span', { class: 'ev-dot', 'aria-hidden': 'true' }), h('span', { class: 'r-ev-name' }, tr(e.title, L))),
        h('span', { class: 'r-when' }, [shortDate(e, L), placeName(e.place)].filter(Boolean).join('  ·  ')));
    } else if (r.kind === 'leg') {
      const w = r.waypoint;
      const when = { start: w.date, end: w.end, precision: w.precision, endPrecision: w.endPrecision };
      body.append(
        h('span', { class: 'ln-place' }, placeName(w.place)),
        h('span', { class: 'r-when' }, [shortDate({ age: w.date.age, when }, L), tr(r.journey.title, L)].filter(Boolean).join('  ·  ')));
    } else if (r.kind === 'age') {
      body.append(h('span', { class: 'ln-age-name' }, tr(r.age.name, L)));
    } else {
      const v = valianYears(r.age);
      const text = r.years === 1 ? S(v ? 'valianYearLater' : 'yearLater')
        : S(v ? 'valianYearsLater' : 'yearsLater').replace('{n}', r.years.toLocaleString(L));
      body.append(h('span', { class: 'ln-gap-text' }, text));
    }
    row.append(body);
    grid.append(row);
  });
  art.append(grid);
  art.append(h('footer', { class: 'r-foot' }, S('disclaimer')));
  root.append(art);
}

/**
 * The "Add a life…" search: a combobox. Typing lists matches (whole name, then name start,
 * then word start, then anywhere); ArrowUp/ArrowDown move through them, Enter adds the one
 * chosen (or the best match), Escape closes the list.
 */
function addBox(ids: string[], host: LanesHost, L: Lang, kind: (c: Character) => string): HTMLElement {
  const box = h('div', { class: 'lp-add' });
  const listId = 'lp-suggest';
  const input = h('input', {
    type: 'search', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': listId,
    placeholder: ui('addLife', L), 'aria-label': ui('addLife', L), autocomplete: 'off',
  }) as HTMLInputElement;
  const list = h('ul', { class: 'lp-suggest', role: 'listbox', id: listId, 'aria-label': ui('suggestions', L) });
  const candidates = index.characters.filter((c) => hasLane(c.id) && !ids.includes(c.id));
  let matches: Character[] = [];
  let active = -1;
  const pick = (c: Character) => host.setLanes([...ids, c.id]);

  const paint = () => {
    list.innerHTML = '';
    matches.forEach((c, i) => {
      const li = h('li', { role: 'option', id: `${listId}-${i}`, class: i === active ? 'active' : undefined, 'aria-selected': i === active ? 'true' : 'false' },
        h('span', {}, tr(c.name, L)), h('span', { class: 'lp-kind' }, kind(c)));
      li.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
      li.addEventListener('click', () => pick(c));
      list.append(li);
    });
    input.setAttribute('aria-expanded', String(matches.length > 0));
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', `${listId}-${active}`);
      list.children[active]?.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };
  const search = () => {
    const q = input.value;
    matches = candidates
      .map((c) => ({ c, r: matchRank(tr(c.name, L), q) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || tr(a.c.name, L).localeCompare(tr(b.c.name, L), L))
      .slice(0, 8)
      .map((x) => x.c);
    active = -1;
    paint();
  };

  input.addEventListener('input', search);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!matches.length) search();
      if (!matches.length) return;
      e.preventDefault();
      const n = matches.length;
      active = e.key === 'ArrowDown' ? (active + 1) % n : active <= 0 ? n - 1 : active - 1;
      paint();
    } else if (e.key === 'Enter') {
      if (!matches.length) return;
      e.preventDefault();
      pick(matches[Math.max(active, 0)]);
    } else if (e.key === 'Escape' && matches.length) {
      matches = [];
      active = -1;
      paint();
    }
  });
  input.addEventListener('blur', () => { matches = []; active = -1; paint(); });
  box.append(h('label', { class: 'sb-search', html: ICONS.search }, input), list);
  return box;
}
