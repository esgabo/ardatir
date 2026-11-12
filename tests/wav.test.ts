// WAV parsing, joining with gaps, and audio statistics (scripts/narration/wav.ts).

import { describe, expect, it } from 'vitest';
import { audioStats, encodeWav, joinWithGaps, parseWav, wavSeconds, type Pcm } from '../scripts/narration/wav.ts';

const RATE = 24000;
const tone = (seconds: number, amp = 0.5): Int16Array =>
  Int16Array.from({ length: Math.round(seconds * RATE) }, (_, i) => Math.round(Math.sin((2 * Math.PI * 220 * i) / RATE) * amp * 32767));
const zeros = (seconds: number) => new Int16Array(Math.round(seconds * RATE));
const cat = (...parts: Int16Array[]) => { const out = new Int16Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const pcm = (samples: Int16Array): Pcm => ({ sampleRate: RATE, samples });

describe('wav', () => {
  it('round-trips through encode and parse', () => {
    const x = pcm(tone(0.1));
    const y = parseWav(encodeWav(x));
    expect(y.sampleRate).toBe(RATE);
    expect(Array.from(y.samples)).toEqual(Array.from(x.samples));
  });

  it('measures seconds at the file\'s own rate (VoxCPM2 speaks at 48 kHz)', () => {
    expect(wavSeconds(encodeWav({ sampleRate: 48000, samples: new Int16Array(72000) }))).toBe(1.5);
    expect(wavSeconds(encodeWav(pcm(zeros(2))))).toBe(2);
  });

  it('finds the data chunk after other chunks', () => {
    const wav = encodeWav(pcm(tone(0.01)));
    // Insert a LIST chunk between fmt and data, as some encoders do.
    const list = Buffer.concat([Buffer.from('LIST'), Buffer.from([4, 0, 0, 0]), Buffer.from('INFO')]);
    const withList = Buffer.concat([wav.subarray(0, 36), list, wav.subarray(36)]);
    withList.writeUInt32LE(withList.length - 8, 4);
    expect(parseWav(withList).samples.length).toBe(240);
  });

  it('rejects stereo', () => {
    const wav = encodeWav(pcm(tone(0.01)));
    wav.writeUInt16LE(2, 22);
    expect(() => parseWav(wav)).toThrow(/mono/);
  });

  it('joins clips with a lead-in gap and a gap between, none after', () => {
    const j = joinWithGaps([pcm(tone(1)), pcm(tone(2))], 0.8);
    expect(j.starts).toEqual([0.8, 2.6]);
    expect(j.duration).toBeCloseTo(4.6, 6); // 0.8 lead + 1 + 0.8 + 2
    expect(j.pcm.samples.length).toBe(Math.round(4.6 * RATE));
  });

  it('measures peak loudness', () => {
    const square = Int16Array.from({ length: RATE / 10 }, (_, i) => (i % 2 ? 32767 : -32767));
    expect(audioStats(pcm(square)).peakDb).toBeCloseTo(0, 1);
    expect(audioStats(pcm(tone(0.5, 0.5))).peakDb).toBeCloseTo(-6.02, 1);
  });

  it('measures the longest silence inside, ignoring lead and tail', () => {
    const s = audioStats(pcm(cat(zeros(1), tone(0.5), zeros(2), tone(0.5), zeros(3))));
    expect(s.longestInnerSilence).toBeCloseTo(2, 1);
    expect(s.leadSilence).toBeCloseTo(1, 1);
    expect(s.duration).toBeCloseTo(7, 6);
  });
});
