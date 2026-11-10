// npm run narration:render -- [--only <event>] [--age <age>] [--lang en] [--changed]
//
// Renders every passage that needs it on the Voice Studio (VOICESTUDIO_URL,
// VOICESTUDIO_API_KEY; docs/LOCAL.md), checks each take, and writes a listening page to
// out/narration/report.html. Takes are cached in out/narration-cache/, so a failed run
// resumes where it stopped. Reject a take by adding `event/passage` to
// out/narration/rejects.txt and running again. Publish with npm run narration:publish.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import YAML from 'yaml';
import { buildContent } from '../content/build.ts';
import { LANGS, type Lang, type Narrator } from '../../src/data/types.ts';
import { decodeToWav, ffmpeg } from './ffmpeg.ts';
import { render } from './render.ts';
import { writeReport } from './report.ts';
import { gpuIdle, voiceStudio } from './voicestudio.ts';

const root = path.resolve(import.meta.dirname, '../..');
const contentDir = path.join(root, 'content');
const outDir = path.join(root, 'out', 'narration');
const cacheDir = path.join(root, 'out', 'narration-cache');
const fail = (msg: string): never => { console.error(`narration:render: ${msg}`); process.exit(1); };

let args;
try {
  args = parseArgs({
    options: {
      only: { type: 'string', multiple: true }, age: { type: 'string', multiple: true },
      lang: { type: 'string', multiple: true }, changed: { type: 'boolean', default: false },
    },
  }).values;
} catch (e) { fail((e as Error).message); }
const langs = (args!.lang ?? [...LANGS]) as Lang[];
for (const l of langs) if (!(LANGS as readonly string[]).includes(l)) fail(`unknown language "${l}"`);

const content = buildContent(contentDir);
if (content.errors.length) { for (const e of content.errors) console.error(`  ERROR  ${e}`); fail('content has errors; run npm run content'); }
try { ffmpeg(); } catch (e) { fail((e as Error).message); }
if (!(await gpuIdle())) fail('Ollama has models loaded on the shared GPU; try later (homelab #347)');

const vs = voiceStudio();
const version = await vs.version().catch((e: Error) => fail(`Voice Studio not reachable: ${e.message} (is LXC 116 started? docs/LOCAL.md)`));
for (const n of content.narrators) for (const [lang, v] of Object.entries(n.voices)) {
  if (v.engineVersion !== version) console.warn(`  warning  ${n.id}/${lang} was made on VoiceStudio ${v.engineVersion}; the box runs ${version}. Listen closely.`);
}

// A reject stays in rejects.txt until its replacement take is written, then moves to the log:
// each re-renders once, and one outside this run's --only/--lang/--changed waits for its run.
const rejectsFile = path.join(outDir, 'rejects.txt');
const readRejects = () => (fs.existsSync(rejectsFile) ? fs.readFileSync(rejectsFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : []);
const rejects = new Set(readRejects());
const onReject = (id: string) => {
  fs.writeFileSync(rejectsFile, readRejects().filter((l) => l !== id).map((l) => `${l}\n`).join(''));
  fs.appendFileSync(path.join(outDir, 'rejects.log'), `${new Date().toISOString()} ${id}\n`);
};

const refs = new Map<string, Buffer>();
const reference = (n: Narrator, lang: Lang) => {
  const k = `${n.id}.${lang}`;
  if (!refs.has(k)) refs.set(k, decodeToWav(path.join(contentDir, 'narrators', n.voices[lang]!.reference)));
  return refs.get(k)!;
};

const takes = await render(content, vs, reference, {
  only: args!.only, age: args!.age, lang: langs, changed: args!.changed, cacheDir, rejects, onReject, log: (l) => console.log(l),
});

// A narrator still earning trust gets a bigger sample: fewer than 3 published events.
const published = (narrator: string) => content.index.events.filter((e) => {
  const f = path.join(content.eventDirs[e.id], 'audio');
  return fs.existsSync(f) && fs.readdirSync(f).some((x) => x.endsWith('.yaml')
    && (YAML.parse(fs.readFileSync(path.join(f, x), 'utf8')) as { narrator?: { id?: string } } | null)?.narrator?.id === narrator);
}).length;
const report = path.join(outDir, 'report.html');
writeReport(takes, report, (id) => (published(id) < 3 ? 10 : 5));
const flagged = takes.filter((t) => t.flags.length).length;
console.log(`✓ ${takes.length} passage(s), ${takes.filter((t) => !t.reused).length} rendered, ${flagged} flagged. Listen: ${path.relative(root, report)}`);
