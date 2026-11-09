// Character lanes (docs/DESIGN.md §3.2): lives side by side. Each chosen character is a lane
// of their events and journey legs (index.lanes, from the content build), all in one story
// order; where lanes share an event they cross. Dates shown are honest ranges only; the best
// guess (`at`) only places journey legs between events.

import { index } from './chronicle';
import { yearsBetween } from './data/calendar';
import type { Age, Character, EventSummary, Journey, Lang, Span, Waypoint } from './data/types';
import { fold, h } from './dom';
import { shortDate } from './format';
import { ICONS } from './icons';
import { t as ui, tr, type UiKey } from './i18n';
import { eventHref } from './routes';

export interface LanesHost {
  lang(): Lang;
  /** Change which lanes are shown (in this order). */
  setLanes(ids: string[]): void;
}

export const MAX_LANES = 8;

/** Lane colours: light, distinct hues that read on the night ground; gold stays the accent. */
const PALETTE = ['#8fc1e3', '#e39a8f', '#a8d08d', '#c3a6e6', '#e6b98a', '#7fd1c1', '#e3a8c9', '#d9d6c3'];
export const laneColor = (i: number) => PALETTE[i % PALETTE.length];

type Row =
  | { kind: 'event'; event: EventSummary; lanes: number[] }
  | { kind: 'leg'; journey: Journey; waypoint: Waypoint; lanes: number[] }
  | { kind: 'age'; age: Age; lanes: number[] }
  | { kind: 'gap'; years: number; lanes: number[] };

/** Characters that have a lane worth showing. */
export const hasLane = (id: string) => (index.lanes[id]?.length ?? 0) > 0;

/**
 * Merge the chosen lanes into rows, in story order. Events are ordered as the index orders
 * them (story order); a journey leg follows the event before it in its own lane (or comes
 * before the first one), and legs shared by several lanes (the same place and range) are one row.
 */
function buildRows(ids: string[]): Row[] {
  const order = new Map(index.events.map((e, i) => [e.id, i]));
  const byId = new Map(index.events.map((e) => [e.id, e]));
  const events = new Map<string, Row & { kind: 'event' }>();
  const legs = new Map<string, Row & { kind: 'leg' }>();
  const keys = new Map<Row, [number, number, number]>();
  const unplaced: (Row & { kind: 'leg' })[] = [];

  ids.forEach((c, li) => {
    const lane = index.lanes[c] ?? [];
    let prev: string | undefined;
    const pendingLegs: (Row & { kind: 'leg' })[] = [];
    for (const entry of lane) {
      if ('event' in entry) {
        const e = byId.get(entry.event);
        if (!e) continue;
        let row = events.get(e.id);
        if (!row) { row = { kind: 'event', event: e, lanes: [] }; events.set(e.id, row); keys.set(row, [order.get(e.id)!, 1, 0]); }
        row.lanes.push(li);
        // Legs before this lane's first event come just before it.
        for (const l of pendingLegs.splice(0)) if (!keys.has(l)) keys.set(l, [order.get(e.id)!, 0, l.waypoint.at]);
        prev = e.id;
        continue;
      }
      const j = index.journeys.find((x) => x.id === entry.journey);
      const w = j?.waypoints[entry.waypoint];
      if (!j || !w) continue;
      const key = `${w.place}|${w.span.from.toFixed(5)}|${w.span.to.toFixed(5)}`;
      let row = legs.get(key);
      if (!row) {
        row = { kind: 'leg', journey: j, waypoint: w, lanes: [] };
        legs.set(key, row);
        if (prev) keys.set(row, [order.get(prev)!, 2, w.at]);
        else pendingLegs.push(row);
      }
      if (!row.lanes.includes(li)) row.lanes.push(li);
    }
    unplaced.push(...pendingLegs);
  });
  // A lane of journeys only: its legs go after the last event (of any lane) guessed no later.
  for (const l of unplaced) {
    if (keys.has(l)) continue;
    let base = -1;
    for (const r of events.values()) if (r.event.at !== undefined && r.event.at <= l.waypoint.at) base = Math.max(base, order.get(r.event.id)!);
    keys.set(l, [base, 2, l.waypoint.at]);
  }

  const sorted = [...events.values(), ...legs.values()].sort((a, b) => {
    const x = keys.get(a)!, y = keys.get(b)!;
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });

  // Ages and the years between: an age heading when the age changes, and a quiet
  // "at least N years later" when the honest ranges are a year or more apart.
  const rows: Row[] = [];
  let age: string | undefined, span: Span | undefined;
  for (const r of sorted) {
    const a = r.kind === 'event' ? r.event.age : r.kind === 'leg' ? r.waypoint.date.age : undefined;
    const s = r.kind === 'event' ? r.event.span : r.kind === 'leg' ? r.waypoint.span : undefined;
    if (a && a !== age) {
      const ageObj = index.ages.find((x) => x.id === a);
      if (ageObj) rows.push({ kind: 'age', age: ageObj, lanes: [] });
    } else if (span && s) {
      const n = yearsBetween(span, s);
      if (n >= 1) rows.push({ kind: 'gap', years: n, lanes: [] });
    }
    rows.push(r);
    age = a ?? age;
    if (s) span = span && span.to > s.to ? span : s;
  }
  return rows;
}

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

export function renderLanes(root: HTMLElement, idsIn: string[], host: LanesHost): void {
  const L = host.lang();
  const S = (k: UiKey) => ui(k, L);
  const ids = [...new Set(idsIn)].filter((id) => index.characters.some((c) => c.id === id)).slice(0, MAX_LANES);
  const char = (id: string) => index.characters.find((c) => c.id === id)!;
  const name = (id: string) => tr(char(id)?.name, L);
  const placeName = (id?: string) => tr(index.places.find((p) => p.id === id)?.name, L);
  root.innerHTML = '';

  const art = h('article', { class: 'reader lanes-page', lang: L });
  art.append(
    h('p', { class: 'r-over' }, S('title_lives')),
    h('h1', { class: 'r-title' }, S('livesTitle')),
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
  if (ids.length < MAX_LANES) {
    const box = h('div', { class: 'lp-add' });
    const input = h('input', { type: 'search', placeholder: S('addLife'), 'aria-label': S('addLife'), autocomplete: 'off' }) as HTMLInputElement;
    const list = h('ul', { class: 'lp-suggest', role: 'listbox' });
    const candidates = index.characters.filter((c) => hasLane(c.id) && !ids.includes(c.id))
      .sort((a, b) => tr(a.name, L).localeCompare(tr(b.name, L), L));
    const show = () => {
      list.innerHTML = '';
      const q = fold(input.value.trim());
      if (!q) return;
      for (const c of candidates.filter((c) => fold(tr(c.name, L)).includes(q)).slice(0, 8)) {
        const b = h('button', { type: 'button', role: 'option' }, h('span', {}, tr(c.name, L)), h('span', { class: 'lp-kind' }, ui(`kind_${c.kind}` as UiKey, L) || c.kind));
        b.addEventListener('click', () => host.setLanes([...ids, c.id]));
        list.append(h('li', {}, b));
      }
    };
    input.addEventListener('input', show);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { (list.querySelector('button') as HTMLButtonElement | null)?.click(); }
    });
    box.append(h('label', { class: 'sb-search', html: ICONS.search }, input), list);
    picks.append(box);
  } else picks.append(h('p', { class: 'r-quiet' }, S('lanesMax')));
  art.append(picks);

  // ---- Kin suggestions: "Túrin Turambar, cousin of Tuor" ----
  const kin: { id: string; text: string }[] = [];
  for (const id of ids) for (const k of char(id).kin ?? []) {
    if (ids.includes(k.id) || kin.some((x) => x.id === k.id) || !hasLane(k.id)) continue;
    const rel = ui(`kin_${k.as}` as UiKey, L) || k.as;
    kin.push({ id: k.id, text: `${name(k.id)}, ${rel} ${S('of')} ${name(id)}` });
  }
  if (kin.length && ids.length < MAX_LANES) {
    const row = h('div', { class: 'lp-kin' }, h('span', { class: 'r-label' }, S('kinOf')));
    for (const k of kin.slice(0, 10)) {
      const b = h('button', { type: 'button', class: 'lp-kin-btn' }, h('span', { class: 'lp-plus', 'aria-hidden': 'true' }, '+'), k.text);
      b.addEventListener('click', () => host.setLanes([...ids, k.id]));
      row.append(b);
    }
    art.append(row);
  }

  // ---- No lives yet: pairs whose paths cross, one per age ----
  if (!ids.length) {
    const pairs = crossingPairs();
    if (pairs.length) {
      const ul = h('ul', { class: 'lp-pairs' });
      for (const p of pairs) {
        const b = h('button', { type: 'button', class: 'lp-pair' },
          h('span', { class: 'lp-pair-names' }, `${tr(p.a.name, L)}  &  ${tr(p.b.name, L)}`),
          h('span', { class: 'r-when' }, p.n === 1 ? S('sharedEvent') : `${p.n} ${S('sharedEvents')}`));
        b.addEventListener('click', () => host.setLanes([p.a.id, p.b.id]));
        ul.append(h('li', {}, b));
      }
      art.append(h('section', { class: 'r-section' },
        h('h2', { class: 'r-h' }, h('span', {}, S('livesThatCross')), h('span', { class: 'rule' }), h('span', { class: 'diamond' })), ul));
    }
    art.append(h('footer', { class: 'r-foot' }, S('disclaimer')));
    root.append(art);
    return;
  }

  // ---- The lanes ----
  const rows = buildRows(ids);
  const first = ids.map((_, i) => rows.findIndex((r) => r.lanes.includes(i)));
  const last = ids.map((_, i) => rows.length - 1 - [...rows].reverse().findIndex((r) => r.lanes.includes(i)));
  const grid = h('div', { class: 'lanes', style: `--n: ${ids.length}` });
  const head = h('div', { class: 'ln-head' });
  ids.forEach((id, i) => head.append(h('span', { class: 'ln-cell' },
    h('span', { class: 'ln-initial', style: `--c: ${laneColor(i)}`, title: name(id), 'aria-label': name(id) }, name(id).slice(0, 1)))));
  head.append(h('span', { class: 'ln-head-label' }, S('storyOrder')));
  grid.append(head);

  rows.forEach((r, ri) => {
    const crossing = r.kind === 'event' && r.lanes.length > 1;
    const row = h('div', { class: `ln-row ln-${r.kind}${crossing ? ' crossing' : ''}` });
    ids.forEach((_, i) => {
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
      if (crossing) body.append(h('span', { class: 'ln-cross' }, `${S('pathsCross')} · ${r.lanes.map((i) => name(ids[i])).join(', ')}`));
      body.append(
        h('a', { class: `r-ev ln-title${e.stage ? ' staged' : ''}`, href: eventHref(e.id, L), title: S(e.stage ? 'playable' : 'readable') },
          h('span', { class: 'ev-dot', 'aria-hidden': 'true' }), h('span', { class: 'r-ev-name' }, tr(e.title, L))),
        h('span', { class: 'r-when' }, [shortDate(e, L), placeName(e.place)].filter(Boolean).join('  ·  ')));
    } else if (r.kind === 'leg') {
      const w = r.waypoint;
      body.append(
        h('span', { class: 'ln-place' }, placeName(w.place)),
        h('span', { class: 'r-when' }, [shortDate({ age: w.date.age, when: { start: w.date, precision: w.precision } }, L), tr(r.journey.title, L)].filter(Boolean).join('  ·  ')));
    } else if (r.kind === 'age') {
      body.append(h('span', { class: 'ln-age-name' }, tr(r.age.name, L)));
    } else {
      body.append(h('span', { class: 'ln-gap-text' }, r.years === 1 ? S('yearLater') : S('yearsLater').replace('{n}', r.years.toLocaleString(L))));
    }
    row.append(body);
    grid.append(row);
  });
  art.append(grid);
  art.append(h('footer', { class: 'r-foot' }, S('disclaimer')));
  root.append(art);
}
