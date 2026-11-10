// The Voice Studio client, against a fake fetch: no network (scripts/narration/voicestudio.ts).

import { describe, expect, it } from 'vitest';
import { gpuIdle, voiceStudio } from '../scripts/narration/voicestudio.ts';
import type { NarratorVoice } from '../src/data/types.ts';

const voice: NarratorVoice = {
  engine: 'omnivoice', engineVersion: '0.5.6', instruct: 'male, elderly, low pitch', seed: 101, speed: 0.9,
  params: { num_step: 32 }, reference: 'x.flac', referenceHash: 'sha256:00', refText: 'The reference words.', version: 1,
};

interface Call { url: string; init: RequestInit }
function fakeFetch(respond: (c: Call) => Response = () => new Response(Buffer.from('RIFF'), { status: 200 })) {
  const calls: Call[] = [];
  const f = (async (url: string | URL, init: RequestInit = {}) => { const c = { url: String(url), init }; calls.push(c); return respond(c); }) as typeof fetch;
  return { f, calls };
}
const form = (c: Call) => c.init.body as FormData;
const header = (c: Call, h: string) => new Headers(c.init.headers).get(h);

describe('voiceStudio.synthesize', () => {
  const req = { text: 'Let it be.', lang: 'en' as const, voice, referenceWav: Buffer.from('wav'), seed: 1101 };

  it('posts the cloning request to /generate', async () => {
    const { f, calls } = fakeFetch();
    const out = await voiceStudio({ url: 'http://vs:3900', fetch: f }).synthesize(req);
    expect(out.toString()).toBe('RIFF');
    expect(calls[0].url).toBe('http://vs:3900/generate');
    expect(calls[0].init.method).toBe('POST');
    const b = form(calls[0]);
    expect(b.get('text')).toBe('Let it be.');
    expect(b.get('language')).toBe('en');
    expect(b.get('ref_text')).toBe('The reference words.');
    expect(b.get('ref_audio')).toBeInstanceOf(Blob);
    expect(b.get('seed')).toBe('1101');
    expect(b.get('speed')).toBe('0.9');
    expect(b.get('pronounce')).toBe('false');
    expect(b.get('engine')).toBe('omnivoice');
    expect(b.get('num_step')).toBe('32');
    expect(b.get('instruct')).toBeNull(); // the voice comes from the reference, not from design
  });

  it('sends the bearer key only when there is one', async () => {
    const a = fakeFetch(), b = fakeFetch();
    await voiceStudio({ url: 'http://vs', key: 'k3y', fetch: a.f }).synthesize(req);
    await voiceStudio({ url: 'http://vs', fetch: b.f }).synthesize(req);
    expect(header(a.calls[0], 'authorization')).toBe('Bearer k3y');
    expect(header(b.calls[0], 'authorization')).toBeNull();
  });

  it('throws with the status and the start of the body, never the key', async () => {
    const { f } = fakeFetch(() => new Response('engine exploded: k3y '.repeat(30), { status: 500 }));
    const err = await voiceStudio({ url: 'http://vs', key: 'k3y', fetch: f }).synthesize(req).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/500/);
    expect((err as Error).message).toMatch(/engine exploded/);
    expect((err as Error).message).not.toContain('k3y');
    expect((err as Error).message.length).toBeLessThan(300);
  });
});

describe('voiceStudio.transcribe and version', () => {
  it('posts the file to /v1/audio/transcriptions and returns the text', async () => {
    const { f, calls } = fakeFetch(() => Response.json({ text: ' Let it be. ' }));
    const t = await voiceStudio({ url: 'http://vs', fetch: f }).transcribe(Buffer.from('wav'), 'en');
    expect(t.text).toBe('Let it be.');
    expect(calls[0].url).toBe('http://vs/v1/audio/transcriptions');
    expect(form(calls[0]).get('language')).toBe('en');
    expect(form(calls[0]).get('file')).toBeInstanceOf(Blob);
  });

  it('reads the server version from /health', async () => {
    const { f } = fakeFetch(() => Response.json({ status: 'ok', version: '0.5.6' }));
    expect(await voiceStudio({ url: 'http://vs', fetch: f }).version()).toBe('0.5.6');
  });
});

describe('gpuIdle', () => {
  it('is idle with no models loaded', async () => {
    expect(await gpuIdle(fakeFetch(() => Response.json({ models: [] })).f)).toBe(true);
  });
  it('is busy with a model loaded', async () => {
    expect(await gpuIdle(fakeFetch(() => Response.json({ models: [{ name: 'llama' }] })).f)).toBe(false);
  });
  it('is idle when Ollama does not answer (stopped)', async () => {
    expect(await gpuIdle((async () => { throw new Error('ECONNREFUSED'); }) as typeof fetch)).toBe(true);
  });
});
