// narration:render: every passage that needs it, one at a time, on the Voice Studio,
// cloning the age's narrator; each take checked, retried with a new seed if flagged, and
// cached so a failed run resumes and an edited passage re-renders alone. Nothing goes into
// content/ here; narration:publish does that. See the narration voices design, §5.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { BuildResult } from '../content/build.ts';
import type { Lang, Narrator, NarratorVoice } from '../../src/data/types.ts';
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
  /** Called with "event/passage" once a rejected take's replacement is written. */
  onReject?: (id: string) => void;
  log?: (line: string) => void;
}

export interface Take {
  event: string; lang: Lang; passage: string; narrator: string;
  /** The cached WAV. */
  file: string;
  seed: number; tries: number; flags: Flag[]; transcript: string; stats: AudioStats;
  /** The last seed tried, when it isn't `seed` (a better earlier take was kept): a reject goes on from it. */
  lastSeed?: number;
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

/**
 * What makes a take reusable: the words, the voice that reads them (its version, reference
 * and settings, so a replaced reference can't keep old takes), and how the names are said.
 */
export function cacheKey(passageHash: string, narratorId: string, voice: NarratorVoice, used: string[], lex: Lexicon, lang: Lang): string {
  const names = used.map((n) => [n, lex[lang]?.[n] ?? '']);
  const sound = [voice.version, voice.engine, voice.referenceHash, voice.refText, voice.speed, voice.params ?? {}];
  return createHash('sha256').update(JSON.stringify([passageHash, narratorId, sound, lang, names])).digest('hex').slice(0, 12);
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
      if (o.changed && recordingCurrent(job, content.pronunciation)) continue;
      out.push(job);
    }
  }
  return out;
}

/** audio/<lang>.yaml as publish writes it. `takes`: each passage's "<cacheKey>@<seed>". */
export interface RecordingMeta { textHash?: string; narrator?: { id?: string; version?: number }; passages?: Record<string, string>; takes?: Record<string, string> }

export function readRecording(j: Pick<Job, 'dir' | 'lang'>): RecordingMeta | undefined {
  const meta = path.join(j.dir, 'audio', `${j.lang}.yaml`);
  return fs.existsSync(meta) ? (YAML.parse(fs.readFileSync(meta, 'utf8')) as RecordingMeta | null) ?? undefined : undefined;
}

/**
 * Does the event folder already hold a recording of exactly this text, by this voice, with
 * the names said as listed now? (A respelling or voice change re-renders, so it's stale.)
 */
export function recordingCurrent(j: Job, lex: Lexicon): boolean {
  const m = readRecording(j);
  if (!m || m.textHash !== narrationHash(j.passages, j.lang)) return false;
  if (m.narrator?.id !== j.narrator.id || m.narrator?.version !== j.narrator.voices[j.lang]!.version) return false;
  return passageKeys(j, lex).every(({ passage: p, key }) =>
    m.passages?.[p.id] === passageHash(p, j.lang) && m.takes?.[p.id]?.split('@')[0] === key);
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
    return { passage: p, key: cacheKey(passageHash(p, j.lang), j.narrator.id, voice, used, lex, j.lang), text, used };
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

/** Every passed take of this narrator in this language already in the cache (for its median pace). */
function cachedPassed(cacheDir: string, narrator: string, lang: Lang): Take[] {
  if (!fs.existsSync(cacheDir)) return [];
  const out: Take[] = [];
  for (const f of fs.readdirSync(cacheDir, { recursive: true }) as string[]) {
    if (!f.endsWith('.json')) continue;
    const t = JSON.parse(fs.readFileSync(path.join(cacheDir, f), 'utf8')) as Take;
    if (t.narrator === narrator && t.lang === lang && !t.flags.length) out.push(t);
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
    // Pace is judged per language: a Spanish reading runs at its own speed.
    const paceKey = `${j.narrator.id}/${j.lang}`;
    if (!passedBy.has(paceKey)) passedBy.set(paceKey, cachedPassed(o.cacheDir, j.narrator.id, j.lang));
    const passed = passedBy.get(paceKey)!;
    let ref: Buffer | undefined;
    for (const { passage: p, key, text, used } of passageKeys(j, lex)) {
      const file = takePath(o.cacheDir, j, p.id, key);
      const cached = readTake(file);
      const rejected = o.rejects.has(`${j.event}/${p.id}`);
      if (cached && !rejected) { takes.push({ ...cached, reused: true }); continue; }

      const written = p.text[j.lang] || p.text.en;
      const names = used.map((name) => ({ name, said: lex[j.lang]![name] }));
      let k = cached ? Math.round(((cached.lastSeed ?? cached.seed) - voice.seed) / SEED_STEP) + 1 : 0;
      // Every try is kept until a clean one; if none is clean, the one with the fewest flags.
      let take: Take | undefined, wav: Buffer | undefined, lastSeed = 0;
      for (let tries = 1; tries <= RETRIES + 1; tries++, k++) {
        const seed = voice.seed + SEED_STEP * k;
        ref ??= referenceWav(j.narrator, j.lang);
        log(`  render  ${j.event}/${j.lang}/${p.id}  seed ${seed}`);
        const got = await vs.synthesize({ text, lang: j.lang, voice, referenceWav: ref, seed });
        const stats = audioStats(parseWav(got));
        const transcript = (await vs.transcribe(got, j.lang)).text;
        const medianWps = passed.length >= PACE_AFTER ? median(passed.map(wpsOf)) : undefined;
        const flags = checkPassage({ text: written, transcript, names, stats, medianWps });
        lastSeed = seed;
        if (!take || flags.length < take.flags.length) {
          take = { event: j.event, lang: j.lang, passage: p.id, narrator: j.narrator.id, file, seed, tries, flags, transcript, stats, words: normalizeWords(written).length };
          wav = got;
        }
        take.tries = tries;
        if (!flags.length) break;
        log(`    flagged: ${flags.map((f) => f.kind).join(', ')}`);
      }
      if (lastSeed !== take!.seed) take!.lastSeed = lastSeed;
      writeTake(take!, wav!);
      if (rejected) o.onReject?.(`${j.event}/${p.id}`);
      if (!take!.flags.length) passed.push(take!);
      takes.push({ ...take!, reused: false });
    }
  }
  return takes;
}
