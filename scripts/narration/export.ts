// npm run narration:export: write every narration script, per language, for the Voice Studio.
//
//   out/narration/<event>/<lang>.txt        the words to read, one paragraph per passage, in order
//   out/narration/<event>/<lang>.json       { id, kind, lang, title, textHash, passages: [{ id, text }] }
//   out/narration/arc/<arc>/<lang>.{txt,json}   an arc that tells its own story (DESIGN §4.10)
//
// An arc's telling records through the same pipeline as an event's, so it is exported the same
// way, under the `arc/<id>` namespace its script already has in data/scripts/.
//
// Options (combine freely):
//   --only <id>      just this event or arc (repeatable; an arc also answers to arc/<id>)
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
import { narrationHash, passageText, scriptId, type Passage, type ScriptKind } from './text.ts';

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

/**
 * Everything with a narration.yaml, as the build read it: events in story order, then the arcs
 * that tell their own story in id order. The passages come from the build's own scripts, so the
 * words exported are exactly the words the site shows and the recording pipeline hashes.
 */
interface Script { id: string; kind: ScriptKind; dir: string; title?: LocalizedText; passages: Passage[] }
const passagesById = new Map(result.scripts.map((s) => [s.id, s.passages]));
const scripts: Script[] = [];
for (const e of result.index.events) {
  const passages = passagesById.get(e.id);
  if (passages?.length) scripts.push({ id: e.id, kind: 'event', dir: result.eventDirs[e.id], title: e.title, passages });
}
for (const a of result.index.arcs) {
  const passages = passagesById.get(scriptId('arc', a.id));
  const dir = result.arcDirs[a.id];
  if (passages?.length && dir) scripts.push({ id: a.id, kind: 'arc', dir, title: a.title, passages });
}

const only = args!.only;
const wanted = (s: Script) => !only || only.includes(s.id) || only.includes(scriptId(s.kind, s.id));
if (only) for (const id of only) if (!scripts.some((s) => s.id === id || scriptId(s.kind, s.id) === id)) fail(`no narration.yaml for event or arc "${id}"`);
const selected = scripts.filter(wanted);

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
  const id = scriptId(s.kind, s.id);
  for (const lang of langs) {
    const textHash = narrationHash(s.passages, lang);
    const state = recordingState(s, lang, textHash);
    const fallback = s.passages.filter((p) => !p.text[lang]).map((p) => p.id);
    const note = [state === 'none' ? 'not recorded' : `recording ${state}`, fallback.length ? `${fallback.length} passage(s) in English: ${fallback.join(', ')}` : '']
      .filter(Boolean).join('; ');
    if (args!.changed && state === 'current') { console.log(`  skip   ${id}/${lang} (recording current)`); continue; }

    const passages = s.passages.map((p) => ({ id: p.id, text: passageText(p, lang) }));
    const dir = path.join(outDir, ...id.split('/'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${lang}.txt`), passages.map((p) => p.text).join('\n\n') + '\n');
    const title = s.title ? s.title[lang] || s.title.en : s.id;
    fs.writeFileSync(path.join(dir, `${lang}.json`), JSON.stringify({ id, kind: s.kind, lang, title, textHash, passages, ...fallback.length ? { fallback } : {} }, null, 2) + '\n');
    console.log(`  wrote  ${path.relative(root, dir)}/${lang}.{txt,json}  ${passages.length} passages  ${textHash}  (${note})`);
    written++;
  }
}
console.log(`✓ ${written} script(s) exported to ${path.relative(root, outDir)}/`);
