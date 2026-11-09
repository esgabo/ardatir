// What is foretold, not told as history (docs/DESIGN.md §4.8): events in an age flagged
// `foretold` (the Last Battle, the Second Music). Wherever one is shown, it carries a small
// "Foretold" badge, and its page says who foretold it and where the prophecy comes from.

import { characterMap, index } from './chronicle';
import type { EventSummary, Lang } from './data/types';
import { h } from './dom';
import { t as ui, tr, type UiKey } from './i18n';

/** Is this age (or this event's age) prophecy rather than history? */
export const isForetoldAge = (ageId: string | undefined) => !!index.ages.find((a) => a.id === ageId)?.foretold;
export const isForetold = (e: Pick<EventSummary, 'age'>) => isForetoldAge(e.age);

/** "The Lost Road and Other Writings, “Quenta Silmarillion”": a source cited by book and chapter. */
export function sourceLabel(source: EventSummary['source'], L: Lang): string {
  if (!source) return '';
  const book = ui(`book_${source.book}` as UiKey, L) || source.book;
  const ch = source.chapter;
  const chapter = typeof ch === 'number' ? `${ui('chapter', L)} ${ch}` : ch ? `“${ch}”` : '';
  return [book, chapter].filter(Boolean).join(', ');
}

/**
 * The line every foretold event's page carries: who foretold it, that it is not history, and
 * the source: "Foretold by Mandos, not told as history. Source: The Lost Road…, “Quenta Silmarillion”."
 */
export function foretoldLine(e: Pick<EventSummary, 'foretoldBy' | 'source'>, L: Lang): string {
  const by = e.foretoldBy ? tr(characterMap.get(e.foretoldBy)?.name, L) : '';
  const first = by ? ui('foretoldBy', L).replace('{a}', by) : ui('foretoldNoOne', L);
  const src = sourceLabel(e.source, L);
  return src ? `${first} ${ui('foretoldSource', L).replace('{s}', src)}` : first;
}

/** The small "Foretold" badge, or nothing for history. */
export function foretoldBadge(e: Pick<EventSummary, 'age'> | undefined, L: Lang): HTMLElement | null {
  if (!e || !isForetold(e)) return null;
  return h('span', { class: 'foretold-badge', title: ui('foretoldHint', L) }, ui('foretold', L));
}
