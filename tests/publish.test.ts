// narration:publish: cached, checked takes → audio/<lang>.mp3 + audio/<lang>.yaml with exact
// passage starts (scripts/narration/publish.ts). Takes come from render with a fake studio.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { buildContent } from '../scripts/content/build.ts';
import { publish, type Encoder } from '../scripts/narration/publish.ts';
import { jobs, render } from '../scripts/narration/render.ts';
import type { VoiceStudio } from '../scripts/narration/voicestudio.ts';
import { encodeWav } from '../scripts/narration/wav.ts';

const FIXTURE = path.join(import.meta.dirname, 'fixtures/valid/content');
const PARTY = 'events/third-age/2941-04-26-the-party';
const VOICE = 'narrators/the-voice.yaml';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ardatir-publish-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const RATE = 24000;
const secondsFor = (text: string) => Math.round(text.length * 0.07 * RATE) / RATE;
const DOOR = 'Someone knocks at the green door.', TEA = 'Tea is poured for far too many guests.';

/** Says the text as a tone 0.07 s per character; `garble` makes it drop the last word. */
function studio(garble: (text: string) => boolean = () => false): VoiceStudio {
  let heard = '';
  return {
    async synthesize(r) {
      heard = garble(r.text) ? r.text.split(' ').slice(0, -1).join(' ') : r.text;
      return encodeWav({ sampleRate: RATE, samples: Int16Array.from({ length: Math.round(r.text.length * 0.07 * RATE) }, (_, i) => Math.round(Math.sin(i / 10) * 12000)) });
    },
    async transcribe() { return { text: heard }; },
    async version() { return '0.5.6'; },
  };
}
const copyEncoder: Encoder = async (wav, out) => { fs.writeFileSync(out, wav); };

let n = 0;
async function rendered(opts: { garble?: (t: string) => boolean; edit?: (content: string) => void } = {}) {
  const dir = path.join(tmp, `case-${n++}`);
  const content = path.join(dir, 'content'), cacheDir = path.join(dir, 'cache');
  fs.cpSync(FIXTURE, content, { recursive: true });
  opts.edit?.(content);
  await render(buildContent(content), studio(opts.garble), () => Buffer.from('ref'), { lang: ['en'], changed: false, cacheDir, rejects: new Set() });
  return { content, cacheDir };
}
const pub = (content: string, cacheDir: string, accept: string[] = [], rejects: string[] = []) =>
  publish(buildContent(content), { lang: ['en'], accept: new Set(accept), rejects: new Set(rejects), cacheDir }, copyEncoder);
const renderAgain = (content: string, cacheDir: string, rejects: string[] = []) =>
  render(buildContent(content), studio(), () => Buffer.from('ref'), { lang: ['en'], changed: false, cacheDir, rejects: new Set(rejects) });
const changedJobs = (content: string) => jobs(buildContent(content), { lang: ['en'], changed: true }).map((j) => j.event);
const meta = (content: string) => YAML.parse(fs.readFileSync(path.join(content, PARTY, 'audio/en.yaml'), 'utf8'));

describe('publish', () => {
  it('writes timings that land each passage', async () => {
    const { content, cacheDir } = await rendered();
    const [r] = await pub(content, cacheDir);
    expect(r).toMatchObject({ event: 'the-party', lang: 'en', written: true, blockedBy: [] });
    const m = meta(content);
    const door = 0.8, tea = door + secondsFor(DOOR) + 0.8;
    expect(m.starts.door).toBeCloseTo(door, 3);
    expect(m.starts.tea).toBeCloseTo(tea, 3);
    expect(m.duration).toBeCloseTo(tea + secondsFor(TEA), 3);
    expect(m.narrator).toEqual({ id: 'the-voice', version: 1 });
    expect(Object.keys(m.passages)).toEqual(['door', 'tea']);
    expect(fs.existsSync(path.join(content, PARTY, 'audio/en.mp3'))).toBe(true);
  });

  it('leaves no recording behind when encoding fails (a lone mp3 fails the build)', async () => {
    const { content, cacheDir } = await rendered();
    const failing: Encoder = async (wav, out) => { fs.writeFileSync(out, wav); throw new Error('encoded 69.888 s, expected 69.830 s'); };
    await expect(publish(buildContent(content), { lang: ['en'], accept: new Set(), cacheDir }, failing)).rejects.toThrow(/encoded/);
    expect(fs.readdirSync(path.join(content, PARTY)).includes('audio') ? fs.readdirSync(path.join(content, PARTY, 'audio')) : []).toEqual([]);
    expect(buildContent(content).errors).toEqual([]);
  });

  it('the content build accepts what publish wrote', async () => {
    const { content, cacheDir } = await rendered();
    await pub(content, cacheDir);
    const b = buildContent(content);
    expect(b.errors).toEqual([]);
    expect(b.warnings).toEqual([]);
    expect(b.details.find((d) => d.id === 'the-party')!.audioFiles.en?.starts).toHaveLength(2);
  });

  it('is blocked by a flagged take until it is accepted', async () => {
    const { content, cacheDir } = await rendered({ garble: (t) => t.startsWith('Tea') });
    const [r] = await pub(content, cacheDir);
    expect(r).toMatchObject({ written: false, blockedBy: ['the-party/tea'] });
    expect(fs.existsSync(path.join(content, PARTY, 'audio'))).toBe(false);
    const [ok] = await pub(content, cacheDir, ['the-party/tea']);
    expect(ok.written).toBe(true);
  });

  it('is blocked by a missing take', async () => {
    const { content, cacheDir } = await rendered();
    const nf = path.join(content, PARTY, 'narration.yaml');
    fs.writeFileSync(nf, fs.readFileSync(nf, 'utf8').replace('far too many guests', 'a great many guests'));
    const [r] = await pub(content, cacheDir);
    expect(r).toMatchObject({ written: false, blockedBy: ['the-party/tea'] });
  });

  it('uses the narrator\'s gap', async () => {
    const { content, cacheDir } = await rendered({ edit: (c) => {
      const f = path.join(c, VOICE);
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('    version: 1', '    gap: 1.2\n    version: 1'));
    } });
    await pub(content, cacheDir);
    expect(meta(content).starts.door).toBeCloseTo(1.2, 3);
  });

  it('leaves a current recording alone', async () => {
    const { content, cacheDir } = await rendered();
    await pub(content, cacheDir);
    const [again] = await pub(content, cacheDir);
    expect(again).toMatchObject({ written: false, blockedBy: [], upToDate: true });
  });

  it('a respelling changed after publishing makes the recording stale, and publishes again', async () => {
    const { content, cacheDir } = await rendered();
    await pub(content, cacheDir);
    expect(changedJobs(content)).toEqual([]);
    fs.writeFileSync(path.join(content, 'pronunciation.yaml'), 'en: { green: "GREEN-ish" }\n');
    expect(changedJobs(content)).toEqual(['the-party']);
    await renderAgain(content, cacheDir);
    const [r] = await pub(content, cacheDir);
    expect(r.written).toBe(true);
    expect(changedJobs(content)).toEqual([]);
  });

  it('a take rejected after publishing publishes again once re-rendered', async () => {
    const { content, cacheDir } = await rendered();
    await pub(content, cacheDir);
    await renderAgain(content, cacheDir, ['the-party/tea']);
    const [r] = await pub(content, cacheDir);
    expect(r.written).toBe(true);
    expect(meta(content).takes.tea).toMatch(/@1007$/);
  });

  it('holds an event with a reject not yet re-rendered', async () => {
    const { content, cacheDir } = await rendered();
    const [r] = await pub(content, cacheDir, [], ['the-party/tea']);
    expect(r).toMatchObject({ written: false, blockedBy: ['the-party/tea'] });
  });
});
