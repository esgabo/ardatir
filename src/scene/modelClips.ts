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
  if (!(clipDuration > 0)) return 0;
  const s = t * eventSeconds;
  return ((s % clipDuration) + clipDuration) % clipDuration;
}
