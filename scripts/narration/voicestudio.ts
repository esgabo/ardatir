// The Voice Studio (VoiceStudio, OmniVoice engine; docs/LOCAL.md): synthesize a
// passage by cloning a narrator's reference, transcribe a take, and check the shared GPU.
// URL and key come from VOICESTUDIO_URL (required) and VOICESTUDIO_API_KEY; the key is
// never logged. The GPU check reads OLLAMA_URL, and is skipped when it isn't set.

import type { Lang, NarratorVoice } from '../../src/data/types.ts';

export interface SynthRequest { text: string; lang: Lang; voice: NarratorVoice; referenceWav: Buffer; seed: number }
export interface Transcript { text: string }
export interface VoiceStudio {
  /** WAV bytes (PCM s16le, mono). */
  synthesize(r: SynthRequest): Promise<Buffer>;
  transcribe(wav: Buffer, lang: Lang): Promise<Transcript>;
  /** Server version, from GET /health. */
  version(): Promise<string>;
}

export function voiceStudio(opts: { url?: string; key?: string; fetch?: typeof fetch; timeoutMs?: number } = {}): VoiceStudio {
  const url = opts.url ?? process.env.VOICESTUDIO_URL;
  if (!url) throw new Error('VOICESTUDIO_URL is not set: export the Voice Studio\'s address, e.g. http://<host>:<port> (docs/LOCAL.md)');
  const base = url.replace(/\/$/, '');
  const key = opts.key ?? process.env.VOICESTUDIO_API_KEY;
  const f = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 300_000; // a cold first call took 110 s in the smoke test

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (key) headers.set('Authorization', `Bearer ${key}`);
    const res = await f(`${base}${path}`, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      let body = (await res.text().catch(() => '')).slice(0, 200);
      if (key) body = body.split(key).join('***');
      throw new Error(`Voice Studio ${path}: HTTP ${res.status} ${body}`.trim());
    }
    return res;
  }

  return {
    async synthesize(r) {
      const b = new FormData();
      b.set('text', r.text);
      b.set('language', r.lang);
      b.set('engine', r.voice.engine);
      b.set('ref_audio', new Blob([r.referenceWav], { type: 'audio/wav' }), 'reference.wav');
      b.set('ref_text', r.voice.refText);
      b.set('seed', String(r.seed));
      b.set('speed', String(r.voice.speed));
      b.set('pronounce', 'false'); // respellings are already in the text (pronounce.ts)
      for (const [k, v] of Object.entries(r.voice.params ?? {})) b.set(k, String(v));
      const res = await call('/generate', { method: 'POST', body: b });
      return Buffer.from(await res.arrayBuffer());
    },
    async transcribe(wav, lang) {
      const b = new FormData();
      b.set('file', new Blob([wav], { type: 'audio/wav' }), 'take.wav');
      b.set('language', lang);
      const res = await call('/v1/audio/transcriptions', { method: 'POST', body: b });
      const j = (await res.json()) as { text?: string };
      return { text: (j.text ?? '').trim() };
    },
    async version() {
      const j = (await (await call('/health')).json()) as { version?: string };
      return String(j.version ?? 'unknown');
    },
  };
}

/**
 * Is the Voice Studio's GPU free? When an Ollama shares it (OLLAMA_URL set), running both
 * at once is untested. A stopped Ollama doesn't answer, which counts as idle; with no
 * OLLAMA_URL there is nothing to check.
 */
export async function gpuIdle(fetchImpl: typeof fetch = fetch, ollamaUrl = process.env.OLLAMA_URL): Promise<boolean> {
  if (!ollamaUrl) return true;
  try {
    const res = await fetchImpl(`${ollamaUrl.replace(/\/$/, '')}/api/ps`, { signal: AbortSignal.timeout(5000) });
    const j = (await res.json()) as { models?: unknown[] };
    return !j.models?.length;
  } catch {
    return true;
  }
}
