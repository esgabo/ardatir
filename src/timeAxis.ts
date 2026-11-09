// The time cursor's control (docs/DESIGN.md §3.1) as data: the overview of the ages as
// segments, and the finer scale inside the chosen age (age, century, year, month), with its
// ticks, picking a moment at a position, and keyboard steps. Pure: no DOM, so it can be
// tested; timeCursor.ts draws it. Date math is in data/calendar.ts.

import {
  ageYearCount, axisToDate, dayWindowSlots, monthStart, SEASON_START, slotDay, slotIsDay, slotStart, stepDate,
} from './data/calendar';
import type { Age, StoryDate } from './data/types';
import { finePrecision, momentOf, type Moment } from './moment';

/** The years an open-ended age (the Fourth) spans on the control: Appendix B's tale ends in Fo.A. 120. */
export const OPEN_AGE_YEARS = 120;

export interface Segment {
  age: Age;
  /** Timeless ages sit before the axis, as their own segments, not on it. */
  timeless: boolean;
  /** The age's own years (Valian years in the Years of the Trees). */
  years?: number;
  /** Axis span, for dated ages. */
  from?: number;
  to?: number;
  /** Place on the overview bar, as fractions of its width. */
  left: number;
  width: number;
}

/** Room between the timeless segments and the axis, as a share of the bar. */
const TIMELESS_GAP = 0.02;
const TIMELESS_WEIGHT = 1.25;

/**
 * The overview: every age as a segment. Lengths differ hugely (1500 Valian years, 590, 3441,
 * 3021 years), so widths follow the logarithm of each age's own years: every age gets room
 * to be read and picked, and longer ages are still wider. Timeless ages come first, apart.
 * `contentEnd` (an axis position) stretches the open-ended last age to cover all content.
 */
export function buildSegments(agesIn: Age[], contentEnd?: number): Segment[] {
  const ages = [...agesIn].sort((a, b) => a.order - b.order);
  const timeless = ages.filter((a) => !a.axis);
  const dated = ages.filter((a) => a.axis).sort((a, b) => a.axis!.start - b.axis!.start);
  const rows = dated.map((age) => {
    const L = age.axis!.yearLength;
    let years = ageYearCount(age, ages);
    if (years === undefined) {
      const reach = contentEnd !== undefined ? Math.ceil((contentEnd - age.axis!.start) / L) : 0;
      years = Math.max(OPEN_AGE_YEARS, reach);
    }
    return { age, years, from: age.axis!.start, to: age.axis!.start + years * L, weight: Math.max(2, Math.log10(years)) };
  });
  const total = timeless.length * TIMELESS_WEIGHT + rows.reduce((s, r) => s + r.weight, 0);
  const gap = timeless.length ? TIMELESS_GAP : 0;
  const unit = (1 - gap) / total;
  const out: Segment[] = [];
  let left = 0;
  for (const age of timeless) { out.push({ age, timeless: true, left, width: TIMELESS_WEIGHT * unit }); left += TIMELESS_WEIGHT * unit; }
  left += gap;
  for (const r of rows) { out.push({ age: r.age, timeless: false, years: r.years, from: r.from, to: r.to, left, width: r.weight * unit }); left += r.weight * unit; }
  return out;
}

/** Where a moment sits on the overview bar (0–1), at the start of its honest range; undefined for a timeless moment. */
export function overviewPosition(segs: Segment[], m: Moment, x: number | undefined): number | undefined {
  const s = segs.find((g) => g.age.id === m.age);
  if (!s || s.timeless || x === undefined) return s?.timeless ? s.left + s.width / 2 : undefined;
  const f = Math.min(Math.max((x - s.from!) / (s.to! - s.from!), 0), 1);
  return s.left + f * s.width;
}

// ---------- The finer scale ----------

export const ZOOMS = ['age', 'century', 'year', 'month'] as const;
export type Zoom = (typeof ZOOMS)[number];

/** Scales an age allows: in Valian years only the age and its centuries. */
export const zoomsFor = (age: Age | undefined): Zoom[] => (finePrecision(age) ? [...ZOOMS] : ['age', 'century']);

/** The scale a moment opens at: a year among its century, a month in its year, a day in its month. */
export function defaultZoom(m: Moment): Zoom {
  return m.precision === 'day' ? 'month' : m.precision === 'month' || m.precision === 'season' ? 'year' : 'century';
}

/** A scale that fits the moment's age: the one asked for, else the finest it allows. */
export function fitZoom(z: Zoom | undefined, m: Moment, ages: Age[]): Zoom {
  const allowed = zoomsFor(ages.find((a) => a.id === m.age));
  const want = z ?? defaultZoom(m);
  return allowed.includes(want) ? want : allowed[allowed.length - 1];
}

export interface Tick {
  /** Axis position of the start of what the tick marks. */
  x: number;
  kind: 'year' | 'month' | 'day' | 'extra';
  /** Labelled ticks; the others are small marks. */
  major: boolean;
  date: StoryDate;
  /** The Overlithe slot in a year without one: no day, drawn empty. */
  empty?: boolean;
}

export interface ScaleWindow {
  zoom: Zoom;
  age: Age;
  from: number;
  to: number;
  /** The first and last year it shows (age and century scales). */
  years?: [number, number];
  ticks: Tick[];
}

/** A round step for labels along `n` years, about eight of them. */
function niceStep(n: number): number {
  for (const s of [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]) if (n / s <= 9) return s;
  return 1000;
}

const segFor = (segs: Segment[], id: string) => segs.find((s) => s.age.id === id && !s.timeless);

/** The first and last year of the century a year is in (3000–3099), within the age. */
function centuryOf(year: number, count: number): [number, number] {
  let c = Math.floor(year / 100) * 100;
  // A last stub of fewer than ten years (Y.T. 1500) joins the century before it.
  if (count - c < 10 && c >= 100) c -= 100;
  const end = count - (c + 99) < 10 ? count : c + 99;
  return [Math.max(1, c), Math.min(end, count)];
}

/** What the finer scale shows for a moment: its window on the axis and its ticks. */
export function scaleWindow(m: Moment, zoom: Zoom, segs: Segment[]): ScaleWindow | undefined {
  const seg = segFor(segs, m.age);
  if (!seg || !m.date) return undefined;
  const age = seg.age, count = seg.years!, year = m.date.year;
  const ys = (y: number) => slotStart(age, y, 0);
  const ticks: Tick[] = [];
  if (zoom === 'age' || zoom === 'century') {
    const [y0, y1] = zoom === 'age' ? [1, count] : centuryOf(year, count);
    const step = zoom === 'age' ? niceStep(count) : 10;
    const minor = zoom === 'age' ? Math.max(1, step / 5) : 1;
    // The first year is labelled too, unless the next round label is too close to it.
    const firstLabel = y0 % step === 0 || step - (y0 % step) >= step / 2;
    for (let y = y0; y <= y1; y++) {
      const major = y % step === 0 || (y === y0 && firstLabel);
      if (!major && y % minor !== 0) continue;
      ticks.push({ x: ys(y), kind: 'year', major, date: { age: age.id, year: y } });
    }
    return { zoom, age, from: ys(y0), to: ys(y1 + 1), years: [y0, y1], ticks };
  }
  if (zoom === 'year') {
    for (let mo = 1; mo <= 12; mo++) ticks.push({ x: monthStart(age, year, mo), kind: 'month', major: true, date: { age: age.id, year, month: mo } });
    for (const s of [0, 181, 182, 183, 184, 365]) {
      ticks.push({ x: slotStart(age, year, s), kind: 'extra', major: false, date: { age: age.id, year, ...slotDay(s) }, empty: !slotIsDay(year, s) });
    }
    ticks.sort((a, b) => a.x - b.x);
    return { zoom, age, from: ys(year), to: ys(year + 1), ticks };
  }
  const w = dayWindowSlots(m.date.month ?? (m.date.season ? SEASON_START[m.date.season] : undefined), m.date.day);
  for (let s = w.from; s < w.to; s++) {
    const d = slotDay(s);
    const named = typeof d.day === 'string';
    const n = typeof d.day === 'number' ? d.day : 0;
    ticks.push({
      x: slotStart(age, year, s), kind: named ? 'extra' : 'day', major: named || n === 1 || n % 5 === 0,
      date: { age: age.id, year, ...d }, empty: !slotIsDay(year, s),
    });
  }
  return { zoom, age, from: slotStart(age, year, w.from), to: slotStart(age, year, w.to), ticks };
}

/** Clamp a moment into the control's range: year 1 of the first age on the axis to the end of the last. */
function clampToSegments(m: Moment, segs: Segment[], ages: Age[]): Moment {
  const seg = segFor(segs, m.age);
  if (!seg || !m.date) return m;
  if (m.date.year > seg.years!) return momentOf({ age: m.age, year: seg.years! }, ages);
  return m;
}

/**
 * The moment at an axis position on a scale: a year on the age and century scales, a month on
 * the year scale (the days outside the months count with the month beside them), a day on the
 * month scale (an empty Overlithe slot gives Mid-year's Day).
 */
export function pickAt(x: number, win: ScaleWindow, ages: Age[]): Moment {
  const clamped = Math.min(Math.max(x, win.from), win.to - 1e-9);
  const d = axisToDate(clamped, ages)!;
  const age = win.age.id;
  if (win.zoom === 'age' || win.zoom === 'century') return momentOf({ age, year: d.year }, ages);
  if (win.zoom === 'year') {
    let month = d.month;
    if (typeof d.day === 'string') month = d.day === '2-yule' ? 1 : d.day === '1-yule' ? 12 : d.day === '1-lithe' ? 6 : 7;
    return momentOf({ age, year: d.year, month }, ages);
  }
  if (d.day === 'overlithe' && !slotIsDay(d.year, 183)) return momentOf({ age, year: d.year, day: 'midyear' }, ages);
  return momentOf({ age, year: d.year, ...(d.month ? { month: d.month } : {}), day: d.day }, ages);
}

export type StepKey = 'next' | 'prev' | 'bigNext' | 'bigPrev' | 'home' | 'end';

/** Keyboard keys for the scale: arrows step by its unit, Page Up/Down by larger steps, Home/End to its ends. */
export const STEP_KEYS: Record<string, StepKey> = {
  ArrowRight: 'next', ArrowUp: 'next', ArrowLeft: 'prev', ArrowDown: 'prev',
  PageUp: 'bigNext', PageDown: 'bigPrev', Home: 'home', End: 'end',
};

/**
 * Step a moment on a scale. Arrows move by the scale's unit (a year on the age and century
 * scales, a month on the year scale, a day on the month scale), and give a moment of that
 * unit; from a coarser moment the first step goes into it (the year 3019 → January, or
 * December going back). Page Up/Down: a century (or a tenth of a short age) / ten years /
 * a year / a month. Home/End: the first or last unit the scale shows.
 */
export function stepMoment(m: Moment, zoom: Zoom, key: StepKey, segs: Segment[], ages: Age[]): Moment {
  const d = m.date;
  const seg = segFor(segs, m.age);
  if (!d || !seg) return m;
  const count = seg.years!;
  const yearOnly = (date: StoryDate) => momentOf({ age: date.age, year: date.year }, ages);
  const clamp = (x: Moment) => clampToSegments(x, segs, ages);
  if (zoom === 'age' || zoom === 'century') {
    if (key === 'home' || key === 'end') {
      const [y0, y1] = zoom === 'age' ? [1, count] : centuryOf(d.year, count);
      return yearOnly({ age: m.age, year: key === 'home' ? y0 : y1 });
    }
    const big = zoom === 'age' ? (count >= 1000 ? 100 : 10) : 10;
    const n = key === 'next' ? 1 : key === 'prev' ? -1 : key === 'bigNext' ? big : -big;
    return clamp(yearOnly(stepDate({ age: m.age, year: d.year }, 'year', n, ages)));
  }
  if (zoom === 'year') {
    if (key === 'home' || key === 'end') return momentOf({ age: m.age, year: d.year, month: key === 'home' ? 1 : 12 }, ages);
    if (key === 'bigNext' || key === 'bigPrev') {
      const month = d.month ?? (d.season ? SEASON_START[d.season] : dayWindowSlots(undefined, d.day).month);
      const base: StoryDate = m.precision === 'year' ? { age: m.age, year: d.year } : { age: m.age, year: d.year, month };
      return clamp(momentOf(stepDate(base, 'year', key === 'bigNext' ? 1 : -1, ages), ages));
    }
    const fwd = key === 'next';
    if (m.precision === 'year') return momentOf({ age: m.age, year: d.year, month: fwd ? 1 : 12 }, ages);
    if (m.precision === 'season') {
      const first = SEASON_START[d.season!];
      return momentOf(stepDate({ age: m.age, year: d.year, month: first }, 'month', fwd ? 0 : 2, ages), ages);
    }
    const base: StoryDate = { age: m.age, year: d.year, month: d.month, ...(typeof d.day === 'string' ? { day: d.day } : {}) };
    const next = stepDate(base, 'month', fwd ? 1 : -1, ages);
    return clamp(momentOf({ age: next.age, year: next.year, month: next.month }, ages));
  }
  // The month scale: days.
  if (key === 'home' || key === 'end') {
    const w = dayWindowSlots(d.month, d.day);
    let s = key === 'home' ? w.from : w.to - 1;
    if (!slotIsDay(d.year, s)) s += key === 'home' ? 1 : -1;
    return momentOf({ age: m.age, year: d.year, ...slotDay(s) }, ages);
  }
  if (key === 'bigNext' || key === 'bigPrev') {
    const base: StoryDate = { age: m.age, year: d.year, month: d.month ?? 1, day: d.day ?? 1 };
    return clamp(momentOf(stepDate(base, 'month', key === 'bigNext' ? 1 : -1, ages), ages));
  }
  const fwd = key === 'next';
  if (m.precision !== 'day') {
    // Into a coarser moment: its first day going forward, its last going back.
    const month = d.month ?? (m.precision === 'season' ? SEASON_START[d.season!] + (fwd ? 0 : 2) : fwd ? 1 : 12);
    const first: StoryDate = { age: m.age, year: d.year, month: month > 12 ? month - 12 : month, day: fwd ? 1 : 30 };
    if (month > 12) first.year += 1;
    return clamp(momentOf(stepDate(first, 'day', 0, ages), ages));
  }
  return clamp(momentOf(stepDate({ age: m.age, year: d.year, month: d.month, day: d.day }, 'day', fwd ? 1 : -1, ages), ages));
}

/** Where an axis position falls on a scale (0–1); outside the window it is clamped. */
export const fractionIn = (win: Pick<ScaleWindow, 'from' | 'to'>, x: number) => Math.min(Math.max((x - win.from) / (win.to - win.from), 0), 1);
