// The words of a narration script in one language, and the hash that ties a recording to them.
// Shared by the narration export (scripts/narration/export.ts) and the content build's
// stale-recording check (scripts/content/build.ts). See content/README.md, "Recordings".

import { createHash } from 'node:crypto';
import type { Lang, LocalizedText } from '../../src/data/types.ts';

export interface Passage { id: string; text: LocalizedText }

/**
 * The text a recording in `lang` reads for one passage: that language, else English
 * (the site falls back the same way), with whitespace collapsed so re-wrapping the YAML
 * doesn't count as a change.
 */
export function passageText(p: Passage, lang: Lang): string {
  const s = p.text[lang] || p.text.en;
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * `textHash` for a recording: `sha256:` + the first 16 hex digits of SHA-256 over
 * `<id>\t<text>\n` for every passage, in order. Any change to a passage's words, its id,
 * or the passage order changes the hash.
 */
export function narrationHash(passages: Passage[], lang: Lang): string {
  const h = createHash('sha256');
  for (const p of passages) h.update(`${p.id}\t${passageText(p, lang)}\n`);
  return `sha256:${h.digest('hex').slice(0, 16)}`;
}

export const TEXT_HASH = /^sha256:[0-9a-f]{16}$/;
