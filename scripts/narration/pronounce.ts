// How unusual names are said: content/pronunciation.yaml, applied by rewriting the text
// we send to the Voice Studio (never through its shared lexicon), so a recording never
// depends on what happens to be stored on the box. See the narration voices design, §4.4.

import type { Lang } from '../../src/data/types.ts';

/** Per language: a name as written → how to say it (a respelling). */
export type Lexicon = Partial<Record<Lang, Record<string, string>>>;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replace every listed name in `text` with its respelling: whole words only (a name
 * inside a longer word is left alone), case-sensitive, longest name first.
 * `used` lists the names replaced, sorted and unique; it is part of the render cache key.
 */
export function respell(text: string, lang: Lang, lex: Lexicon): { text: string; used: string[] } {
  const entries = Object.entries(lex[lang] ?? {});
  if (!entries.length) return { text, used: [] };
  const names = entries.map(([n]) => n).sort((a, b) => b.length - a.length);
  const say = new Map(entries);
  const used = new Set<string>();
  const re = new RegExp(`(?<![\\p{L}\\p{M}])(?:${names.map(escape).join('|')})(?![\\p{L}\\p{M}])`, 'gu');
  const out = text.replace(re, (m) => { used.add(m); return say.get(m)!; });
  return { text: out, used: [...used].sort() };
}
