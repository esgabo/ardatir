// The one-shots: a sound that happens at a moment rather than going on all the time (DESIGN §9.5).
// Two sources, and both are already written down.
//
// Footsteps come from the staging itself: a figure's feet are on the same clock as its legs
// (`strideSeconds` in timeline.ts), so a step lands when the walk cycle puts a foot down, at the
// pace the figure is actually covering ground, and a heavier figure lands harder. Nothing is
// authored and every event with people walking in it has footsteps.
//
// Everything else is the author's: a knock at a round door, crockery on a table, a sword, wings.
// Those belong to a beat, not to a position, so `sound` in staging.yaml places them at a `t`,
// like the camera and the covers (DESIGN §9.3, §9.4) — the same reason, too. A knock derived from
// a figure standing near a door would be a sound that happens because of where somebody is
// standing, and whether the door is knocked on is a thing the story says, not the blocking.
//
// Pure: given the same pair of moments it returns the same cues, so a scrub cannot double a
// footstep and a deep link cannot miss one. It only reports; sound/engine.ts makes the noise.

import type { CueKind, Keyframe, SoundKey, Track } from '../data/types';
import { onTile, samplePose, strideSeconds } from '../timeline';

/** A cue to play now. `seed` lets the engine vary one from the next without a random number. */
export interface Cue {
  kind: CueKind;
  gain: number;
  seed: number;
}

/**
 * A walk cycle is two steps, and comes out about this long whatever the figure's size: the rigs
 * build it from a stride proportional to the leg and a pace proportional to the height, so the
 * two cancel (`gait_seconds` in scripts/models/blender/hobbit_rig.py). Short-legged bodies land
 * a little off these, which nobody can hear.
 */
export const WALK_CYCLE = 0.8;
export const RUN_CYCLE = 0.57;

/**
 * Longer than this between two calls and we are not playing, we are seeking: a scrub across the
 * whole event would otherwise fire every footstep in it at once.
 */
export const MAX_SPAN = 0.4;

/** At most this many footsteps in one call, however many figures are walking. */
const MAX_STEPS = 10;

/** A figure that can make a noise: its track, and its height in diorama units. */
export interface Walker {
  track: Track;
  /** The same height the models use to set the gait's pace (dioramaStage.ts). */
  height: number;
}

/**
 * How fast a gait is made to be walked, in diorama units a second, for a figure of that height
 * (`GAIT_PACE` in scene/modelClips.ts, times the height). Passed in rather than imported so this
 * file stays free of anything the content build cannot load.
 */
export type Pace = (action: NonNullable<Keyframe['action']>, height: number) => number;

/** How loud a figure's foot is: bigger figures land harder, and a run harder than a walk. */
export function stepGain(height: number, running: boolean): number {
  const h = Math.min(1.6, Math.max(0.5, height));
  return (0.3 + 0.4 * h) * (running ? 1.35 : 1);
}

/**
 * The footsteps that fall between two moments of the animation.
 *
 * A figure makes a step every half cycle of its gait clip; `strideSeconds` says how far into that
 * clip it is, counting the ground covered, so the rate follows the speed the staging asks for.
 * Figures standing still, hiding or offstage make none.
 */
export function footsteps(
  walkers: readonly Walker[], from: number, to: number, eventSeconds: number, pace: Pace,
): Cue[] {
  const out: Cue[] = [];
  if (!(to > from) || (to - from) * eventSeconds > MAX_SPAN) return out;
  walkers.forEach(({ track, height }, i) => {
    const pose = samplePose(track, to);
    if (!pose.moving || pose.action === 'hide' || !onTile(pose)) return;
    const running = pose.action === 'run';
    const half = (running ? RUN_CYCLE : WALK_CYCLE) / 2;
    const strides = (t: number) => strideSeconds(track, t, eventSeconds, (a) => pace(a, height));
    const a = strides(from) / half;
    const b = strides(to) / half;
    const gain = stepGain(height, running);
    for (let n = Math.floor(a) + 1; n <= Math.floor(b) && out.length < MAX_STEPS; n++) {
      out.push({ kind: 'step', gain, seed: i * 7 + n });
    }
  });
  return out;
}

/** The authored cues whose moment falls between two moments, in the order they were written. */
export function authored(keys: readonly SoundKey[] | undefined, from: number, to: number): Cue[] {
  if (!keys?.length || !(to > from)) return [];
  const out: Cue[] = [];
  keys.forEach((k, i) => {
    if (k.t > from && k.t <= to) out.push({ kind: k.cue, gain: k.gain ?? 1, seed: i });
  });
  return out;
}

/** Everything to play between two moments: the authored beats first, then the feet. */
export function cuesBetween(
  keys: readonly SoundKey[] | undefined, walkers: readonly Walker[],
  from: number, to: number, eventSeconds: number, pace: Pace,
): Cue[] {
  return [...authored(keys, from, to), ...footsteps(walkers, from, to, eventSeconds, pace)];
}
