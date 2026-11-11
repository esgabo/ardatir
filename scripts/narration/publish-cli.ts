// npm run narration:publish -- [--only <event>] [--age <age>] [--lang en] [--accept <event>/<passage>]
//
// Joins the checked takes narration:render cached into each event's audio/<lang>.mp3 and
// audio/<lang>.yaml. An event with a flagged take is held back until the author has
// listened and passes --accept for it. Then npm run content validates the result.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildContent } from '../content/build.ts';
import { LANGS, type Lang } from '../../src/data/types.ts';
import { ffmpeg, probeDuration } from './ffmpeg.ts';
import { publish, type Encoder } from './publish.ts';
import { parseWav } from './wav.ts';

const root = path.resolve(import.meta.dirname, '../..');
const fail = (msg: string): never => { console.error(`narration:publish: ${msg}`); process.exit(1); };

let args;
try {
  args = parseArgs({
    options: {
      only: { type: 'string', multiple: true }, age: { type: 'string', multiple: true },
      lang: { type: 'string', multiple: true }, accept: { type: 'string', multiple: true },
    },
  }).values;
} catch (e) { fail((e as Error).message); }
const langs = (args!.lang ?? [...LANGS]) as Lang[];
const content = buildContent(path.join(root, 'content'));
if (content.errors.length) { for (const e of content.errors) console.error(`  ERROR  ${e}`); fail('content has errors; run npm run content'); }
let bin = '';
try { bin = ffmpeg(); } catch (e) { fail((e as Error).message); }

/**
 * Mono 128 kbps mp3, every narrator normalised to the same loudness; the length must not change.
 * An mp3 runs a little long (at 24 kHz a frame is 24 ms, plus the encoder's delay and padding,
 * which players trim from the LAME header): 69.83 s came out 69.888 s. More than this is drift.
 */
const SLACK = 0.1;
const encode: Encoder = async (wav, out) => {
  execFileSync(bin, ['-v', 'error', '-y', '-f', 'wav', '-i', '-', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '24000', '-b:a', '128k', out], { input: wav });
  const want = parseWav(wav).samples.length / 24000, got = probeDuration(out);
  if (Math.abs(got - want) > SLACK) throw new Error(`${path.relative(root, out)}: encoded ${got.toFixed(3)} s, expected ${want.toFixed(3)} s; starts would drift`);
};

// Takes the author rejected and render hasn't replaced yet hold their event back.
const rejectsFile = path.join(root, 'out', 'narration', 'rejects.txt');
const rejects = new Set(fs.existsSync(rejectsFile) ? fs.readFileSync(rejectsFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : []);
const results = await publish(content, { only: args!.only, age: args!.age, lang: langs, accept: new Set(args!.accept ?? []), rejects, cacheDir: path.join(root, 'out', 'narration-cache') }, encode);
for (const r of results) {
  if (r.upToDate) console.log(`  current  ${r.event}/${r.lang}`);
  else if (r.written) console.log(`  wrote    ${r.event}/${r.lang}  ${r.duration.toFixed(1)} s, ${Object.keys(r.starts).length} passages`);
  else console.log(`  held     ${r.event}/${r.lang}: ${r.blockedBy.join(', ')} (render first; listen and --accept a flagged take; a rejected one waits for render)`);
}
const held = results.filter((r) => !r.written && !r.upToDate).length;
console.log(held ? `${held} recording(s) held back.` : `✓ ${results.filter((r) => r.written).length} recording(s) written; run npm run content`);
if (held) process.exitCode = 1;
