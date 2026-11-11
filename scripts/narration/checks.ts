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

/** A name squashed to its sound: letters only, doubled letters once, no "h" after a vowel. */
const sound = (words: string[]) => words.join('').replace(/(\p{L})\1+/gu, '$1').replace(/([aeiouy])h/g, '$1');

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Where a name was heard: the run of 1–3 heard words that sounds like it (speech
 * recognition spells names by ear: "Ay-yah" comes back "Aya", "Ilúvatar" "Illovatar").
 * Returns the indexes of those words, or undefined if none is close enough.
 */
export const NAME_SLACK = 0.2;
function findName(heard: string[], forms: string[][]): number[] | undefined {
  for (const form of forms) {
    const target = sound(form);
    if (!target) continue;
    for (let i = 0; i < heard.length; i++) for (let n = 1; n <= 3 && i + n <= heard.length; n++) {
      const got = sound(heard.slice(i, i + n));
      if (editDistance(got, target) <= NAME_SLACK * Math.max(got.length, target.length)) return Array.from({ length: n }, (_, k) => i + k);
    }
  }
  return undefined;
}

export function checkPassage(c: CheckInput): Flag[] {
  const flags: Flag[] = [];
  const heard = normalizeWords(c.transcript);

  // Names first: each must sound like it was said as written or as its respelling.
  const nameWords = new Set<string>(), heardAsName = new Set<number>();
  for (const n of c.names) {
    const asWritten = normalizeWords(n.name), asSaid = normalizeWords(n.said);
    for (const w of [...asWritten, ...asSaid]) nameWords.add(w);
    const at = findName(heard, [asWritten, asSaid]);
    if (at) for (const i of at) heardAsName.add(i);
    else flags.push({ kind: 'name', detail: `"${n.name}" not heard` });
  }

  // Words, with the names set aside on both sides (they are judged above).
  const ref = normalizeWords(c.text).filter((w) => !nameWords.has(w));
  const hyp = heard.filter((w, i) => !heardAsName.has(i) && !nameWords.has(w));
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
