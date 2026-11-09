// Loads the generated content (public/data/, built from content/ by scripts/content).
// The index loads once at startup; each playable event's detail loads when opened, and a
// scripted event's narration (to read as text) when its page opens.

import type { Character, ContentIndex, EventDetail, EventScript, EventSummary } from './data/types';

const base = import.meta.env.BASE_URL + 'data/';

export let index: ContentIndex;
export let characterMap = new Map<string, Character>();

export async function loadIndex(): Promise<ContentIndex> {
  const res = await fetch(base + 'index.json');
  if (!res.ok) throw new Error(`content index missing (${res.status}); run npm run content`);
  index = (await res.json()) as ContentIndex;
  characterMap = new Map(index.characters.map((c) => [c.id, c]));
  return index;
}

/** Events that can be played (they have staging). */
export function playable(): EventSummary[] {
  return index.events.filter((e) => e.stage);
}

const cache = new Map<string, Promise<EventDetail>>();

/** Load a playable event; falls back to the first playable one. */
export function loadEvent(id: string | undefined): Promise<EventDetail> {
  const target = index.events.find((e) => e.id === id && e.stage) ?? playable()[0];
  let p = cache.get(target.id);
  if (!p) {
    p = fetch(`${base}events/${target.id}.json`).then((r) => {
      if (!r.ok) throw new Error(`event ${target.id} missing (${r.status})`);
      return r.json() as Promise<EventDetail>;
    });
    p.catch(() => cache.delete(target.id)); // a failed fetch can be retried
    cache.set(target.id, p);
  }
  return p;
}

const scripts = new Map<string, Promise<EventScript>>();

/** The narration of an event that has one (status scripted or later), to read as text. */
export function loadScript(id: string): Promise<EventScript> {
  let p = scripts.get(id);
  if (!p) {
    p = fetch(`${base}scripts/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`script ${id} missing (${r.status})`);
      return r.json() as Promise<EventScript>;
    });
    p.catch(() => scripts.delete(id));
    scripts.set(id, p);
  }
  return p;
}

export const eventById = (id: string): EventSummary | undefined => index.events.find((e) => e.id === id);
