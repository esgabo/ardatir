// Which recording plays: the audio language is apart from the reading language
// (narration voices design, §6). A Spanish reader hears Spanish when it is recorded,
// else English, else nothing; `?audio=` can ask for a language or for none.

import type { Lang } from './data/types';

/** `asked`: what ?audio= says (undefined = as the reading language). Null means no audio. */
export function pickAudio(available: readonly Lang[], reading: Lang, asked?: Lang | 'off'): Lang | null {
  if (asked === 'off') return null;
  if (asked && available.includes(asked)) return asked;
  if (available.includes(reading)) return reading;
  if (available.includes('en')) return 'en';
  return null;
}
