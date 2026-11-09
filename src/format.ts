// Words for dates: an event's honest range as the sources give it (docs/DESIGN.md §4.4).
// Only labels live here; positions on the axis and every bit of date math are in
// data/calendar.ts. The best guess (`at`) is never shown as a date.

import { index } from './chronicle';
import type { EventSummary, Lang, Precision, StoryDate } from './data/types';
import { t as ui, tr } from './i18n';

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function ageLabel(ageId: string, L: Lang): string {
  const age = index.ages.find((a) => a.id === ageId);
  return tr(age?.abbr, L) || tr(age?.name, L);
}

/** The part of a date finer than the year: "26 April", "summer", "1 Lithe"; empty for a year. */
function withinYear(d: StoryDate, p: Precision, L: Lang): string {
  if (p === 'year' || p === 'decade' || p === 'approximate') return '';
  if (typeof d.day === 'string') return ui(`day_${d.day}`, L);
  const month = d.month ? new Date(2000, d.month - 1, 1).toLocaleString(L, { month: 'long' }) : '';
  if (p === 'season' && d.season) return ui(d.season, L);
  if (p === 'day' && d.day && month) return L === 'es' ? `${d.day} de ${month}` : `${d.day} ${month}`;
  return month;
}

/** The year part, widened by precision: "T.A. 2941", "T.A. 2850–2859", "around T.A. 2463". */
function yearPart(d: StoryDate, p: Precision, L: Lang): string {
  const age = ageLabel(d.age, L);
  if (p === 'decade') return `${age} ${d.year}–${d.year + 9}`;
  if (p === 'approximate') return `${ui('around', L)} ${age} ${d.year}`;
  return `${age} ${d.year}`;
}

/** One date, as precisely as it is known: "26 April, T.A. 2941", "Summer, T.A. 2941". */
export function dateLabel(d: StoryDate, p: Precision, L: Lang): string {
  const inner = withinYear(d, p, L);
  return cap(inner ? `${inner}, ${yearPart(d, p, L)}` : yearPart(d, p, L));
}

/**
 * An event's honest date: its start, and its end when it lasts, at the precision the
 * sources allow. Timeless events give their age's name.
 */
export function honestDate(e: Pick<EventSummary, 'age' | 'when'>, L: Lang): string {
  if (!e.when) return tr(index.ages.find((a) => a.id === e.age)?.name, L);
  const { start, end, precision: p } = e.when;
  if (!end) return dateLabel(start, p, L);
  const sameYear = end.age === start.age && end.year === start.year;
  const a = withinYear(start, p, L), b = withinYear(end, p, L);
  if (sameYear && a && b) return cap(`${a} – ${b}, ${yearPart(end, p, L)}`);
  if (end.age === start.age && !a && !b && p === 'year') return `${ageLabel(start.age, L)} ${start.year}–${end.year}`;
  return `${dateLabel(start, p, L)} – ${dateLabel(end, p, L)}`;
}

/** A short date for lists: "Apr 2941", "summer 2941", "1 Lithe 2941", "c. 2463". */
export function shortDate(e: Pick<EventSummary, 'age' | 'when'>, L: Lang): string {
  const d = e.when?.start;
  if (!d) return '';
  const p = e.when!.precision;
  if (p === 'approximate') return `${ui('circa', L)} ${d.year}`;
  if (p === 'decade') return `${d.year}–${String(d.year + 9).slice(-2)}`;
  const inner = typeof d.day === 'string' ? ui(`day_${d.day}`, L)
    : p === 'year' ? ''
    : d.month ? new Date(2000, d.month - 1, 1).toLocaleString(L, { month: 'short' }).replace('.', '')
    : d.season ? ui(d.season, L) : '';
  return [inner, `${d.year}`].filter(Boolean).join(' ');
}
