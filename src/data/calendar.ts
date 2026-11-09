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

/** Do two spans overlap? */
export function overlaps(a: Span, b: Span): boolean {
  return a.from < b.to && b.from < a.to;
}

/**
 * Whole years of the Sun that certainly passed between two honest ranges: from the latest
 * the first can end to the earliest the second can begin. 0 when they overlap, touch, or
 * are less than a year apart. It is what the lanes can honestly say: "at least N years later".
 */
export function yearsBetween(a: Span, b: Span): number {
  return Math.max(0, Math.floor(b.from - a.to + 1e-9));
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
  const whole = Math.floor(years + 1e-9);
  const year = whole + 1;
  const s = Math.min(Math.max(Math.floor((years - whole) * SLOTS_PER_YEAR + 1e-6), 0), SLOTS_PER_YEAR - 1);
  const named = (Object.entries(EXTRA_DAY_SLOT) as [ExtraDay, number][]).find(([, v]) => v === s);
  if (named) return { age, year, day: named[0] };
  const half = s < 185 ? 0 : 6, inHalf = s - (half ? 185 : 1);
  return { age, year, month: half + Math.floor(inHalf / 30) + 1, day: (inHalf % 30) + 1 };
}
