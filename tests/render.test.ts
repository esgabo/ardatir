// narration:render against a fake Voice Studio: passage by passage, cached, checked,
// retried (scripts/narration/render.ts). The fixture's staged event is "the-party", in the
// Third Age, told by the fixture narrator "the-voice" (seed 7).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildContent } from '../scripts/content/build.ts';
import { cacheKey, render, type RenderOptions } from '../scripts/narration/render.ts';
import { writeReport } from '../scripts/narration/report.ts';
import type { SynthRequest, VoiceStudio } from '../scripts/narration/voicestudio.ts';
import { encodeWav } from '../scripts/narration/wav.ts';

const FIXTURE = path.join(import.meta.dirname, 'fixtures/valid/content');
const PARTY = 'events/third-age/2941-04-26-the-party';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ardatir-render-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

let n = 0;
/** A fresh copy of the fixture content and an empty cache. */
function setup(write: Record<string, string> = {}) {
  const dir = path.join(tmp, `case-${n++}`);
  const content = path.join(dir, 'content');
  fs.cpSync(FIXTURE, content, { recursive: true });
  fs.cpSync(path.join(FIXTURE, '../assets'), path.join(content, '../assets'), { recursive: true });
  for (const [f, s] of Object.entries(write)) fs.writeFileSync(path.join(content, f), s);
  return { content, cacheDir: path.join(dir, 'cache') };
}

/** A tone as long as a natural reading of the text: 0.07 s per character. */
const speech = (text: string) => {
  const len = Math.round(text.length * 0.07 * 24000);
  return encodeWav({ sampleRate: 24000, samples: Int16Array.from({ length: len }, (_, i) => Math.round(Math.sin(i / 10) * 12000)) });
};

/** Echoes what it was asked to say; `hear` can garble the transcript of a given call. */
function fakeStudio(opts: { hear?: (text: string, call: number) => string; fail?: (call: number) => boolean } = {}) {
  const sent: SynthRequest[] = [];
  let heard = '';
  const vs: VoiceStudio = {
    async synthesize(r) {
      const call = sent.length;
      sent.push(r);
      if (opts.fail?.(call)) throw new Error('Voice Studio /generate: HTTP 502');
      heard = opts.hear ? opts.hear(r.text, call) : r.text;
      return speech(r.text);
    },
    async transcribe() { return { text: heard }; },
    async version() { return '0.5.6'; },
  };
  return { vs, sent };
}

const opts = (cacheDir: string, over: Partial<RenderOptions> = {}): RenderOptions =>
  ({ lang: ['en'], changed: false, cacheDir, rejects: new Set(), ...over });
const ref = () => Buffer.from('reference');
const dropLast = (t: string) => t.split(' ').slice(0, -1).join(' ');

describe('cacheKey', () => {
  const voice = { engine: 'omnivoice', engineVersion: '0.5.6', instruct: 'x', seed: 7, speed: 0.9, reference: 'r.flac', referenceHash: 'sha256:aa', refText: 'Words.', version: 1 };
  it('changes with the text, the voice and the respellings used', () => {
    const k = cacheKey('sha256:aaaa', 'v', voice, [], {}, 'en');
    expect(k).toMatch(/^[0-9a-f]{12}$/);
    expect(cacheKey('sha256:bbbb', 'v', voice, [], {}, 'en')).not.toBe(k);
    expect(cacheKey('sha256:aaaa', 'v', { ...voice, version: 2 }, [], {}, 'en')).not.toBe(k);
    expect(cacheKey('sha256:aaaa', 'v', { ...voice, referenceHash: 'sha256:bb' }, [], {}, 'en')).not.toBe(k);
    expect(cacheKey('sha256:aaaa', 'v', { ...voice, speed: 1 }, [], {}, 'en')).not.toBe(k);
    const lex = { en: { Bilbo: 'BIL-bo' } };
    expect(cacheKey('sha256:aaaa', 'v', voice, ['Bilbo'], lex, 'en'))
      .not.toBe(cacheKey('sha256:aaaa', 'v', voice, ['Bilbo'], { en: { Bilbo: 'BILL-bo' } }, 'en'));
  });
});

describe('render', () => {
  it('renders every passage once', async () => {
    const { content, cacheDir } = setup();
    const { vs, sent } = fakeStudio();
    const takes = await render(buildContent(content), vs, ref, opts(cacheDir));
    expect(sent.map((r) => r.text)).toEqual(['Someone knocks at the green door.', 'Tea is poured for far too many guests.']);
    expect(sent.every((r) => r.seed === 7 && r.voice.refText.length > 0)).toBe(true);
    expect(takes.map((t) => [t.event, t.passage, t.flags.length, t.tries])).toEqual([['the-party', 'door', 0, 1], ['the-party', 'tea', 0, 1]]);
    expect(fs.existsSync(takes[0].file)).toBe(true);
  });

  it('respells before sending', async () => {
    const { content, cacheDir } = setup({ 'pronunciation.yaml': 'en: { green: "GREEN-ish" }\n' });
    const { vs, sent } = fakeStudio();
    await render(buildContent(content), vs, ref, opts(cacheDir));
    expect(sent[0].text).toBe('Someone knocks at the GREEN-ish door.');
  });

  it('reuses the cache, and re-renders only the changed passage', async () => {
    const { content, cacheDir } = setup();
    await render(buildContent(content), fakeStudio().vs, ref, opts(cacheDir));
    const again = fakeStudio();
    const takes = await render(buildContent(content), again.vs, ref, opts(cacheDir));
    expect(again.sent).toEqual([]);
    expect(takes.every((t) => t.reused)).toBe(true);

    const nf = path.join(content, PARTY, 'narration.yaml');
    fs.writeFileSync(nf, fs.readFileSync(nf, 'utf8').replace('far too many guests', 'a great many guests'));
    const third = fakeStudio();
    await render(buildContent(content), third.vs, ref, opts(cacheDir));
    expect(third.sent.map((r) => r.text)).toEqual(['Tea is poured for a great many guests.']);
  });

  it('retries a flagged take with a new seed', async () => {
    const { content, cacheDir } = setup();
    const { vs, sent } = fakeStudio({ hear: (t, call) => (call === 0 ? dropLast(t) : t) });
    const takes = await render(buildContent(content), vs, ref, opts(cacheDir));
    expect(sent.map((r) => r.seed)).toEqual([7, 1007, 7]);
    expect(takes[0]).toMatchObject({ passage: 'door', seed: 1007, tries: 2, flags: [] });
  });

  it('gives up after 3 retries and flags the take', async () => {
    const { content, cacheDir } = setup();
    const { vs, sent } = fakeStudio({ hear: (t, call) => (call < 4 ? dropLast(t) : t) });
    const takes = await render(buildContent(content), vs, ref, opts(cacheDir));
    expect(sent.slice(0, 4).map((r) => r.seed)).toEqual([7, 1007, 2007, 3007]);
    expect(takes[0].tries).toBe(4);
    expect(takes[0].flags.map((f) => f.kind)).toContain('edges');
  });

  it('keeps the best of the flagged takes, not the last, and a reject goes on from the last seed', async () => {
    const { content, cacheDir } = setup();
    // Call 1 misses one word in the middle (one flag); the others miss the ending (two).
    const hear = (t: string, call: number) => (call === 1 ? t.replace('green', 'grain') : call < 4 ? dropLast(t) : t);
    const takes = await render(buildContent(content), fakeStudio({ hear }).vs, ref, opts(cacheDir));
    expect(takes[0]).toMatchObject({ seed: 1007, tries: 4 });
    expect(takes[0].flags.map((f) => f.kind)).toEqual(['words']);
    const again = fakeStudio();
    await render(buildContent(content), again.vs, ref, opts(cacheDir, { rejects: new Set(['the-party/door']) }));
    expect(again.sent[0].seed).toBe(4007);
  });

  it('judges pace against the narrator\'s median in the same language only', async () => {
    const yaml = fs.readFileSync(path.join(FIXTURE, 'narrators/the-voice.yaml'), 'utf8');
    const es = yaml.slice(yaml.indexOf('  en:')).replace('  en:', '  es:');
    const { content, cacheDir } = setup({ 'narrators/the-voice.yaml': yaml + es });
    // Five passed English takes, far faster than any reading (100 words a second).
    for (let i = 0; i < 5; i++) {
      const dir = path.join(cacheDir, 'the-party', 'en'); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `p${i}.k.json`), JSON.stringify({ narrator: 'the-voice', lang: 'en', flags: [], words: 100, stats: { duration: 1, leadSilence: 0 } }));
    }
    const takes = await render(buildContent(content), fakeStudio().vs, ref, opts(cacheDir, { lang: ['es'] }));
    expect(takes.map((t) => [t.lang, t.flags.map((f) => f.kind)])).toEqual([['es', []], ['es', []]]);
  });

  it('renders one engine per run: loading a second one beside the first exhausts the box', async () => {
    const yaml = fs.readFileSync(path.join(FIXTURE, 'narrators/the-voice.yaml'), 'utf8');
    const es = yaml.slice(yaml.indexOf('  en:')).replace('  en:', '  es:').replace('engine: omnivoice', 'engine: voxcpm2');
    const { content, cacheDir } = setup({ 'narrators/the-voice.yaml': yaml + es });
    const both = fakeStudio();
    await expect(render(buildContent(content), both.vs, ref, opts(cacheDir, { lang: ['en', 'es'] }))).rejects.toThrow(/one engine per run.*omnivoice \(en\).*voxcpm2 \(es\)/);
    expect(both.sent).toEqual([]);
    // Once English is rendered, the same run only needs VoxCPM2.
    await render(buildContent(content), fakeStudio().vs, ref, opts(cacheDir, { lang: ['en'] }));
    const es2 = fakeStudio();
    await render(buildContent(content), es2.vs, ref, opts(cacheDir, { lang: ['en', 'es'] }));
    expect(es2.sent.map((r) => [r.lang, r.voice.engine])).toEqual([['es', 'voxcpm2'], ['es', 'voxcpm2']]);
  });

  it('resumes after a failed call', async () => {
    const { content, cacheDir } = setup();
    await expect(render(buildContent(content), fakeStudio({ fail: (c) => c === 1 }).vs, ref, opts(cacheDir))).rejects.toThrow(/502/);
    const again = fakeStudio();
    await render(buildContent(content), again.vs, ref, opts(cacheDir));
    expect(again.sent.map((r) => r.text)).toEqual(['Tea is poured for far too many guests.']);
  });

  it('re-renders a rejected take with the next seed', async () => {
    const { content, cacheDir } = setup();
    await render(buildContent(content), fakeStudio().vs, ref, opts(cacheDir));
    const again = fakeStudio();
    const takes = await render(buildContent(content), again.vs, ref, opts(cacheDir, { rejects: new Set(['the-party/tea']) }));
    expect(again.sent.map((r) => [r.text, r.seed])).toEqual([['Tea is poured for far too many guests.', 1007]]);
    expect(takes.find((t) => t.passage === 'tea')!.reused).toBe(false);
  });

  it('reports each reject it acted on, and only those', async () => {
    const { content, cacheDir } = await (async () => { const x = setup(); await render(buildContent(x.content), fakeStudio().vs, ref, opts(x.cacheDir)); return x; })();
    const done: string[] = [];
    await render(buildContent(content), fakeStudio().vs, ref, opts(cacheDir, { rejects: new Set(['the-party/tea', 'elsewhere/x']), onReject: (id) => done.push(id) }));
    expect(done).toEqual(['the-party/tea']);
  });

  it('skips ages without a narrator voice in that language', async () => {
    const { content, cacheDir } = setup();
    const { vs, sent } = fakeStudio();
    expect(await render(buildContent(content), vs, ref, opts(cacheDir, { lang: ['es'] }))).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('--changed skips an event whose recording is current', async () => {
    const { content, cacheDir } = setup();
    await render(buildContent(content), fakeStudio().vs, ref, opts(cacheDir));
    const { publish } = await import('../scripts/narration/publish.ts');
    await publish(buildContent(content), { lang: ['en'], accept: new Set(), cacheDir }, async (wav, out) => { fs.writeFileSync(out, wav); });
    const { vs, sent } = fakeStudio();
    expect(await render(buildContent(content), vs, ref, opts(cacheDir, { changed: true }))).toEqual([]);
    expect(sent).toEqual([]);
  });
});

describe('writeReport', () => {
  it('lists every flagged take first, the sample after, and a summary', async () => {
    const { content, cacheDir } = setup();
    const { vs } = fakeStudio({ hear: (t, call) => (call < 4 ? dropLast(t) : t) });
    const takes = await render(buildContent(content), vs, ref, opts(cacheDir));
    const out = path.join(cacheDir, 'report.html');
    writeReport(takes, out, () => 5);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).toContain('the-party/door');
    expect(html.indexOf('the-party/door')).toBeLessThan(html.indexOf('the-party/tea'));
    expect(html).toMatch(/1 flagged/);
    expect(html).toContain('rejects.txt');
  });
});
