// The URL is the state (docs/DESIGN.md §7). Every view has a route:
//
//   #/event/<id>?t=0.42&follow=bilbo&lang=es   a staged event's stage; any other event's page
//
// Links inside the site are plain hrefs built here, so the back button and sharing just work.

import type { Lang } from './data/types';

export type Route =
  | { kind: 'event'; eventId?: string; t?: number; follow?: string; lang?: string };

export function parseRoute(hash = location.hash): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const q = new URLSearchParams(query);
  const lang = q.get('lang') ?? undefined;
  const m = path.match(/^\/event\/([\w-]+)/);
  const tv = q.get('t') === null ? NaN : Number(q.get('t'));
  return {
    kind: 'event',
    eventId: m?.[1],
    t: Number.isFinite(tv) ? Math.min(Math.max(tv, 0), 1) : undefined,
    follow: q.get('follow') ?? undefined,
    lang,
  };
}

/** `?a=b&lang=es`, leaving out English (the default) and empty values. */
function query(params: Record<string, string | undefined>, lang: Lang): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  if (lang !== 'en') q.set('lang', lang);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function eventHref(id: string, lang: Lang, params: { t?: string; follow?: string } = {}): string {
  return `#/event/${id}${query(params, lang)}`;
}
