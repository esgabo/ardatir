// Which animation clip a character model plays for a pose, and where in that clip it is at t.
// Pure, so it is tested and stays exact under scrubbing (docs/MODELS.md, "Clips").

import type { Keyframe } from '../data/types';

export type Action = NonNullable<Keyframe['action']>;

/** What to play when a model has no clip for an action, in order of preference. */
const FALLBACK: Record<Action, Action[]> = {
  idle: [],
  walk: ['idle'],
  run: ['walk', 'idle'],
  talk: ['idle'],
  hide: ['idle'],
  fight: ['idle'],
};

/** The clip a model plays for `action`: its own, a fallback, or none (the placeholder's motion stays). */
export function clipFor(action: Action, clips: ReadonlySet<string>): Action | undefined {
  return [action, ...FALLBACK[action]].find((c) => clips.has(c));
}

/**
 * Where in a looping clip a figure is at event time t: a function of t alone (the event's
 * seconds, `t * eventSeconds`, wrapped to the clip), never of how long the page has been
 * running. So a deep link or a scrub lands on the same frame every time.
 */
export function clipTime(t: number, eventSeconds: number, clipDuration: number): number {
  return wrapClip(t * eventSeconds, clipDuration);
}

/**
 * The pace each gait's clip is made for, in figure heights per second (a person of 1.75 m walks
 * about 1.4 m/s and runs about 3.5 m/s). A figure moving faster than this plays its cycle faster,
 * so its feet keep up with the ground (`strideSeconds` in timeline.ts).
 */
export const GAIT_PACE: Partial<Record<Action, number>> = { walk: 0.8, run: 2.0 };

/** One clip to blend in: an action, how far into its own cycle (seconds, before wrapping), its weight. */
export interface ClipLayer {
  action: Action;
  seconds: number;
  w: number;
}

const GAITS: ReadonlySet<Action> = new Set(['walk', 'run']);

/**
 * What a model plays at t: the action's clip, cross-faded from the previous one just after a
 * change (`actionMix`); walk and run cycles advance with the ground covered (`strideSeconds`),
 * everything else with the event's seconds. `height` is the figure's height in diorama units.
 * The heaviest layer comes first. Pure: the same t always gives the same layers.
 */
export function clipLayers(
  mix: { action: Action; previous?: Action; w: number }, eventSeconds: number, t: number, strides: number,
): ClipLayer[] {
  const seconds = (a: Action) => (GAITS.has(a) ? strides : t * eventSeconds);
  const layers: ClipLayer[] = [{ action: mix.action, seconds: seconds(mix.action), w: mix.w }];
  if (mix.previous && mix.w < 1) layers.push({ action: mix.previous, seconds: seconds(mix.previous), w: 1 - mix.w });
  return layers.sort((a, b) => b.w - a.w);
}

/** Where in a looping clip of `duration` seconds a cycle `seconds` in falls. */
export function wrapClip(seconds: number, duration: number): number {
  if (!(duration > 0)) return 0;
  return ((seconds % duration) + duration) % duration;
}
