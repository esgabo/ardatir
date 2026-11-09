// The time cursor (docs/DESIGN.md §3.1): pick any moment and see what is happening then,
// everywhere. A control spans the ages (the timeless ones beside the axis: before the world
// first, what is foretold last), with a finer
// scale inside the chosen age down to a single day; below it, the events likely and possibly
// happening then, and where everyone is, from the journeys. Dates shown are honest ranges
// only; best guesses (`at`) place and order things and are explained, never shown as dates.
// The logic lives in moment.ts, timeAxis.ts and whereabouts.ts (tested); this draws it.

import { characterMap, eventById, index } from './chronicle';
import { EPS, overlaps, valianYears, within } from './data/calendar';
import type { Age, EventSummary, Lang, Waypoint } from './data/types';
import { h } from './dom';
import { dateLabel, honestDate, momentLabel, monthShort, placeInSentence } from './format';
import { ICONS } from './icons';
import { t as ui, tr, type UiKey } from './i18n';
import { hasLane, MAX_LANES } from './lanes';
import { finePrecision, momentOf, momentPath, momentSpan, parseMoment, sameMoment, type Moment } from './moment';
import { MOMENTS, momentKey } from './moments';
import { likelyAtParts, whyToggle } from './placement';
import { foretoldBadge } from './foretold';
import { atMoment } from './related';
import { eventHref, livesHref, timeHref } from './routes';
import {
  axisExtent, buildSegments, defaultZoom, fitZoom, fractionIn, overviewPosition, pickAt, scaleWindow, STEP_KEYS, stepMoment, stepOutside, ZOOMS, zoomsFor,
  type ScaleWindow, type Segment, type StepKey, type Tick, type Zoom,
} from './timeAxis';
import { atHome, whereabouts, type WhereGroup } from './whereabouts';

export interface TimeState {
  moment: Moment;
  zoom: Zoom;
  /** The event the visitor came from, so the page offers the way back. */
  from?: string;
}

export interface TimeHost {
  lang(): Lang;
  /** The moment or scale changed in place (a step, a drag, a zoom): update the URL, no history entry. */
  changed(s: TimeState): void;
}

/** Possibly-happening events shown before "Show all". */
const POSSIBLY_SHOWN = 12;

let segCache: Segment[] | undefined;
/** The ages as segments of the control; the open-ended last age reaches the latest content. */
export function segments(): Segment[] {
  if (!segCache) {
    const ends = [...index.events.map((e) => e.span?.to ?? -Infinity), ...index.journeys.map((j) => j.span?.to ?? -Infinity)];
    segCache = buildSegments(index.ages, Math.max(...ends));
  }
  return segCache;
}

const ageOf = (id: string) => index.ages.find((a) => a.id === id);

/**
 * The year a visitor lands on in an age: where its first well-dated event begins (an honest
 * range of at most one of the age's years: not a decade, an approximate date or a range of
 * years, like the Bombadil poems placed anywhere in sixteen centuries), else its earliest
 * dated event, else year 1.
 */
export function entryMoment(age: Age): Moment {
  if (!age.axis) return { age: age.id };
  const dated = index.events.filter((e) => e.age === age.id && e.when && e.span).sort((a, b) => a.span!.from - b.span!.from);
  const narrow = (e: EventSummary) => e.span!.to - e.span!.from <= age.axis!.yearLength + EPS;
  const first = dated.find(narrow) ?? dated[0];
  return momentOf({ age: age.id, year: first?.when?.start.year ?? 1 }, index.ages);
}

/**
 * A moment from the URL: the readable path (or an axis position); an age alone opens at its
 * entry year; a year past what the control shows of the open-ended last age (the Fourth)
 * becomes the last year shown. Undefined: not a moment.
 */
export function resolveMoment(where: string | undefined): Moment | undefined {
  const m = parseMoment(where ?? '', index.ages);
  if (!m) return undefined;
  const age = ageOf(m.age)!;
  if (!age.axis) return m;
  if (!m.date) return entryMoment(age);
  const shown = segments().find((s) => s.age.id === m.age)?.years;
  return shown !== undefined && m.date.year > shown ? momentOf({ age: m.age, year: shown }, index.ages) : m;
}

/** The href of a moment at a scale (the scale only when it isn't the moment's default). */
export function momentHref(s: TimeState, L: Lang): string {
  const zoom = s.moment.date && s.zoom !== fitZoom(defaultZoom(s.moment), s.moment, index.ages) ? s.zoom : undefined;
  return timeHref(momentPath(s.moment), L, { zoom, from: s.from });
}

/** A moment shortcut's label: its event's title, or its own interface string. */
export function shortcutLabel(path: string, event: string | undefined, L: Lang): string {
  const e = event ? eventById(event) : undefined;
  return e ? tr(e.title, L) : ui(momentKey(path) as UiKey, L);
}

function heading(text: string, extra?: Node): HTMLElement {
  return h('h2', { class: 'r-h' }, h('span', {}, text, extra ?? null), h('span', { class: 'rule', 'aria-hidden': 'true' }), h('span', { class: 'diamond', 'aria-hidden': 'true' }));
}

/** A link to an event; prophecy carries its badge, unless the whole list is already said to be foretold (`mark: false`). */
function eventLink(e: EventSummary, L: Lang, mark = true): HTMLAnchorElement {
  return h('a', { class: `r-ev${e.stage ? ' staged' : ''}`, href: eventHref(e.id, L), title: ui(e.stage ? 'playable' : 'readable', L) },
    h('span', { class: 'ev-dot', 'aria-hidden': 'true' }), h('span', { class: 'r-ev-name' }, tr(e.title, L)), mark && foretoldBadge(e, L));
}

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
const placeName = (id: string | undefined, L: Lang) => tr(index.places.find((p) => p.id === id)?.name, L);

/** A waypoint's honest range: "June – 1 Lithe, T.A. 2941". */
const wpDate = (w: Waypoint, L: Lang) => honestDate({ age: w.date.age, when: { start: w.date, end: w.end, precision: w.precision, endPrecision: w.endPrecision } }, L);

/** Fill `{a}`-style slots; Spanish contracts "a el" / "de el" that a place's article makes. */
function fillText(key: UiKey, L: Lang, slots: Record<string, string>): string {
  let s = ui(key, L).replace(/\{(\w+)\}/g, (_, k: string) => slots[k] ?? '');
  if (L === 'es') s = s.replace(/\ba el\b/g, 'al').replace(/\bde el\b/g, 'del');
  return s;
}

/** What the scale shows, in words: "T.A. 1–3021", "T.A. 3000–3099", "T.A. 3019", "March, T.A. 3019". */
function scaleCaption(w: ScaleWindow, L: Lang): string {
  const abbr = tr(w.age.abbr, L) || tr(w.age.name, L);
  if (w.years) return `${tr(w.age.name, L)}  ·  ${abbr} ${w.years[0]}–${w.years[1]}`;
  const d = w.ticks[0].date;
  if (w.zoom === 'year') return dateLabel({ age: w.age.id, year: d.year }, 'year', L);
  const month = w.ticks.find((t) => t.kind === 'day')?.date.month ?? 1;
  return dateLabel({ age: w.age.id, year: d.year, month }, 'month', L);
}

function tickLabel(t: Tick, L: Lang): string {
  if (!t.major) return '';
  if (t.kind === 'year') return String(t.date.year);
  if (t.kind === 'month') return monthShort(t.date.month!, L);
  if (t.kind === 'day') return String(t.date.day);
  return t.date.day === '1-lithe' ? 'Lithe' : t.date.day === '2-yule' || t.date.day === '1-yule' ? 'Yule' : '';
}

export function renderTime(root: HTMLElement, st: TimeState, host: TimeHost): void {
  const L = host.lang();
  const S = (k: UiKey) => ui(k, L);
  const ages = index.ages;
  const segs = segments();
  root.innerHTML = '';
  const art = h('article', { class: 'reader time-page', lang: L });

  // ---- Back to the event the visitor came from ----
  const fromEv = st.from ? eventById(st.from) : undefined;
  if (fromEv) art.append(h('a', { class: 'tc-back', href: eventHref(fromEv.id, L) }, `← ${fillText('backTo', L, { e: tr(fromEv.title, L) })}`));

  const over = h('p', { class: 'r-over' });
  const title = h('h1', { class: 'r-title tc-title', tabindex: '-1' });
  const note = h('p', { class: 'tc-note' });
  art.append(over, title, note);

  // ---- The control: the ages, the scale, the moments to visit ----
  const control = h('section', { class: 'tc-control', 'aria-label': S('timeline') });

  // The overview: every age as a segment, the timeless ones apart from the axis.
  const bar = h('div', { class: 'tc-ages', role: 'group', 'aria-label': S('theAges') });
  const mark = h('span', { class: 'tc-mark', 'aria-hidden': 'true' });
  // Timeless ages in boxes of their own: before the world before the axis, what is foretold
  // after it (dashed, like them: never on the axis). The dated ages share the rest.
  const outside = h('div', { class: 'tc-outside' });
  const outsideAfter = h('div', { class: 'tc-outside after' });
  const axis = h('div', { class: 'tc-axis' });
  const { left: axisLeft, right: axisRight } = axisExtent(segs);
  /** A position on the whole overview (buildSegments) as a share of the axis box. */
  const onAxis = (f: number) => (f - axisLeft) / (axisRight - axisLeft);
  const segBtns = new Map<string, HTMLButtonElement>();
  for (const s of segs) {
    const name = tr(s.age.name, L);
    const short = s.timeless ? ui(`ageShort_${s.age.id}` as UiKey, L) || name : tr(s.age.abbr, L) || name;
    const years = s.years === undefined ? '' : fillText(valianYears(s.age) ? 'ageValianYears' : 'ageYears', L, { n: s.years.toLocaleString(L) });
    const b = h('button', {
      type: 'button', class: `tc-seg${s.timeless ? ' timeless' : ''}${s.age.foretold ? ' foretold' : ''}`,
      style: s.timeless ? undefined : `left: ${onAxis(s.left) * 100}%; width: ${(s.width / (axisRight - axisLeft)) * 100}%`,
      'aria-label': [name, s.age.foretold ? S('foretoldHint') : s.timeless ? S('outsideTime') : years].filter(Boolean).join(', '),
      title: [name, s.age.foretold ? S('foretoldHint') : years].filter(Boolean).join(' · '),
    }, h('span', { class: 'tc-seg-name full' }, name), h('span', { class: 'tc-seg-name short', 'aria-hidden': 'true' }, short));
    // Where events are, faintly, so busy stretches show (placed by best guess; no dates said).
    if (!s.timeless) {
      const dots = h('span', { class: 'tc-seg-dots', 'aria-hidden': 'true' });
      const seen = new Set<number>();
      for (const e of index.events) {
        if (e.age !== s.age.id || e.at === undefined) continue;
        const f = Math.round(fractionIn(s as { from: number; to: number }, e.at) * 100);
        if (seen.has(f)) continue;
        seen.add(f);
        dots.append(h('i', { style: `left: ${f}%` }));
      }
      b.append(dots);
    }
    b.addEventListener('click', (ev) => {
      if (s.timeless) { set({ age: s.age.id }, st.zoom); return; }
      const r = b.getBoundingClientRect();
      if (ev.detail === 0 || !r.width) { set(st.moment.age === s.age.id ? st.moment : entryMoment(s.age), 'age'); return; }
      const f = Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 0.9999);
      set(momentOf({ age: s.age.id, year: Math.floor(f * s.years!) + 1 }, ages), 'age');
    });
    segBtns.set(s.age.id, b);
    (s.after ? outsideAfter : s.timeless ? outside : axis).append(b);
  }
  axis.append(mark);
  if (outside.childElementCount) bar.append(outside);
  bar.append(axis);
  if (outsideAfter.childElementCount) bar.append(outsideAfter);
  control.append(bar);

  // Scale buttons, with a step either side for touch.
  const scaleRow = h('div', { class: 'tc-scale-row' });
  const earlier = h('button', { type: 'button', class: 'tc-step', 'aria-label': S('earlier'), title: S('earlier'), html: ICONS.chevron });
  const later = h('button', { type: 'button', class: 'tc-step', 'aria-label': S('later'), title: S('later'), html: ICONS.chevron });
  earlier.addEventListener('click', () => step('prev'));
  later.addEventListener('click', () => step('next'));
  const zoomGroup = h('div', { class: 'tc-zooms', role: 'group', 'aria-label': S('scale') });
  const zoomBtns = new Map<Zoom, HTMLButtonElement>();
  for (const z of ZOOMS) {
    const b = h('button', { type: 'button', 'aria-pressed': 'false' }, S(`scale_${z}` as UiKey));
    b.addEventListener('click', () => { if (!b.disabled) { set(st.moment, z); scale.focus({ preventScroll: true }); } });
    zoomBtns.set(z, b);
    zoomGroup.append(b);
  }
  scaleRow.append(earlier, zoomGroup, later);
  control.append(scaleRow);

  // The scale: a slider of its own, operable by keyboard, pointer and touch.
  const scale = h('div', { class: 'tc-scale', role: 'slider', tabindex: '0', 'aria-label': S('moment'), 'aria-valuemin': '0', 'aria-valuemax': '1000' });
  const track = h('div', { class: 'tc-track' });
  const caption = h('p', { class: 'tc-scale-cap', 'aria-hidden': 'true' });
  scale.append(caption, track);
  control.append(scale, h('p', { class: 'tc-keys' }, S('timeKeys')));

  // Moments to visit.
  const moments = h('ul', { class: 'tc-moments' });
  const momentLinks: [Moment | undefined, HTMLAnchorElement][] = [];
  for (const mo of MOMENTS) {
    const m = parseMoment(mo.path, ages);
    const a = h('a', { class: 'tc-moment', href: timeHref(mo.path, L) }, h('span', { class: 'tc-moment-name' }, shortcutLabel(mo.path, mo.event, L)), h('span', { class: 'tc-moment-when' }, m ? momentLabel(m, L) : ''));
    momentLinks.push([m, a]);
    moments.append(h('li', {}, a));
  }
  control.append(h('nav', { class: 'tc-moments-box', 'aria-label': S('momentsToVisit') }, h('span', { class: 'r-label' }, S('momentsToVisit')), moments));
  art.append(control);

  const results = h('div', { class: 'tc-results' });
  art.append(results, h('footer', { class: 'r-foot' }, S('disclaimer')));
  root.append(art);

  // ---- State changes ----
  let win: ScaleWindow | undefined;
  /** While dragging, the scale stays put under the pointer. */
  let frozen: ScaleWindow | undefined;

  function set(m: Moment, zoom: Zoom, quietResults = false): void {
    const changed = !sameMoment(m, st.moment) || zoom !== st.zoom;
    st.moment = m;
    st.zoom = m.date ? fitZoom(zoom, m, ages) : zoom;
    if (!changed) return;
    refresh(quietResults);
    host.changed(st);
  }

  function step(key: StepKey): void {
    if (!st.moment.date) {
      // From outside time: "later" from before the world enters the first age on the axis,
      // "earlier" from what is foretold the last year the axis shows.
      const to = stepOutside(st.moment, key, segs, ages, entryMoment);
      if (to) set(to, 'age');
      return;
    }
    set(stepMoment(st.moment, st.zoom, key, segs, ages), st.zoom);
  }

  scale.addEventListener('keydown', (e) => {
    const k = STEP_KEYS[e.key];
    if (k) { e.preventDefault(); step(k); return; }
    const zs = zoomsFor(ageOf(st.moment.age));
    const i = zs.indexOf(st.zoom);
    if ((e.key === '+' || e.key === '=') && i < zs.length - 1) { e.preventDefault(); set(st.moment, zs[i + 1]); }
    if ((e.key === '-' || e.key === '_') && i > 0) { e.preventDefault(); set(st.moment, zs[i - 1]); }
  });

  const pickFrom = (e: PointerEvent) => {
    const w = frozen ?? win;
    if (!w) return;
    const r = track.getBoundingClientRect();
    const f = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    set(pickAt(w.from + f * (w.to - w.from), w, ages), st.zoom, true);
  };
  track.addEventListener('pointerdown', (e) => {
    if (!win || e.button > 0) return;
    frozen = win;
    track.setPointerCapture(e.pointerId);
    scale.focus({ preventScroll: true });
    pickFrom(e);
  });
  track.addEventListener('pointermove', (e) => { if (frozen) pickFrom(e); });
  const end = () => { if (!frozen) return; frozen = undefined; refresh(false); };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);

  function refresh(quietResults: boolean): void {
    const m = st.moment;
    const age = ageOf(m.age)!;
    const label = momentLabel(m, L);
    over.textContent = `${S('title_time')}  ·  ${tr(age.name, L)}`;
    title.textContent = label;
    const notes = [S(m.date ? (`momentNote_${m.precision}` as UiKey) : age.foretold ? 'momentNote_foretold' : 'momentNote_timeless')];
    if (m.date && !finePrecision(age)) notes.push(S('valianNote'));
    note.textContent = notes.join(' ');

    // Overview.
    const span = momentSpan(m, ages);
    for (const [id, b] of segBtns) b.setAttribute('aria-current', id === m.age ? 'true' : 'false');
    const pos = span ? overviewPosition(segs, m, (span.from + span.to) / 2) : undefined;
    mark.hidden = pos === undefined;
    if (pos !== undefined) mark.style.left = `${onAxis(pos) * 100}%`;

    // Scale.
    const dated = !!m.date;
    scaleRow.hidden = !dated;
    scale.hidden = !dated;
    control.querySelector('.tc-keys')!.toggleAttribute('hidden', !dated);
    const allowed = zoomsFor(age);
    for (const [z, b] of zoomBtns) {
      b.disabled = !allowed.includes(z);
      b.setAttribute('aria-pressed', String(z === st.zoom));
    }
    if (dated) drawScale(frozen ?? scaleWindow(m, st.zoom, segs)!, span!);

    for (const [mm, a] of momentLinks) a.toggleAttribute('aria-current', !!mm && sameMoment(mm, m));
    if (!quietResults || !frozen) drawResults();
  }

  function drawScale(w: ScaleWindow, span: { from: number; to: number }): void {
    win = w;
    caption.textContent = scaleCaption(w, L);
    track.innerHTML = '';
    track.className = `tc-track z-${w.zoom}`;
    const pct = (x: number) => `${fractionIn(w, x) * 100}%`;
    const a = fractionIn(w, span.from), b = fractionIn(w, span.to);
    track.append(h('span', { class: 'tc-band', style: `left: ${a * 100}%; width: ${Math.max(b - a, 0) * 100}%` }));
    for (const t of w.ticks) {
      const cls = ['tc-tick', t.major ? 'major' : 'minor', t.kind, t.empty ? 'empty' : ''].filter(Boolean).join(' ');
      const lab = tickLabel(t, L);
      track.append(h('span', { class: cls, style: `left: ${pct(t.x)}` }, lab ? h('span', { class: 'tc-tick-label' }, lab) : null));
    }
    // Where events are on this scale (by best guess: placement only).
    const dots = h('span', { class: 'tc-dots', 'aria-hidden': 'true' });
    const seen = new Set<number>();
    for (const e of index.events) {
      if (e.at === undefined || !within(e.at, w)) continue;
      const f = Math.round(fractionIn(w, e.at) * 400);
      if (seen.has(f)) continue;
      seen.add(f);
      dots.append(h('i', { style: `left: ${f / 4}%` }));
    }
    track.append(dots);
    const c = (a + b) / 2;
    track.append(h('span', { class: 'tc-cursor', style: `left: ${c * 100}%` }, h('span', { class: 'tc-knob' })));
    scale.setAttribute('aria-valuenow', String(Math.round(c * 1000)));
    scale.setAttribute('aria-valuetext', momentLabel(st.moment, L));
  }

  function drawResults(): void {
    results.innerHTML = '';
    const m = st.moment;
    const age = ageOf(m.age)!;
    const span = momentSpan(m, ages);
    if (!span) {
      // Outside time: the age's own events (what is foretold, said to be prophecy).
      const evs = index.events.filter((e) => e.age === m.age);
      const box = h('section', { class: 'r-section' }, heading(S(age.foretold ? 'foretoldTitle' : 'outsideTime')), h('p', { class: 'tc-age-sum' }, tr(age.summary, L)));
      if (evs.length) {
        const ul = h('ul', { class: 'r-same' });
        for (const e of evs) ul.append(h('li', {}, eventLink(e, L, !age.foretold), h('span', { class: 'r-when' }, tr(e.summary, L))));
        box.append(ul);
      } else box.append(h('p', { class: 'r-quiet' }, S('noEvents')));
      results.append(box);
      return;
    }
    const label = momentLabel(m, L);
    // Full honest dates: on the time cursor a day is what tells events apart.
    const when = (e: EventSummary) => h('span', { class: 'r-when' }, [honestDate(e, L), placeName(e.place, L)].filter(Boolean).join('  ·  '));
    const am = atMoment(span);
    if (am.likely.length) {
      const ul = h('ul', { class: 'r-same' });
      for (const e of am.likely) {
        const [btn, why] = whyToggle(`${S('whyLikely')}: ${tr(e.title, L)}`, likelyAtParts(label, span, e, L), L);
        ul.append(h('li', {}, h('span', { class: 'r-same-row' }, eventLink(e, L), btn), when(e), why));
      }
      results.append(h('section', { class: 'r-section' }, heading(S('likelyThen'), h('span', { class: 'guess' }, ` — ${S('ourBestGuess')}`)), ul));
    }
    if (am.possibly.length) {
      const ul = h('ul', { class: 'r-same' });
      const items = am.possibly.map((e) => h('li', {}, eventLink(e, L), when(e)));
      items.forEach((li, i) => { if (i >= POSSIBLY_SHOWN) li.hidden = true; ul.append(li); });
      const box = h('section', { class: 'r-section' }, heading(S('possiblyThen')), h('p', { class: 'r-sub-note' }, S('possiblyThenWhy')), ul);
      if (items.length > POSSIBLY_SHOWN) {
        const more = h('button', { type: 'button', class: 'tc-more' }, fillText('showAll', L, { n: String(items.length) }));
        more.addEventListener('click', () => { for (const li of items) li.hidden = false; more.remove(); items[POSSIBLY_SHOWN]?.querySelector('a')?.focus(); });
        box.append(more);
      }
      results.append(box);
    }

    // Where everyone is, by company; then those who never travel, at home.
    const groups = whereabouts(index.journeys, span, m.precision === 'day' || m.precision === 'month');
    const placed = new Set(groups.flatMap((g) => g.characters));
    const homes = atHome(index.characters, index.events, span, placed, index.journeys);
    if (groups.length || homes.length) {
      const box = h('section', { class: 'r-section' }, heading(S('whereTitle')), h('p', { class: 'r-sub-note' }, S('whereNote')));
      const list = h('div', { class: 'tc-where-list' });
      for (const g of groups) list.append(whereCard(g, span));
      box.append(list);
      if (homes.length) {
        box.append(h('h3', { class: 'r-sub tc-home-h' }, S('atHome')));
        const hl = h('div', { class: 'tc-where-list' });
        for (const g of homes) {
          const [btn, why] = whyToggle(S('whyLikely'), [S('atHomeWhy')], L);
          hl.append(h('div', { class: 'tc-where home' },
            h('div', { class: 'tc-where-row' }, h('h3', { class: 'tc-where-h' }, fillText('atHomeIn', L, { a: placeInSentence(placeName(g.place, L), L) })), btn),
            why, who(g.characters)));
        }
        box.append(hl);
      }
      results.append(box);
    }
    if (!results.childElementCount) results.append(h('section', { class: 'r-section' }, h('p', { class: 'r-quiet' }, S('nothingThen'))));
  }

  /** Names, each opening their life; several: all side by side. */
  function who(ids: string[]): HTMLElement {
    const p = h('p', { class: 'tc-who' });
    ids.forEach((id, i) => {
      const c = characterMap.get(id);
      if (!c) return;
      if (i) p.append(h('span', { class: 'tc-sep', 'aria-hidden': 'true' }, '·'));
      p.append(hasLane(id) ? h('a', { href: livesHref([id], L), title: S('followLife') }, tr(c.name, L)) : h('span', {}, tr(c.name, L)));
    });
    const lanes = ids.filter(hasLane).slice(0, MAX_LANES);
    if (lanes.length > 1) p.append(h('a', { class: 'tc-lives', href: livesHref(lanes, L) }, `${S('seeSideBySide')} →`));
    return p;
  }

  function whereCard(g: WhereGroup, span: { from: number; to: number }): HTMLElement {
    const w = g.where;
    const first = w.stops[0], last = w.stops[w.stops.length - 1];
    const text = w.kind === 'at'
      ? fillText('whereAt', L, { a: placeInSentence(placeName(first.place, L), L) })
      : fillText('whereBetween', L, { a: placeInSentence(placeName(first.place, L), L), b: placeInSentence(placeName(last.place, L), L) });
    const card = h('div', { class: 'tc-where' }, h('h3', { class: 'tc-where-h' }, text), who(g.characters));
    // The stops, each with its honest range; our guess lit.
    if (w.kind === 'between') {
      const ol = h('ol', { class: 'r-route' });
      for (const s of w.stops) {
        const lit = w.guess && s.place === w.guess.reached.place;
        ol.append(h('li', { class: lit ? 'here' : undefined, title: wpDate(s, L) }, placeName(s.place, L)));
      }
      card.append(ol);
    }
    card.append(h('p', { class: 'r-when' }, (w.kind === 'at' ? [first] : [first, last]).map((s) => `${placeName(s.place, L)}: ${wpDate(s, L)}`).join('  ·  ')));
    if (w.guess) {
      const gtext = w.guess.atStop || !w.guess.next
        ? fillText('guessAt', L, { a: placeInSentence(placeName(w.guess.reached.place, L), L) })
        : fillText('guessPast', L, { a: placeInSentence(placeName(w.guess.reached.place, L), L), b: placeInSentence(placeName(w.guess.next.place, L), L) });
      const [btn, why] = whyToggle(S('whyLikely'), [S('whereGuessWhy')], L);
      card.append(h('p', { class: 'tc-guess' }, h('span', { class: 'guess-label' }, `${cap(ui('ourBestGuess', L))}: `), gtext, ' ', btn), why);
    }
    // The event happening at that stop, when there is one at this moment.
    const stop = w.kind === 'at' ? first : w.guess?.atStop ? w.guess.reached : undefined;
    const ev = stop?.event ? eventById(stop.event) : undefined;
    if (ev?.span && overlaps(ev.span, span)) card.append(h('p', { class: 'tc-there' }, h('span', { class: 'r-label' }, S('thereEvent')), eventLink(ev, L)));
    card.append(h('p', { class: 'r-quiet tc-journeys' }, g.journeys.map((j) => tr(j.title, L)).join('  ·  ')));
    return card;
  }

  refresh(false);
}
