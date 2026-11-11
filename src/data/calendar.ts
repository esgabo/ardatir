// The shared time axis: every dated thing in Arda placed on one line, in years of the Sun.
// Used by the content build (to place events) and by the site (time cursor, labels).
// See docs/DESIGN.md §4.4.

import type { Age, ExtraDay, Precision, Season, Span, StoryDate, When } from './types';

// ---------- The year: 12 months of 30 days, plus the days outside the months ----------
//
// Dates follow the Shire Reckoning (The Return of the King, Appendix D): twelve months of
// 30 days, and five days that belong to no month (six in leap years). Content names those
// days with `day:` and no month:
//
//   { age: third-age, year: 2941, day: 1-lithe }     # Midsummer's Eve
//
// Every year is laid out as 366 equal day slots, the same in every year, so a date's place
// never depends on whether its year is a leap year:
//
//   slot   0         2 Yule          (first day of the year)
//   slots  1–180     months 1–6      (Afteryule … Forelithe)
//   slot   181       1 Lithe         (Midsummer's Eve)
//   slot   182       Mid-year's Day  (Midsummer)
//   slot   183       Overlithe       (leap years only; an empty slot in other years)
//   slot   184       2 Lithe
//   slots  185–364   months 7–12     (Afterlithe … Foreyule)
//   slot   365       1 Yule          (last day of the year)
//
// Months stay 30 days each. Seasons run from the first day of their first month to the
// first day of the month after their third, so summer (6–8) includes the Lithe days and
// winter (12–2) includes Yule, running on into the next year.

/** Day slots in every year on the axis (see the layout above). */
const SLOTS_PER_YEAR = 366;

/** One day on the axis, in years of the Sun: the width of a day-precision span in a Sun-year age. */
export const ONE_DAY = 1 / SLOTS_PER_YEAR;

/** Slot of each day outside the months. */
const EXTRA_DAY_SLOT: Record<ExtraDay, number> = {
  '2-yule': 0, '1-lithe': 181, midyear: 182, overlithe: 183, '2-lithe': 184, '1-yule': 365,
};

/** Slot of the first day of a month (1–12). */
const monthSlot = (month: number) => (month <= 6 ? 1 : 185) + ((month - 1) % 6) * 30;

/** Slot of a day: a numbered day in its month, or a named day outside the months. */
export function daySlot(month: number | undefined, day: StoryDate['day']): number {
  if (typeof day === 'string') return EXTRA_DAY_SLOT[day];
  return monthSlot(month ?? 1) + ((day ?? 1) - 1);
}

/**
 * Does this year have an Overlithe? Appendix D: every fourth year, except the last year of
 * a century. Applied to the age's own year numbers; in the Third Age this is exactly the
 * Shire's rule, since Shire Reckoning 1 = T.A. 1601 (1600 is a multiple of 100).
 */
export function hasOverlithe(year: number): boolean {
  return year % 4 === 0 && year % 100 !== 0;
}

/** First month of each season; winter runs on into the next year. */
export const SEASON_START: Record<Season, number> = { spring: 3, summer: 6, autumn: 9, winter: 12 };

/** Years before and after a date that `approximate` covers. */
export const APPROXIMATE_YEARS = 5;

type AgeAxis = Pick<Age, 'id' | 'axis'>;

/** Axis span of a single date at a precision. Undefined for timeless ages. */
export function dateSpan(date: StoryDate, precision: Precision, age: AgeAxis): Span | undefined {
  if (!age.axis) return undefined;
  const L = age.axis.yearLength;
  const yearStart = age.axis.start + (date.year - 1) * L;
  const slot = L / SLOTS_PER_YEAR;
  /** Axis position of the first day of a month; months past 12 run into the following years. */
  const monthStart = (month: number) => {
    const y = Math.floor((month - 1) / 12), m = ((month - 1) % 12) + 1;
    return yearStart + y * L + monthSlot(m) * slot;
  };

  switch (precision) {
    case 'day': {
      const from = yearStart + daySlot(date.month, date.day) * slot;
      return { from, to: from + slot };
    }
    case 'month': {
      const from = monthStart(date.month ?? 1);
      return { from, to: from + 30 * slot };
    }
    case 'season': {
      const m = date.season ? SEASON_START[date.season] : (date.month ?? 1);
      return { from: monthStart(m), to: monthStart(m + 3) };
    }
    case 'year':
      return { from: yearStart, to: yearStart + L };
    case 'decade':
      return { from: yearStart, to: yearStart + 10 * L };
    case 'approximate':
      return { from: yearStart - APPROXIMATE_YEARS * L, to: yearStart + (APPROXIMATE_YEARS + 1) * L };
  }
}

/**
 * Axis span of an event's `when` (or a waypoint's range), from the start of its start date to
 * the end of its end date. `endPrecision` lets the end be known more (or less) precisely than
 * the start ("some time in June, until 1 Lithe"); it defaults to `precision`.
 */
export function whenSpan(when: When & { endPrecision?: Precision }, ages: Map<string, AgeAxis>): Span | undefined {
  const startAge = ages.get(when.start.age);
  if (!startAge) return undefined;
  const a = dateSpan(when.start, when.precision, startAge);
  if (!a) return undefined;
  if (!when.end) return a;
  const endAge = ages.get(when.end.age);
  const b = endAge && dateSpan(when.end, when.endPrecision ?? when.precision, endAge);
  return b ? { from: a.from, to: Math.max(a.to, b.to) } : a;
}

/**
 * Tolerance for comparing positions on the axis, far below a day (about 3e-3 years). A day's
 * end (`from + slot`) and the next day's start (computed from its own slot) can differ by
 * ~1e-12 after float rounding; without this, adjacent days would overlap. Every comparison of
 * span ends goes through `overlaps` / `within` or uses this.
 */
export const EPS = 1e-9;

/** Do two spans overlap? Spans that only touch (adjacent days) don't. */
export function overlaps(a: Span, b: Span): boolean {
  return a.from < b.to - EPS && b.from < a.to - EPS;
}

/**
 * Whole years that certainly passed between two honest ranges: from the latest the first can
 * end to the earliest the second can begin. 0 when they overlap, touch, or are less than a
 * year apart. It is what the lanes can honestly say: "at least N years later".
 *
 * Counted in years of the Sun, or, given the age both ranges fall in, in that age's own
 * years: in the Years of the Trees a year is a Valian year (`axis.yearLength` years of the
 * Sun), so 718 years of the Sun there are only 74 Valian years.
 */
export function yearsBetween(a: Span, b: Span, age?: AgeAxis): number {
  const L = age?.axis?.yearLength ?? 1;
  return Math.max(0, Math.floor((b.from - a.to) / L + EPS));
}

/** Does this age count its years in Valian years, not years of the Sun? */
export const valianYears = (age: AgeAxis): boolean => (age.axis?.yearLength ?? 1) !== 1;

// ---------- "Likely" and "possibly" at the same time (docs/DESIGN.md §4.4) ----------
//
// "Possibly" is honest: the two ranges overlap. "Likely" leans on the best guesses (`at`),
// so it is only said when the guesses mean something at that scale:
//   1. Two different events sharing a character are never "likely" at once (unless linked
//      `concurrent` or `crossing`): story order already says one follows the other.
//   2. Otherwise the guesses must be within a window set by the vaguer of the two precisions.
//      Year-or-vaguer dates (and timeless ones) never make "likely", only "possibly".

/** Day-dated: guesses within ±3 days. Exact dates still disagree by a day or two between sources and reckonings. */
export const LIKELY_DAY = 3 * ONE_DAY;
/** Month-dated: ±15 days, half a month, so a guess at mid-month reaches either end of it and no further. */
export const LIKELY_MONTH = 15 * ONE_DAY;
/** Season-dated: ±45 days, half a season: within the same part of that season, not anywhere in it. */
export const LIKELY_SEASON = 45 * ONE_DAY;

/** Precisions from finest to vaguest. */
const PRECISION_RANK: Record<Precision, number> = { day: 0, month: 1, season: 2, year: 3, decade: 4, approximate: 5 };

/** The vaguer of some precisions; undefined (timeless) beats all. */
export function vaguer(...ps: (Precision | undefined)[]): Precision | undefined {
  let v: Precision | undefined;
  for (const p of ps) {
    if (!p) return undefined;
    if (!v || PRECISION_RANK[p] > PRECISION_RANK[v]) v = p;
  }
  return v;
}

/** How far apart two best guesses may be and still be "likely" at the same time; undefined: never. */
export function likelyWindow(p: Precision | undefined): number | undefined {
  return p === 'day' ? LIKELY_DAY : p === 'month' ? LIKELY_MONTH : p === 'season' ? LIKELY_SEASON : undefined;
}

/** What the "likely" rule needs to know about an event. */
export interface Timed {
  id: string;
  span?: Span;
  at?: number;
  when?: { precision: Precision };
  characters?: string[];
  links?: { to: string; type: string }[];
}

export type Nearness = 'likely' | 'possibly';

/** Why a pair is (or isn't) "likely": for tests and explanations. */
export type NearnessWhy = 'window' | 'same-character' | 'vague' | 'too-far';

/**
 * Is event `b` likely, possibly, or not at all at the same time as event `a`?
 * `undefined` when their honest ranges don't overlap (or either is timeless).
 */
export function nearness(a: Timed, b: Timed): { kind: Nearness; why: NearnessWhy } | undefined {
  if (a.id === b.id || !a.span || !b.span || !overlaps(a.span, b.span)) return undefined;
  const linkedAtOnce = [...(a.links ?? []), ...(b.links ?? [])]
    .some((l) => (l.to === a.id || l.to === b.id) && (l.type === 'concurrent' || l.type === 'crossing'));
  if (!linkedAtOnce && a.characters?.some((c) => b.characters?.includes(c))) return { kind: 'possibly', why: 'same-character' };
  return guessNear(a.at, b.at, vaguer(a.when?.precision, b.when?.precision));
}

/**
 * The bare time cursor: is event `b` likely or possibly happening at the moment `x`?
 * A moment has no precision of its own, so the window is `b`'s alone.
 */
export function nearnessAt(x: number, b: Timed): { kind: Nearness; why: NearnessWhy } | undefined {
  if (!b.span || !within(x, b.span)) return undefined;
  return guessNear(x, b.at, b.when?.precision);
}

function guessNear(x: number | undefined, y: number | undefined, p: Precision | undefined): { kind: Nearness; why: NearnessWhy } {
  const w = likelyWindow(p);
  if (w === undefined || x === undefined || y === undefined) return { kind: 'possibly', why: 'vague' };
  // A hair of tolerance, so "exactly 3 days apart" counts after float rounding.
  return Math.abs(x - y) <= w + EPS ? { kind: 'likely', why: 'window' } : { kind: 'possibly', why: 'too-far' };
}

/** The age and date an axis position falls in, for labels. Days outside the months come back by name, with no month. */
export function axisToDate(x: number, ages: Age[]): { age: Age; year: number; month?: number; day: number | ExtraDay } | undefined {
  const dated = ages.filter((a) => a.axis).sort((a, b) => a.axis!.start - b.axis!.start);
  let age: Age | undefined;
  for (const a of dated) if (x >= a.axis!.start) age = a;
  if (!age) return undefined;
  const L = age.axis!.yearLength;
  const years = (x - age.axis!.start) / L;
  // A hair of tolerance so the first instant of a day, after float rounding, still reads as that day.
  const whole = Math.floor(years + EPS);
  const year = whole + 1;
  const s = Math.min(Math.max(Math.floor((years - whole) * SLOTS_PER_YEAR + 1e-6), 0), SLOTS_PER_YEAR - 1);
  return { age, year, ...slotDay(s) };
}

/** The day in a slot (0–365): a numbered day in its month, or a day outside the months by name. Inverse of `daySlot`. */
export function slotDay(s: number): { month?: number; day: number | ExtraDay } {
  const named = (Object.entries(EXTRA_DAY_SLOT) as [ExtraDay, number][]).find(([, v]) => v === s);
  if (named) return { day: named[0] };
  const half = s < 185 ? 0 : 6, inHalf = s - (half ? 185 : 1);
  return { month: half + Math.floor(inHalf / 30) + 1, day: (inHalf % 30) + 1 };
}

// ---------- Moments on the time cursor (docs/DESIGN.md §3.1) ----------
//
// The time cursor picks a moment: a whole year, a month or a single day (or a season, when it
// comes from an event dated by season). Its span is the moment's honest range, the same
// `dateSpan` every event gets. Stepping moves by a year, a month or a day, running on into
// the next age at an age's end.

type AgeOnAxis = Pick<Age, 'id' | 'axis'>;

/** Ages on the axis, in axis order. */
const datedAges = <A extends AgeOnAxis>(ages: A[]): A[] => ages.filter((a) => a.axis).sort((a, b) => a.axis!.start - b.axis!.start);

/**
 * How many of its own years an age has: up to the start of the next age on the axis.
 * Undefined for the last (open-ended) age and for timeless ages.
 */
export function ageYearCount(age: AgeOnAxis, ages: AgeOnAxis[]): number | undefined {
  if (!age.axis) return undefined;
  const dated = datedAges(ages);
  const next = dated[dated.findIndex((a) => a.id === age.id) + 1];
  return next ? Math.round((next.axis!.start - age.axis.start) / age.axis.yearLength) : undefined;
}

/**
 * The days the day scale of the time cursor shows around a date: its month, with the days
 * outside the months next to it (June and July with the Lithe days, Afteryule with 2 Yule,
 * Foreyule with 1 Yule). A day outside the months shows the month it follows (the Lithe days:
 * June) or opens (2 Yule: Afteryule). Slots from `from` up to, not including, `to`.
 */
export function dayWindowSlots(month: number | undefined, day: StoryDate['day']): { month: number; from: number; to: number } {
  let m = month ?? 1;
  if (typeof day === 'string') m = day === '2-yule' ? 1 : day === '1-yule' ? 12 : 6;
  const from = m === 1 ? 0 : m === 7 ? 181 : monthSlot(m);
  const to = m === 6 ? 185 : m === 12 ? 366 : monthSlot(m) + 30;
  return { month: m, from, to };
}

/** Axis position of the start of a day slot of a year (slot 366 is the start of the next year). */
export function slotStart(age: AgeOnAxis, year: number, slot: number): number {
  const L = age.axis!.yearLength;
  return age.axis!.start + (year - 1) * L + (slot * L) / SLOTS_PER_YEAR;
}

/** Axis position of the first day of a month (1–12) of a year. */
export const monthStart = (age: AgeOnAxis, year: number, month: number) => slotStart(age, year, monthSlot(month));

/** Does this slot hold a real day in this year? Only the Overlithe slot can be empty (years without one). */
export const slotIsDay = (year: number, slot: number) => slot !== EXTRA_DAY_SLOT.overlithe || hasOverlithe(year);

/** Day slot of a date (its day, or the first day of its month or year). */
export const dateSlot = (d: StoryDate) => daySlot(d.month, d.day ?? 1);

/**
 * Move a date by `n` years, months or days, running on into the neighbouring age at an age's
 * end (F.A. 590 + 1 year = S.A. 1). Months: from a day outside the months, the next month is
 * the one after it (1 Lithe + 1 → July) and the previous the one before it (→ June). Days skip
 * the Overlithe in years without one. Finer fields are kept when they still exist (an
 * Overlithe in a year without one becomes Mid-year's Day). Clamped at year 1 of the first age
 * on the axis; the open-ended last age has no end here (the caller clamps it).
 */
export function stepDate(d: StoryDate, unit: 'year' | 'month' | 'day', n: number, ages: AgeOnAxis[]): StoryDate {
  let { year } = d;
  let month = d.month, day = d.day;
  let season = unit === 'year' ? d.season : undefined;
  if (unit === 'month' && n !== 0) {
    let m: number;
    if (typeof day === 'string') {
      // The first step leaves the named day: forward to the month after it, back to the one before.
      const after: Record<ExtraDay, number> = { '2-yule': 1, '1-lithe': 7, midyear: 7, overlithe: 7, '2-lithe': 7, '1-yule': 13 };
      const before: Record<ExtraDay, number> = { '2-yule': 0, '1-lithe': 6, midyear: 6, overlithe: 6, '2-lithe': 6, '1-yule': 12 };
      m = n > 0 ? after[day] + (n - 1) : before[day] + (n + 1);
      day = 1;
    } else m = (month ?? 1) + n;
    year += Math.floor((m - 1) / 12);
    month = ((((m - 1) % 12) + 12) % 12) + 1;
  } else if (unit === 'day') {
    let s = daySlot(month, day ?? 1);
    for (let i = 0; i < Math.abs(n); i++) {
      s += Math.sign(n);
      if (s > 365) { s = 0; year++; } else if (s < 0) { s = 365; year--; }
      if (!slotIsDay(year, s)) s += Math.sign(n);
    }
    ({ month, day } = slotDay(s));
  } else if (unit === 'year') {
    year += n;
  }
  if (day === 'overlithe' && !hasOverlithe(year)) day = 'midyear';
  // Run on into the neighbouring age.
  let age = ages.find((a) => a.id === d.age);
  const dated = datedAges(ages);
  for (let guard = 0; age?.axis && guard < 16; guard++) {
    const i = dated.findIndex((a) => a.id === age!.id);
    const count = ageYearCount(age, ages);
    if (year < 1) {
      const prev = dated[i - 1];
      if (!prev) { year = 1; break; }
      year += ageYearCount(prev, ages)!;
      age = prev;
    } else if (count !== undefined && year > count) {
      year -= count;
      age = dated[i + 1];
    } else break;
  }
  const out: StoryDate = { age: age?.id ?? d.age, year };
  if (month !== undefined && typeof day !== 'string') out.month = month;
  if (day !== undefined) out.day = day;
  if (season) out.season = season;
  return out;
}

/** Is `x` inside a span (from inclusive, to exclusive), with `EPS` of tolerance at both ends? */
export function within(x: number, s: Span): boolean {
  return x >= s.from - EPS && x < s.to - EPS;
}

/**
 * The time cursor over a whole moment (a day, a month, a season or a year): is event `b`
 * likely, possibly, or not at all happening then? "Possibly" when its honest range overlaps
 * the moment; "likely" when its best guess falls inside the moment or within `b`'s own window
 * of it (a moment has no precision of its own, as for `nearnessAt`). An empty span is the
 * bare cursor, exactly `nearnessAt`.
 */
export function nearnessDuring(m: Span, b: Timed): { kind: Nearness; why: NearnessWhy } | undefined {
  if (m.to <= m.from) return nearnessAt(m.from, b);
  if (!b.span || !overlaps(m, b.span)) return undefined;
  const w = likelyWindow(b.when?.precision);
  if (w === undefined || b.at === undefined) return { kind: 'possibly', why: 'vague' };
  return b.at >= m.from - w - EPS && b.at < m.to + w + EPS ? { kind: 'likely', why: 'window' } : { kind: 'possibly', why: 'too-far' };
}
