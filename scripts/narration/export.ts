// npm run narration:export: write each event's narration script, per language, for the Voice Studio.
//
//   out/narration/<event>/<lang>.txt    the words to read, one paragraph per passage, in order
//   out/narration/<event>/<lang>.json   { event, lang, title, textHash, passages: [{ id, text }] }
//
// Options (combine freely):
//   --only <event>   just this event (repeatable)
//   --lang <lang>    just this language (repeatable; default: every language)
//   --changed        just what needs recording: no recording yet, a recording whose stored
//                    textHash no longer matches narration.yaml, or one with no textHash
//
// After recording, put the `textHash` from the .json into audio/<lang>.yaml next to
// `duration` and `starts`; the content build then warns when the text changes again.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import YAML from 'yaml';
import { buildContent } from '../content/build.ts';
import { LANGS, type Lang, type LocalizedText } from '../../src/data/types.ts';
import { narrationHash, passageText, type Passage } from './text.ts';

const root = path.resolve(import.meta.dirname, '../..');
const contentDir = path.join(root, 'content');
const outDir = path.join(root, 'out', 'narration');
const AUDIO_EXT = ['.mp3', '.ogg', '.m4a', '.wav'];

const fail = (msg: string): never => { console.error(`narration:export: ${msg}`); process.exit(1); };

let args;
try {
  args = parseArgs({
    options: {
      only: { type: 'string', multiple: true },
      lang: { type: 'string', multiple: true },
      changed: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  }).values;
} catch (e) { fail((e as Error).message); }
const langs = (args!.lang ?? [...LANGS]) as Lang[];
for (const l of langs) if (!(LANGS as readonly string[]).includes(l)) fail(`unknown language "${l}" (known: ${LANGS.join(', ')})`);

// Export only valid content: the build's errors are the same ones that would fail the site.
const result = buildContent(contentDir);
if (result.errors.length) {
  for (const e of result.errors) console.error(`  ERROR    ${e}`);
  fail(`content has ${result.errors.length} error(s); run npm run content`);
}
const titles = new Map(result.index.events.map((e) => [e.id, e.title]));

// Every event folder with a narration.yaml, in story order (age folder, then sort key).
interface Script { id: string; dir: string; title?: LocalizedText; passages: Passage[] }
const scripts: Script[] = [];
const ageOrder = new Map(result.index.ages.map((a) => [a.id, a.order]));
const eventsDir = path.join(contentDir, 'events');
const ageDirs = fs.readdirSync(eventsDir).sort((a, b) => (ageOrder.get(a) ?? 99) - (ageOrder.get(b) ?? 99) || a.localeCompare(b));
for (const age of ageDirs) {
  const ad = path.join(eventsDir, age);
  if (!fs.statSync(ad).isDirectory()) continue;
  for (const folder of fs.readdirSync(ad).sort()) {
    const dir = path.join(ad, folder);
    const nf = path.join(dir, 'narration.yaml');
    if (!fs.existsSync(nf)) continue;
    const ev = YAML.parse(fs.readFileSync(path.join(dir, 'event.yaml'), 'utf8')) as { id: string };
    const raw = YAML.parse(fs.readFileSync(nf, 'utf8')) as ({ id: string } & LocalizedText)[];
    const passages = raw.map(({ id, ...text }) => ({ id, text: text as LocalizedText }));
    scripts.push({ id: ev.id, dir, title: titles.get(ev.id), passages });
  }
}

const only = args!.only;
if (only) for (const id of only) if (!scripts.some((s) => s.id === id)) fail(`no narration.yaml for event "${id}"`);
const selected = only ? scripts.filter((s) => only.includes(s.id)) : scripts;

/** Where a language's recording of this script stands. */
function recordingState(s: Script, lang: Lang, hash: string): 'none' | 'current' | 'stale' | 'unhashed' {
  const ad = path.join(s.dir, 'audio');
  const meta = path.join(ad, `${lang}.yaml`);
  const hasFile = AUDIO_EXT.some((e) => fs.existsSync(path.join(ad, lang + e)));
  if (!hasFile || !fs.existsSync(meta)) return 'none';
  const m = YAML.parse(fs.readFileSync(meta, 'utf8')) as { textHash?: unknown } | null;
  if (typeof m?.textHash !== 'string') return 'unhashed';
  return m.textHash === hash ? 'current' : 'stale';
}

// A full export replaces out/narration; a filtered one only overwrites what it writes.
const full = !only && !args!.lang && !args!.changed;
if (full) fs.rmSync(outDir, { recursive: true, force: true });

let written = 0;
for (const s of selected) {
  for (const lang of langs) {
    const textHash = narrationHash(s.passages, lang);
    const state = recordingState(s, lang, textHash);
    const fallback = s.passages.filter((p) => !p.text[lang]).map((p) => p.id);
    const note = [state === 'none' ? 'not recorded' : `recording ${state}`, fallback.length ? `${fallback.length} passage(s) in English: ${fallback.join(', ')}` : '']
      .filter(Boolean).join('; ');
    if (args!.changed && state === 'current') { console.log(`  skip   ${s.id}/${lang} (recording current)`); continue; }

    const passages = s.passages.map((p) => ({ id: p.id, text: passageText(p, lang) }));
    const dir = path.join(outDir, s.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${lang}.txt`), passages.map((p) => p.text).join('\n\n') + '\n');
    const title = s.title ? s.title[lang] || s.title.en : s.id;
    fs.writeFileSync(path.join(dir, `${lang}.json`), JSON.stringify({ event: s.id, lang, title, textHash, passages, ...fallback.length ? { fallback } : {} }, null, 2) + '\n');
    console.log(`  wrote  ${path.relative(root, dir)}/${lang}.{txt,json}  ${passages.length} passages  ${textHash}  (${note})`);
    written++;
  }
}
console.log(`✓ ${written} script(s) exported to ${path.relative(root, outDir)}/`);
