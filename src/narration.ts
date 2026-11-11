import type { EventDetail, Lang } from './data/types';
import type { EventClock } from './eventClock';

/**
 * Plays an event's narration recording in the audio language (audioChoice.ts), if any.
 * The event clock is the master: the audio follows it on play, pause and seek,
 * so voice, text and animation stay together.
 */
export class Narration {
  private audio: HTMLAudioElement | null = null;
  private failed = false;
  muted = false;

  private readonly clock: EventClock;

  constructor(event: EventDetail, lang: Lang | null, clock: EventClock) {
    this.clock = clock;
    const rec = lang ? event.audioFiles[lang] : undefined;
    if (!rec) return;
    const a = new Audio(import.meta.env.BASE_URL + rec.src);
    a.preload = 'auto';
    a.addEventListener('error', () => { this.failed = true; });
    this.audio = a;
  }

  get available(): boolean {
    return !!this.audio && !this.failed;
  }

  /** Call every frame with the playhead in seconds. */
  sync(at: number, playing: boolean): void {
    const a = this.audio;
    if (!a || this.failed) return;
    if (!playing || this.muted || at >= this.clock.duration) {
      if (!a.paused) a.pause();
      return;
    }
    if (Math.abs(a.currentTime - at) > 0.25) a.currentTime = at;
    if (a.paused) a.play().catch(() => { /* autoplay blocked until a user gesture */ });
  }

  dispose(): void {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio = null;
  }
}
