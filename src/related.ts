// What an event connects to: its links (both directions, from the index) and what else
// may have happened at the same time. Shared by the Meanwhile panel and event pages.

import { index } from './chronicle';
import { nearness, type NearnessWhy } from './data/calendar';
import type { EventLink, EventSummary } from './data/types';

/** The event's links with the events they point to (the build adds each link's reverse). */
export function linkedEvents(ev: EventSummary): { event: EventSummary; link: EventLink }[] {
  return ev.links
    .map((link) => ({ event: index.events.find((e) => e.id === link.to)!, link }))
    .filter((x) => !!x.event);
}

export interface SameTime {
  /** Best guesses close at the scale both dates allow (docs/DESIGN.md §4.4): our best guess. */
  likely: EventSummary[];
  /** Honest ranges overlap, and no more can be said. */
  possibly: { event: EventSummary; why: NearnessWhy }[];
}

/**
 * Events whose honest range overlaps this one's, other than those it links to, split into
 * "likely" and "possibly" (`nearness` in data/calendar.ts), each nearest first by best guess
 * (used only to order them, never shown as a date) and at most `limit` long.
 */
export function sameTime(ev: EventSummary, limit = 8): SameTime {
  const out: SameTime = { likely: [], possibly: [] };
  if (!ev.span) return out;
  const linked = new Set(ev.links.map((l) => l.to));
  const dist = (e: EventSummary) => Math.abs((e.at ?? 0) - (ev.at ?? 0));
  const near = index.events
    .filter((e) => !linked.has(e.id))
    .map((e) => ({ e, n: nearness(ev, e) }))
    .filter((x) => !!x.n)
    .sort((a, b) => dist(a.e) - dist(b.e));
  for (const { e, n } of near) {
    if (n!.kind === 'likely') { if (out.likely.length < limit) out.likely.push(e); }
    else if (out.possibly.length < limit) out.possibly.push({ event: e, why: n!.why });
  }
  return out;
}
