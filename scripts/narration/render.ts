// narration:render: every passage that needs it, one at a time, on the Voice Studio,
// cloning the age's narrator; each take checked, retried with a new seed if flagged, and
// cached so a failed run resumes and an edited passage re-renders alone. Nothing goes into
// content/ here; narration:publish does that. See the narration voices design, §5.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { BuildResult } from '../content/build.ts';
import type { Lang, Narrator } from '../../src/data/types.ts';
import { checkPassage, normalizeWords, type Flag } from './checks.ts';
import { respell, type Lexicon } from './pronounce.ts';
import { narrationHash, passageHash, type Passage } from './text.ts';
import type { VoiceStudio } from './voicestudio.ts';
import { audioStats, parseWav, type AudioStats } from './wav.ts';

export interface RenderOptions {
  only?: string[];
  age?: string[];
  lang: Lang[];
  /** Only events whose recording is missing or stale. */
  changed: boolean;
  cacheDir: string;
  /** "event/passage" takes the author rejected: re-render with the next seed. */
  rejects: Set<string>;
  log?: (line: string) => void;
}

export interface Take {
  event: string; lang: Lang; passage: string; narrator: string;
  /** The cached WAV. */
  file: string;
  seed: number; tries: number; flags: Flag[]; transcript: string; stats: AudioStats;
  /** Words in the passage as written (for pace). */
  words: number;
  /** True when this run reused the cached take (not stored). */
  reused?: boolean;
}

/** Retries after a flagged take, each with a new seed. */
export const RETRIES = 3;
const SEED_STEP = 1000;
/** Takes a narrator needs before pace is judged against its median. */
const PACE_AFTER = 5;

/** What makes a take reusable: the words, who reads them, and how the names are said. */
export function cacheKey(passageHash: string, narrator: { id: string; version: number }, used: string[], lex: Lexicon, lang: Lang): string {
  const names = used.map((n) => [n, lex[lang]?.[n] ?? '']);
  return createHash('sha256').update(JSON.stringify([passageHash, narrator.id, narrator.version, lang, names])).digest('hex').slice(0, 12);
}

export interface Job { event: string; lang: Lang; narrator: Narrator; passages: Passage[]; dir: string }

/** Staged events whose age has a narrator with a voice in that language, in story order. */
export function jobs(content: BuildResult, o: Pick<RenderOptions, 'only' | 'age' | 'lang' | 'changed'>): Job[] {
  const ages = new Map(content.index.ages.map((a) => [a.id, a]));
  const narrators = new Map(content.narrators.map((n) => [n.id, n]));
  const scripts = new Map(content.scripts.map((s) => [s.id, s.passages]));
  const out: Job[] = [];
  for (const e of content.index.events) {
    if (e.status !== 'staged' && e.status !== 'animated') continue;
    if (o.only && !o.only.includes(e.id)) continue;
    if (o.age && !o.age.includes(e.age)) continue;
    const narrator = narrators.get(ages.get(e.age)?.narrator ?? '');
    const passages = scripts.get(e.id);
    if (!narrator || !passages) continue;
    for (const lang of o.lang) {
      if (!narrator.voices[lang]) continue;
      const job = { event: e.id, lang, narrator, passages, dir: content.eventDirs[e.id] };
      if (o.changed && recordingCurrent(job)) continue;
      out.push(job);
    }
  }
  return out;
}

/** Does the event folder already hold a recording of exactly this text, by this voice? */
export function recordingCurrent(j: Job): boolean {
  const meta = path.join(j.dir, 'audio', `${j.lang}.yaml`);
  if (!fs.existsSync(meta)) return false;
  const m = YAML.parse(fs.readFileSync(meta, 'utf8')) as { textHash?: string; narrator?: { id?: string; version?: number }; passages?: Record<string, string> } | null;
  return !!m && m.textHash === narrationHash(j.passages, j.lang)
    && m.narrator?.id === j.narrator.id && m.narrator?.version === j.narrator.voices[j.lang]!.version
    && j.passages.every((p) => m.passages?.[p.id] === passageHash(p, j.lang));
}

/** Where a passage's take lives in the cache. */
export function takePath(cacheDir: string, j: Pick<Job, 'event' | 'lang'>, passage: string, key: string): string {
  return path.join(cacheDir, j.event, j.lang, `${passage}.${key}.wav`);
}

/** The cache key of every passage of a job, as render and publish both compute it. */
export function passageKeys(j: Job, lex: Lexicon): { passage: Passage; key: string; text: string; used: string[] }[] {
  const voice = j.narrator.voices[j.lang]!;
  return j.passages.map((p) => {
    const raw = p.text[j.lang] || p.text.en;
    const { text, used } = respell(raw.replace(/\s+/g, ' ').trim(), j.lang, lex);
    return { passage: p, key: cacheKey(passageHash(p, j.lang), { id: j.narrator.id, version: voice.version }, used, lex, j.lang), text, used };
  });
}

export function readTake(wavFile: string): Take | undefined {
  const meta = wavFile.replace(/\.wav$/, '.json');
  if (!fs.existsSync(meta) || !fs.existsSync(wavFile)) return undefined;
  return { ...(JSON.parse(fs.readFileSync(meta, 'utf8')) as Omit<Take, 'file'>), file: wavFile };
}

function writeTake(t: Take, wav: Buffer): void {
  fs.mkdirSync(path.dirname(t.file), { recursive: true });
  fs.writeFileSync(t.file, wav);
  const { file: _file, reused: _reused, ...meta } = t;
  fs.writeFileSync(t.file.replace(/\.wav$/, '.json'), JSON.stringify(meta, null, 2) + '\n');
}

const wpsOf = (t: Take) => t.words / Math.max(0.1, t.stats.duration - t.stats.leadSilence);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : undefined; };

/** Every passed take of this narrator already in the cache (for its median pace). */
function cachedPassed(cacheDir: string, narrator: string): Take[] {
  if (!fs.existsSync(cacheDir)) return [];
  const out: Take[] = [];
  for (const f of fs.readdirSync(cacheDir, { recursive: true }) as string[]) {
    if (!f.endsWith('.json')) continue;
    const t = JSON.parse(fs.readFileSync(path.join(cacheDir, f), 'utf8')) as Take;
    if (t.narrator === narrator && !t.flags.length) out.push(t);
  }
  return out;
}

export async function render(
  content: BuildResult, vs: VoiceStudio,
  referenceWav: (n: Narrator, lang: Lang) => Buffer, o: RenderOptions,
): Promise<Take[]> {
  const log = o.log ?? (() => {});
  const lex = content.pronunciation;
  const takes: Take[] = [];
  const passedBy = new Map<string, Take[]>();
  for (const j of jobs(content, o)) {
    const voice = j.narrator.voices[j.lang]!;
    if (!passedBy.has(j.narrator.id)) passedBy.set(j.narrator.id, cachedPassed(o.cacheDir, j.narrator.id));
    const passed = passedBy.get(j.narrator.id)!;
    let ref: Buffer | undefined;
    for (const { passage: p, key, text, used } of passageKeys(j, lex)) {
      const file = takePath(o.cacheDir, j, p.id, key);
      const cached = readTake(file);
      const rejected = o.rejects.has(`${j.event}/${p.id}`);
      if (cached && !rejected) { takes.push({ ...cached, reused: true }); continue; }

      const written = p.text[j.lang] || p.text.en;
      const names = used.map((name) => ({ name, said: lex[j.lang]![name] }));
      let k = cached ? Math.round((cached.seed - voice.seed) / SEED_STEP) + 1 : 0;
      let take: Take | undefined, wav: Buffer | undefined;
      for (let tries = 1; tries <= RETRIES + 1; tries++, k++) {
        const seed = voice.seed + SEED_STEP * k;
        ref ??= referenceWav(j.narrator, j.lang);
        log(`  render  ${j.event}/${j.lang}/${p.id}  seed ${seed}`);
        wav = await vs.synthesize({ text, lang: j.lang, voice, referenceWav: ref, seed });
        const stats = audioStats(parseWav(wav));
        const transcript = (await vs.transcribe(wav, j.lang)).text;
        const medianWps = passed.length >= PACE_AFTER ? median(passed.map(wpsOf)) : undefined;
        const flags = checkPassage({ text: written, transcript, names, stats, medianWps });
        take = { event: j.event, lang: j.lang, passage: p.id, narrator: j.narrator.id, file, seed, tries, flags, transcript, stats, words: normalizeWords(written).length };
        if (!flags.length) break;
        log(`    flagged: ${flags.map((f) => f.kind).join(', ')}`);
      }
      writeTake(take!, wav!);
      if (!take!.flags.length) passed.push(take!);
      takes.push({ ...take!, reused: false });
    }
  }
  return takes;
}
