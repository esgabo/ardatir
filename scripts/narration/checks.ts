// Automatic checks on one rendered passage: did the voice read the words, say the names,
// keep its pace, and stay clean? Every passage gets these; the author hears only the
// flagged ones plus a sample. Pure. See the narration voices design, §5.3.

import type { AudioStats } from './wav.ts';

export interface CheckInput {
  /** The passage as written in narration.yaml (before respelling). */
  text: string;
  /** What speech recognition heard in the take. */
  transcript: string;
  /** Pronunciation-list names in this passage: as written, and as sent to the voice. */
  names: { name: string; said: string }[];
  stats: AudioStats;
  /** This narrator's median words per second, once it has enough takes. */
  medianWps?: number;
}

export type Flag = { kind: 'words' | 'edges' | 'name' | 'pace' | 'length' | 'clipping' | 'silence' | 'quiet'; detail: string };

/** Starting points; tuned on the first real batch (plan Task 9). */
export const LIMITS = { wer: 0.10, pace: 0.25, silence: 1.5, clipDb: -0.1, quietDb: -35, secPerChar: [0.04, 0.12] as [number, number] };

export function normalizeWords(s: string): string[] {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean);
}

/** Word-level Levenshtein distance ÷ reference length. */
export function wordErrorRate(ref: string[], hyp: string[]): number {
  if (!ref.length) return hyp.length ? 1 : 0;
  let prev = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i++) {
    const cur = [i];
    for (let j = 1; j <= hyp.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[hyp.length] / ref.length;
}

/** Does `seq` appear as consecutive words in `words`? */
const contains = (words: string[], seq: string[]) =>
  seq.length > 0 && words.some((_, i) => seq.every((w, k) => words[i + k] === w));

export function checkPassage(c: CheckInput): Flag[] {
  const flags: Flag[] = [];
  const heard = normalizeWords(c.transcript);

  // Names first: each must be heard as written or as its respelling.
  const nameWords = new Set<string>();
  for (const n of c.names) {
    const asWritten = normalizeWords(n.name), asSaid = normalizeWords(n.said);
    for (const w of [...asWritten, ...asSaid]) nameWords.add(w);
    if (!contains(heard, asWritten) && !contains(heard, asSaid)) flags.push({ kind: 'name', detail: `"${n.name}" not heard` });
  }

  // Words, with the names set aside (speech recognition spells respellings unpredictably).
  const ref = normalizeWords(c.text).filter((w) => !nameWords.has(w));
  const hyp = heard.filter((w) => !nameWords.has(w));
  const wer = wordErrorRate(ref, hyp);
  if (wer > LIMITS.wer) flags.push({ kind: 'words', detail: `word error rate ${wer.toFixed(2)}; heard "${c.transcript}"` });
  if (ref.length && (hyp[0] !== ref[0] || hyp[hyp.length - 1] !== ref[ref.length - 1])) flags.push({ kind: 'edges', detail: 'first or last word missing' });

  const s = c.stats;
  const voiced = s.duration - s.leadSilence;
  const words = normalizeWords(c.text).length;
  if (c.medianWps && voiced > 0) {
    const wps = words / voiced;
    if (Math.abs(wps / c.medianWps - 1) > LIMITS.pace) flags.push({ kind: 'pace', detail: `${wps.toFixed(2)} words/s against a median of ${c.medianWps.toFixed(2)}` });
  }
  const perChar = s.duration / Math.max(1, c.text.length);
  if (perChar < LIMITS.secPerChar[0] || perChar > LIMITS.secPerChar[1]) flags.push({ kind: 'length', detail: `${s.duration.toFixed(1)} s for ${c.text.length} characters` });
  if (s.peakDb >= LIMITS.clipDb) flags.push({ kind: 'clipping', detail: `peak ${s.peakDb.toFixed(1)} dBFS` });
  if (s.longestInnerSilence > LIMITS.silence) flags.push({ kind: 'silence', detail: `${s.longestInnerSilence.toFixed(1)} s of silence inside` });
  if (s.rmsDb < LIMITS.quietDb) flags.push({ kind: 'quiet', detail: `${s.rmsDb.toFixed(1)} dBFS average` });
  return flags;
}
