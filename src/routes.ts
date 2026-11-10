// The URL is the state (docs/DESIGN.md §7). Every view has a route:
//
//   #/event/<id>?t=0.42&follow=bilbo&lang=es   a staged event's stage; any other event's page
//   #/event/<id>?audio=en&lang=es              hear English, read Spanish (audio=off: no voice)
//   #/lives?with=tuor,turin&lang=es             character lanes, side by side
//
// Links inside the site are plain hrefs built here, so the back button and sharing just work.

import type { Lang } from './data/types';

export type Route =
  | { kind: 'event'; eventId?: string; t?: number; follow?: string; lang?: string; audio?: string }
  | { kind: 'lives'; with: string[]; lang?: string };

export function parseRoute(hash = location.hash): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const q = new URLSearchParams(query);
  const lang = q.get('lang') ?? undefined;
  if (/^\/lives\/?$/.test(path)) return { kind: 'lives', with: (q.get('with') ?? '').split(',').filter((x) => /^[\w-]+$/.test(x)), lang };
  const m = path.match(/^\/event\/([\w-]+)/);
  const tv = q.get('t') === null ? NaN : Number(q.get('t'));
  return {
    kind: 'event',
    eventId: m?.[1],
    t: Number.isFinite(tv) ? Math.min(Math.max(tv, 0), 1) : undefined,
    follow: q.get('follow') ?? undefined,
    lang,
    audio: q.get('audio') ?? undefined,
  };
}

/** `?a=b&lang=es`, leaving out English (the default) and empty values. */
function query(params: Record<string, string | undefined>, lang: Lang): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  if (lang !== 'en') q.set('lang', lang);
  const s = q.toString().replace(/%2C/g, ','); // keep lists readable: with=tuor,turin
  return s ? `?${s}` : '';
}

export function eventHref(id: string, lang: Lang, params: { t?: string; follow?: string; audio?: string } = {}): string {
  return `#/event/${id}${query(params, lang)}`;
}

/** Character lanes for these characters, in this order. */
export function livesHref(ids: string[], lang: Lang): string {
  return `#/lives${query({ with: ids.join(',') || undefined }, lang)}`;
}
