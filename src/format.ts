// Words for dates: an event's honest range as the sources give it (docs/DESIGN.md §4.4).
// Only labels live here; positions on the axis and every bit of date math are in
// data/calendar.ts. The best guess (`at`) is never shown as a date.

import { index } from './chronicle';
import type { Lang, Precision, StoryDate, When } from './data/types';
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

/** Something dated: an event (`when`), or a journey leg whose end may be known more or less precisely than its start. */
export type Dated = { age: string; when?: When & { endPrecision?: Precision } };

/** The last year a date at this precision can fall in, as the end of a range: a decade runs to its ninth year. */
const lastYear = (d: StoryDate, p: Precision) => (p === 'decade' ? d.year + 9 : d.year);

/**
 * An event's honest date: its start, and its end when it lasts, at the precision the
 * sources allow. Timeless events give their age's name. A range within one age names the
 * age once: "Around F.A. 545–587", "Y.T. 1250–1459", "June – 1 Lithe, T.A. 2941".
 */
export function honestDate(e: Dated, L: Lang): string {
  if (!e.when) return tr(index.ages.find((a) => a.id === e.age)?.name, L);
  const { start, end, precision: p } = e.when;
  if (!end) return dateLabel(start, p, L);
  const q = e.when.endPrecision ?? p;
  if (end.age !== start.age) return `${dateLabel(start, p, L)} – ${dateLabel(end, q, L)}`;
  const a = withinYear(start, p, L), b = withinYear(end, q, L);
  if (a && b && end.year === start.year) return cap(a === b ? `${a}, ${yearPart(end, q, L)}` : `${a} – ${b}, ${yearPart(end, q, L)}`);
  if (!a && !b) {
    const y0 = start.year, y1 = lastYear(end, q);
    const years = y0 === y1 && p !== 'decade' ? `${y0}` : `${y0}–${y1}`;
    const around = p === 'approximate' || q === 'approximate' ? `${ui('around', L)} ` : '';
    return cap(`${around}${ageLabel(start.age, L)} ${years}`);
  }
  return `${dateLabel(start, p, L)} – ${dateLabel(end, q, L)}`;
}

/** The short part finer than the year: "Apr", "summer", "1 Lithe"; empty for a year or coarser. */
function shortWithinYear(d: StoryDate, p: Precision, L: Lang): string {
  if (p === 'year' || p === 'decade' || p === 'approximate') return '';
  if (typeof d.day === 'string') return ui(`day_${d.day}`, L);
  if (p === 'season' && d.season) return ui(d.season, L);
  if (d.month) return new Date(2000, d.month - 1, 1).toLocaleString(L, { month: 'short' }).replace('.', '');
  return d.season ? ui(d.season, L) : '';
}

/** One date, short: "Apr 2941", "c. 2463", "2850–59". */
function shortOne(d: StoryDate, p: Precision, L: Lang): string {
  if (p === 'approximate') return `${ui('circa', L)} ${d.year}`;
  if (p === 'decade') return `${d.year}–${String(d.year + 9).slice(-2)}`;
  return [shortWithinYear(d, p, L), `${d.year}`].filter(Boolean).join(' ');
}

/**
 * A short date for lists: "Apr 2941", "summer 2941", "1 Lithe 2941", "c. 2463", and ranges
 * when the date has an end: "52–116", "c. 545–587", "1250–1459", "Jun – 1 Lithe 2941".
 */
export function shortDate(e: Dated, L: Lang): string {
  const w = e.when;
  if (!w) return '';
  const { start, end, precision: p } = w;
  if (!end) return shortOne(start, p, L);
  const q = w.endPrecision ?? p;
  if (end.age !== start.age) return `${ageLabel(start.age, L)} ${shortOne(start, p, L)} – ${ageLabel(end.age, L)} ${shortOne(end, q, L)}`;
  const a = shortWithinYear(start, p, L), b = shortWithinYear(end, q, L);
  if (!a && !b) {
    const y0 = start.year, y1 = lastYear(end, q);
    const around = p === 'approximate' || q === 'approximate' ? `${ui('circa', L)} ` : '';
    return y0 === y1 && p !== 'decade' ? `${around}${y0}` : `${around}${y0}–${y1}`;
  }
  if (a && b && start.year === end.year) return a === b ? `${a} ${start.year}` : `${a} – ${b} ${start.year}`;
  return `${shortOne(start, p, L)} – ${shortOne(end, q, L)}`;
}
