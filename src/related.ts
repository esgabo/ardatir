// What an event connects to: its links (both directions, from the index) and what else
// may have happened at the same time. Shared by the Meanwhile panel and event pages.

import { index } from './chronicle';
import { overlaps } from './data/calendar';
import type { EventLink, EventSummary } from './data/types';

/** The event's links with the events they point to (the build adds each link's reverse). */
export function linkedEvents(ev: EventSummary): { event: EventSummary; link: EventLink }[] {
  return ev.links
    .map((link) => ({ event: index.events.find((e) => e.id === link.to)!, link }))
    .filter((x) => !!x.event);
}

/**
 * Events whose honest range overlaps this one's, other than those it links to, nearest
 * first by best guess (used only to order them, never shown as a date).
 */
export function sameTime(ev: EventSummary, limit = 8): EventSummary[] {
  if (!ev.span) return [];
  const linked = new Set(ev.links.map((l) => l.to));
  return index.events
    .filter((e) => e.id !== ev.id && !linked.has(e.id) && e.span && overlaps(e.span, ev.span!))
    .sort((a, b) => Math.abs((a.at ?? 0) - (ev.at ?? 0)) - Math.abs((b.at ?? 0) - (ev.at ?? 0)))
    .slice(0, limit);
}
