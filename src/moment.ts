// A moment on the time cursor (docs/DESIGN.md §3.1): a whole year, a month, a single day, or
// a season (from an event dated by season), in one age; or a timeless age as a whole. Its
// readable form is what the URL holds: #/time/third-age/3019-03-15. Pure: no DOM, no index,
// so it can be tested. Date math is in data/calendar.ts.

import { ageYearCount, axisToDate, dateSpan, hasOverlithe, valianYears } from './data/calendar';
import { EXTRA_DAYS, SEASONS, type Age, type EventSummary, type ExtraDay, type Season, type Span, type StoryDate } from './data/types';

export type MomentPrecision = 'year' | 'season' | 'month' | 'day';

export interface Moment {
  age: string;
  /** Absent for a timeless age: the moment is the age itself, outside time. */
  date?: StoryDate;
  precision?: MomentPrecision;
}

/** The moment the timeline opens on when the URL names none: the Unexpected Party. */
export const DEFAULT_MOMENT = 'third-age/2941-04-26';

type AgeLike = Pick<Age, 'id' | 'axis'>;

/** Ages with years of the Sun allow months and days; in Valian years only whole years mean anything. */
export const finePrecision = (age: AgeLike | undefined) => !!age?.axis && !valianYears(age);

/** The precision a date says by itself: a day, a month, a season, else the year. */
export function precisionOf(d: StoryDate): MomentPrecision {
  if (d.day !== undefined) return 'day';
  if (d.month !== undefined) return 'month';
  if (d.season) return 'season';
  return 'year';
}

/** Make a moment from a date: its precision from what the date says, coarsened to a year in Valian years. */
export function momentOf(d: StoryDate, ages: AgeLike[]): Moment {
  const age = ages.find((a) => a.id === d.age);
  if (!finePrecision(age)) return { age: d.age, date: { age: d.age, year: d.year }, precision: 'year' };
  return { age: d.age, date: d, precision: precisionOf(d) };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The readable path of a moment: `third-age/3019-03-15`, `third-age/3019-03`, `third-age/3019`, `third-age/3019-midyear`, `third-age/2941-summer`, `before-time`. */
export function momentPath(m: Moment): string {
  const d = m.date;
  if (!d) return m.age;
  let s = `${m.age}/${d.year}`;
  if (m.precision === 'season' && d.season) s += `-${d.season}`;
  else if (typeof d.day === 'string') s += `-${d.day}`;
  else if (d.month !== undefined && m.precision !== 'year') {
    s += `-${pad(d.month)}`;
    if (m.precision === 'day' && d.day !== undefined) s += `-${pad(d.day)}`;
  }
  return s;
}

/**
 * Read a moment from the URL: the readable form (any of `momentPath`'s), or a bare axis
 * position (`7050.2`, as years of the Sun), which becomes the day it falls on. A dated age
 * with no date gives `{ age }` (the caller picks a year in it). A year past the age's end
 * becomes its last year (the open-ended last age is clamped by the caller, to what the control
 * shows); an Overlithe in a year without one becomes Mid-year's Day, as `stepDate` does.
 * Undefined when the path names no age, or a day that does not exist (month 13, 31 March).
 */
export function parseMoment(path: string, ages: AgeLike[]): Moment | undefined {
  const p = decodeURIComponent(path).replace(/^\/+|\/+$/g, '');
  if (/^-?\d+(\.\d+)?$/.test(p)) {
    const d = axisToDate(Number(p), ages as Age[]);
    if (!d) return undefined;
    return momentOf({ age: d.age.id, year: d.year, ...(d.month ? { month: d.month } : {}), day: d.day }, ages);
  }
  const [ageId, rest] = p.split('/');
  const age = ages.find((a) => a.id === ageId);
  if (!age) return undefined;
  if (!age.axis) return rest ? undefined : { age: age.id };
  if (!rest) return { age: age.id };
  const m = /^(\d+)(?:-([a-z0-9-]+))?$/.exec(rest);
  if (!m) return undefined;
  const year = Number(m[1]);
  if (year < 1) return undefined;
  const count = ageYearCount(age, ages);
  if (count !== undefined && year > count) return momentOf({ age: age.id, year: count }, ages);
  const tail = m[2];
  let date: StoryDate = { age: age.id, year };
  if (tail) {
    const md = /^(\d{1,2})(?:-(\d{1,2}))?$/.exec(tail);
    if ((SEASONS as readonly string[]).includes(tail)) date = { ...date, season: tail as Season };
    else if ((EXTRA_DAYS as readonly string[]).includes(tail)) {
      date = { ...date, day: tail === 'overlithe' && !hasOverlithe(year) ? 'midyear' : tail as ExtraDay };
    } else if (md) {
      const month = Number(md[1]);
      if (month < 1 || month > 12) return undefined;
      date = { ...date, month };
      if (md[2] !== undefined) {
        const day = Number(md[2]);
        if (day < 1 || day > 30) return undefined;
        date = { ...date, day };
      }
    } else return undefined;
  }
  return momentOf(date, ages);
}

/** The honest range of a moment on the axis; undefined for a timeless age. */
export function momentSpan(m: Moment, ages: AgeLike[]): Span | undefined {
  const age = ages.find((a) => a.id === m.age);
  if (!age || !m.date || !m.precision) return undefined;
  return dateSpan(m.date, m.precision, age);
}

/**
 * The moment an event's start gives, at its own precision as far as a moment can hold it:
 * a day, a month or a season; a year for anything vaguer (decade, approximate). A timeless
 * event gives its age.
 */
export function momentOfEvent(e: Pick<EventSummary, 'age' | 'when'>, ages: AgeLike[]): Moment {
  if (!e.when) return { age: e.age };
  const { start, precision: p } = e.when;
  const d: StoryDate = { age: start.age, year: start.year };
  if (p === 'day') { if (start.month !== undefined && typeof start.day !== 'string') d.month = start.month; d.day = start.day; }
  else if (p === 'month' && start.month !== undefined) d.month = start.month;
  else if (p === 'season') { if (start.season) d.season = start.season; else if (start.month) d.month = start.month; }
  return momentOf(d, ages);
}

/** Are two moments the same? */
export const sameMoment = (a: Moment, b: Moment) => momentPath(a) === momentPath(b);
