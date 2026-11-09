import type { EventDetail, Lang, NarrationSegment } from './data/types';

interface Knot { t: number; s: number }

export interface SegmentState {
  index: number;
  segment: NarrationSegment;
  /** 0 → 1 through this segment's reading time. */
  progress: number;
}

/**
 * One clock for animation, narration text and audio.
 *
 * The animation is authored in normalised time `t` (0 → 1) and each narration
 * segment says at which `t` it begins. The audio for a language says at which
 * second each segment begins in that recording. Matching the two gives a
 * piecewise-linear map between `t` and seconds, so a slower Spanish reading
 * simply slows the animation between those points, and every beat still lands
 * on its sentence.
 *
 * The playhead is kept in seconds (what you hear); the animation time `t` is
 * derived from it. Seeking converts the other way.
 */
export class EventClock {
  readonly duration: number;
  private readonly knots: Knot[];
  private readonly segments: NarrationSegment[];
  /** Start second of each segment in this language. */
  private readonly segStarts: number[];

  constructor(event: EventDetail, lang: Lang) {
    this.segments = event.narration ?? [];
    const audio = event.audioFiles[lang];
    this.duration = audio?.duration ?? event.durationSeconds;

    const knots: Knot[] = [{ t: 0, s: 0 }];
    const starts = audio?.starts;
    const timed = !!starts && starts.length === this.segments.length;
    if (timed) {
      this.segments.forEach((seg, i) => knots.push({ t: seg.t, s: starts![i] }));
    } else {
      if (starts) console.warn(`[ardatir] ${event.id}/${lang}: audio.starts has ${starts.length} entries, narration has ${this.segments.length}; timing falls back to linear.`);
      // No per-segment timing: stretch the authored timeline to the audio length.
    }
    knots.push({ t: 1, s: this.duration });
    // Keep the map monotonic even if data is slightly off.
    for (let i = 1; i < knots.length; i++) {
      knots[i].t = Math.max(knots[i].t, knots[i - 1].t);
      knots[i].s = Math.max(knots[i].s, knots[i - 1].s);
    }
    this.knots = knots;
    this.segStarts = timed ? [...starts!] : this.segments.map((seg) => this.secondsAt(seg.t));
  }

  /** Seconds into the event (and its audio) at time t. Used when seeking. */
  secondsAt(t: number): number {
    const k = this.knots;
    for (let i = 1; i < k.length; i++) {
      if (t <= k[i].t) {
        const a = k[i - 1], b = k[i];
        if (b.t === a.t) return a.s;
        return a.s + ((t - a.t) / (b.t - a.t)) * (b.s - a.s);
      }
    }
    return this.duration;
  }

  /** Event time t at a number of seconds. */
  tAt(seconds: number): number {
    const k = this.knots;
    for (let i = 1; i < k.length; i++) {
      if (seconds <= k[i].s) {
        const a = k[i - 1], b = k[i];
        if (b.s === a.s) return b.t;
        return a.t + ((seconds - a.s) / (b.s - a.s)) * (b.t - a.t);
      }
    }
    return 1;
  }

  /** The narration segment being read at a playhead position, if any. */
  segmentAt(seconds: number): SegmentState | null {
    let index = -1;
    for (let i = 0; i < this.segments.length; i++) if (this.segStarts[i] <= seconds) index = i;
    if (index < 0) return null;
    const start = this.segStarts[index];
    const end = this.segStarts[index + 1] ?? this.duration;
    const progress = end > start ? Math.min(Math.max((seconds - start) / (end - start), 0), 1) : 1;
    return { index, segment: this.segments[index], progress };
  }
}
