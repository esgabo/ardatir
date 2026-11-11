// The URL is the state (docs/DESIGN.md §7). Every view has a route:
//
//   #/event/<id>?t=0.42&follow=bilbo&lang=es   a staged event's stage; any other event's page
//   #/event/<id>?audio=en&lang=es              hear English, read Spanish (audio=off: no voice)
//   #/lives?with=tuor,turin&lang=es             character lanes, side by side
//   #/time/third-age/3019-03-15?zoom=year       the time cursor at a moment (moment.ts), at a scale
//   #/time/first-age/495   #/time/before-time   a whole year; a timeless age
//   #/time/7050.2                               an axis position (years of the Sun): the day it falls on
//   #/time?from=roast-mutton                    from an event: the timeline offers the way back
//   #/start                                     the opening over the cosmos (a first visit's welcome)
//
// Links inside the site are plain hrefs built here, so the back button and sharing just work.

import type { Lang } from './data/types';

export type Route =
  | { kind: 'event'; eventId?: string; t?: number; follow?: string; lang?: string; audio?: string }
  | { kind: 'lives'; with: string[]; lang?: string }
  /** `where` is the moment's path as written (parsed by moment.ts); absent: the default moment. */
  | { kind: 'time'; where?: string; zoom?: string; from?: string; lang?: string }
  /** The opening (docs/DESIGN.md §3.5): the Ainulindalë with a few words, then three ways in. */
  | { kind: 'start'; lang?: string };

export function parseRoute(hash = location.hash): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const q = new URLSearchParams(query);
  const lang = q.get('lang') ?? undefined;
  if (/^\/start\/?$/.test(path)) return { kind: 'start', lang };
  if (/^\/lives\/?$/.test(path)) return { kind: 'lives', with: (q.get('with') ?? '').split(',').filter((x) => /^[\w-]+$/.test(x)), lang };
  const tm = path.match(/^\/time(?:\/(.*))?$/);
  if (tm) {
    const from = q.get('from') ?? undefined;
    return { kind: 'time', where: tm[1]?.replace(/\/+$/, '') || undefined, zoom: q.get('zoom') ?? undefined, from: from && /^[\w-]+$/.test(from) ? from : undefined, lang };
  }
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

/** The time cursor at a moment (its readable path, `momentPath` in moment.ts); `zoom` only when not the moment's default scale. */
export function timeHref(where: string | undefined, lang: Lang, params: { zoom?: string; from?: string } = {}): string {
  return `#/time${where ? `/${where}` : ''}${query(params, lang)}`;
}

/** The opening over the cosmos: the welcome a first visit sees, reopened from the sidebar. */
export function startHref(lang: Lang): string {
  return `#/start${query({}, lang)}`;
}
