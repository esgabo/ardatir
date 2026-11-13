// WAV in and out (PCM s16le, mono: what the Voice Studio returns), joining passages with
// gaps into one recording, and the statistics the passage checks use. Pure; no ffmpeg.

export interface Pcm { sampleRate: number; samples: Int16Array }

/** Parse a mono 16-bit PCM WAV, walking its chunks (not assuming a 44-byte header). */
export function parseWav(buf: Buffer): Pcm {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let sampleRate = 0;
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === 'fmt ') {
      const format = buf.readUInt16LE(body), channels = buf.readUInt16LE(body + 2), bits = buf.readUInt16LE(body + 14);
      if (channels !== 1) throw new Error(`expected mono, got ${channels} channels`);
      if (format !== 1 || bits !== 16) throw new Error(`expected 16-bit PCM, got format ${format}, ${bits} bits`);
      sampleRate = buf.readUInt32LE(body + 4);
    } else if (id === 'data') {
      if (!sampleRate) throw new Error('data chunk before fmt chunk');
      const end = Math.min(body + size, buf.length);
      const samples = new Int16Array((end - body) >> 1);
      for (let i = 0; i < samples.length; i++) samples[i] = buf.readInt16LE(body + i * 2);
      return { sampleRate, samples };
    }
    off = body + size + (size & 1);
  }
  throw new Error('no data chunk');
}

export function encodeWav(pcm: Pcm): Buffer {
  const data = pcm.samples.length * 2;
  const b = Buffer.alloc(44 + data);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + data, 4); b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii'); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(pcm.sampleRate, 24); b.writeUInt32LE(pcm.sampleRate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(data, 40);
  for (let i = 0; i < pcm.samples.length; i++) b.writeInt16LE(pcm.samples[i], 44 + i * 2);
  return b;
}

/** Seconds of audio in WAV bytes, at the file's own sample rate. */
export function wavSeconds(wav: Buffer): number {
  const { samples, sampleRate } = parseWav(wav);
  return samples.length / sampleRate;
}

/**
 * One recording from its passages: a gap of lead-in, then each clip with a gap between,
 * none after the last. `starts[i]` is the second clip i begins (3 decimals).
 */
export function joinWithGaps(clips: Pcm[], gapSeconds: number): { pcm: Pcm; starts: number[]; duration: number } {
  const rate = clips[0]?.sampleRate ?? 24000;
  for (const c of clips) if (c.sampleRate !== rate) throw new Error(`clips differ in sample rate (${c.sampleRate} vs ${rate})`);
  const gap = Math.round(gapSeconds * rate);
  const total = clips.reduce((n, c) => n + gap + c.samples.length, 0);
  const samples = new Int16Array(total);
  const starts: number[] = [];
  let off = 0;
  for (const c of clips) {
    off += gap;
    starts.push(Math.round((off / rate) * 1000) / 1000);
    samples.set(c.samples, off);
    off += c.samples.length;
  }
  return { pcm: { sampleRate: rate, samples }, starts, duration: total / rate };
}

export interface AudioStats {
  duration: number;
  /** dBFS of the loudest sample (0 = full scale). */
  peakDb: number;
  /** dBFS of the RMS over the voiced part. */
  rmsDb: number;
  /** Longest silence between sound, in seconds; lead and tail silence don't count. */
  longestInnerSilence: number;
  leadSilence: number;
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

/** Silence is any 20 ms window whose RMS is below `silenceDb`. */
export function audioStats(pcm: Pcm, silenceDb = -45): AudioStats {
  const { samples, sampleRate } = pcm;
  const win = Math.max(1, Math.round(sampleRate * 0.02));
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const loud: boolean[] = [];
  let sumSq = 0, voiced = 0;
  for (let w = 0; w < samples.length; w += win) {
    let sq = 0;
    const end = Math.min(w + win, samples.length);
    for (let i = w; i < end; i++) { const v = samples[i] / 32767; sq += v * v; }
    const isLoud = db(Math.sqrt(sq / (end - w))) >= silenceDb;
    loud.push(isLoud);
    if (isLoud) { sumSq += sq; voiced += end - w; }
  }
  const first = loud.indexOf(true), last = loud.lastIndexOf(true);
  let longest = 0, run = 0;
  for (let i = first; first >= 0 && i <= last; i++) {
    if (loud[i]) run = 0;
    else longest = Math.max(longest, ++run);
  }
  return {
    duration: samples.length / sampleRate,
    peakDb: db(peak / 32767),
    rmsDb: voiced ? db(Math.sqrt(sumSq / voiced)) : -Infinity,
    longestInnerSilence: (longest * win) / sampleRate,
    leadSilence: first < 0 ? samples.length / sampleRate : (first * win) / sampleRate,
  };
}
