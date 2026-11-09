// The shared time axis: every dated thing in Arda placed on one line, in years of the Sun.
// Used by the content build (to place events) and by the site (time cursor, labels).
// See docs/DESIGN.md §4.4.

import type { Age, Precision, Season, Span, StoryDate, When } from './types';

/** Months are treated as 12 × 30 days, following the sources' reckoning closely enough for overlaps. */
const DAYS_PER_YEAR = 360;

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
  const at = (month: number, day = 1) => yearStart + (((month - 1) * 30 + (day - 1)) / DAYS_PER_YEAR) * L;

  switch (precision) {
    case 'day': {
      const from = at(date.month ?? 1, date.day ?? 1);
      return { from, to: from + L / DAYS_PER_YEAR };
    }
    case 'month': {
      const from = at(date.month ?? 1);
      return { from, to: from + (30 / DAYS_PER_YEAR) * L };
    }
    case 'season': {
      const from = at(date.season ? SEASON_START[date.season] : (date.month ?? 1));
      return { from, to: from + (90 / DAYS_PER_YEAR) * L };
    }
    case 'year':
      return { from: yearStart, to: yearStart + L };
    case 'decade':
      return { from: yearStart, to: yearStart + 10 * L };
    case 'approximate':
      return { from: yearStart - APPROXIMATE_YEARS * L, to: yearStart + (APPROXIMATE_YEARS + 1) * L };
  }
}

/** Axis span of an event's `when`, from the start of its start date to the end of its end date. */
export function whenSpan(when: When, ages: Map<string, AgeAxis>): Span | undefined {
  const startAge = ages.get(when.start.age);
  if (!startAge) return undefined;
  const a = dateSpan(when.start, when.precision, startAge);
  if (!a) return undefined;
  if (!when.end) return a;
  const endAge = ages.get(when.end.age);
  const b = endAge && dateSpan(when.end, when.precision, endAge);
  return b ? { from: a.from, to: Math.max(a.to, b.to) } : a;
}

/** Do two spans overlap? */
export function overlaps(a: Span, b: Span): boolean {
  return a.from < b.to && b.from < a.to;
}

/** The age and year an axis position falls in, for labels. */
export function axisToDate(x: number, ages: Age[]): { age: Age; year: number; month: number; day: number } | undefined {
  const dated = ages.filter((a) => a.axis).sort((a, b) => a.axis!.start - b.axis!.start);
  let age: Age | undefined;
  for (const a of dated) if (x >= a.axis!.start) age = a;
  if (!age) return undefined;
  const L = age.axis!.yearLength;
  const years = (x - age.axis!.start) / L;
  const year = Math.floor(years) + 1;
  const dayOfYear = Math.floor((years - Math.floor(years)) * DAYS_PER_YEAR);
  return { age, year, month: Math.floor(dayOfYear / 30) + 1, day: (dayOfYear % 30) + 1 };
}
