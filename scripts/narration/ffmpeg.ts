// ffmpeg for the narration CLIs: decoding a narrator's FLAC reference, and encoding a
// finished recording to mp3. Found as $FFMPEG or on PATH; the pure modules never need it.

import { execFileSync, spawnSync } from 'node:child_process';

export function ffmpeg(): string {
  const bin = process.env.FFMPEG || 'ffmpeg';
  const ok = spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;
  if (!ok) throw new Error('ffmpeg not found: install it (sudo apt install ffmpeg) or set FFMPEG to its path');
  return bin;
}

/** Any audio file → mono 16-bit WAV bytes, at its own sample rate unless `rate` is given. */
export function decodeToWav(file: string, rate?: number): Buffer {
  const ar = rate ? ['-ar', String(rate)] : [];
  return execFileSync(ffmpeg(), ['-v', 'error', '-i', file, '-ac', '1', ...ar, '-sample_fmt', 's16', '-f', 'wav', '-'], { maxBuffer: 1 << 28 });
}

/** Seconds of audio in a file, by ffprobe next to ffmpeg. */
export function probeDuration(file: string): number {
  const probe = ffmpeg().replace(/ffmpeg(\.exe)?$/, 'ffprobe$1');
  return Number(execFileSync(probe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString().trim());
}
