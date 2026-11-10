// narration:publish: join an event's checked takes into one recording with a fixed gap
// between passages, and write audio/<lang>.mp3 + audio/<lang>.yaml into its folder:
// duration, the exact second each passage starts, the text and narrator it was made from.
// See the narration voices design, §5.2.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { BuildResult } from '../content/build.ts';
import type { Lang } from '../../src/data/types.ts';
import { jobs, passageKeys, readTake, recordingCurrent, takePath } from './render.ts';
import { narrationHash, passageHash } from './text.ts';
import { encodeWav, joinWithGaps, parseWav } from './wav.ts';

/** WAV in, mp3 file out. The real one is ffmpeg with loudness normalisation (publish-cli.ts). */
export type Encoder = (wav: Buffer, outMp3: string) => Promise<void>;

export interface PublishResult {
  event: string; lang: Lang; duration: number; starts: Record<string, number>;
  written: boolean;
  /** "event/passage" with no current take, or a flagged take not accepted. */
  blockedBy: string[];
  /** The recording in the folder already matches; nothing was written. */
  upToDate?: boolean;
}

export const DEFAULT_GAP = 0.8;

export async function publish(
  content: BuildResult,
  o: { only?: string[]; age?: string[]; lang: Lang[]; accept: Set<string>; cacheDir: string },
  encode: Encoder,
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  for (const j of jobs(content, { ...o, changed: false })) {
    const base = { event: j.event, lang: j.lang, duration: 0, starts: {} };
    if (recordingCurrent(j) && fs.existsSync(path.join(j.dir, 'audio', `${j.lang}.mp3`))) {
      results.push({ ...base, written: false, blockedBy: [], upToDate: true });
      continue;
    }
    const keys = passageKeys(j, content.pronunciation);
    const takes = keys.map((k) => readTake(takePath(o.cacheDir, j, k.passage.id, k.key)));
    const blockedBy = keys
      .filter((k, i) => !takes[i] || (takes[i]!.flags.length && !o.accept.has(`${j.event}/${k.passage.id}`)))
      .map((k) => `${j.event}/${k.passage.id}`);
    if (blockedBy.length) { results.push({ ...base, written: false, blockedBy }); continue; }

    const voice = j.narrator.voices[j.lang]!;
    const joined = joinWithGaps(takes.map((t) => parseWav(fs.readFileSync(t!.file))), voice.gap ?? DEFAULT_GAP);
    const starts = Object.fromEntries(j.passages.map((p, i) => [p.id, joined.starts[i]]));
    const duration = Math.round(joined.duration * 1000) / 1000;
    const dir = path.join(j.dir, 'audio');
    fs.mkdirSync(dir, { recursive: true });
    await encode(encodeWav(joined.pcm), path.join(dir, `${j.lang}.mp3`));
    const meta = {
      duration, starts,
      textHash: narrationHash(j.passages, j.lang),
      narrator: { id: j.narrator.id, version: voice.version },
      passages: Object.fromEntries(j.passages.map((p) => [p.id, passageHash(p, j.lang)])),
    };
    fs.writeFileSync(path.join(dir, `${j.lang}.yaml`),
      `# Written by npm run narration:publish; don't edit by hand.\n${YAML.stringify(meta, { flowCollectionPadding: true })}`);
    results.push({ ...base, duration, starts, written: true, blockedBy: [] });
  }
  return results;
}
