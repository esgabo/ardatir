import type { Keyframe, LocalizedText, Track } from './data/types';

export interface Pose {
  x: number;
  z: number;
  /** Heading in radians, facing the direction of travel. */
  heading: number;
  action: NonNullable<Keyframe['action']>;
  /** Latest thought at or before this moment. */
  thought?: LocalizedText;
  moving: boolean;
}

/** Half the diorama tile (size 14) plus a margin: a figure beyond this is offstage and not drawn. */
export const TILE_LIMIT = 7.2;

export function onTile(pose: { x: number; z: number }): boolean {
  return Math.abs(pose.x) <= TILE_LIMIT && Math.abs(pose.z) <= TILE_LIMIT;
}

/** Sample a character's track at normalised time t (0 → 1). Pure, so the scrubber can jump anywhere. */
export function samplePose(track: Track, t: number): Pose {
  const ks = track.keyframes;
  if (ks.length === 0) return { x: 0, z: 0, heading: 0, action: 'idle', moving: false };

  let i = 0;
  while (i < ks.length - 1 && ks[i + 1].t <= t) i++;
  const a = ks[i];
  const b = ks[Math.min(i + 1, ks.length - 1)];

  const span = b.t - a.t;
  const u = span > 0 ? Math.min(Math.max((t - a.t) / span, 0), 1) : 0;
  const x = a.x + (b.x - a.x) * u;
  const z = a.z + (b.z - a.z) * u;
  const dx = b.x - a.x, dz = b.z - a.z;
  const moving = span > 0 && u < 1 && Math.hypot(dx, dz) > 1e-3;

  let thought: LocalizedText | undefined;
  for (let k = 0; k <= i; k++) if (ks[k].thought) thought = ks[k].thought;

  return {
    x, z,
    heading: Math.atan2(dx, dz),
    action: moving ? (a.action === 'hide' && b.action === 'hide' ? 'hide' : b.action === 'run' ? 'run' : 'walk') : (a.action ?? 'idle'),
    thought,
    moving,
  };
}

// ---- Motion between poses (docs/MODELS.md, "Playback"): all pure functions of t ----

type Action = Pose['action'];

/** Seconds of event time a figure takes to blend from one action into the next. */
export const FADE_SECONDS = 0.25;
/** Seconds of event time a figure takes to turn toward a new direction of travel. */
export const TURN_SECONDS = 0.35;

const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/** The keyframe a moment falls after (the segment it is in), as `samplePose` finds it. */
function segmentAt(track: Track, t: number): number {
  const ks = track.keyframes;
  let i = 0;
  while (i < ks.length - 1 && ks[i + 1].t <= t) i++;
  return i;
}

/** Does the segment from keyframe k to k + 1 move the figure? */
function moves(track: Track, k: number): boolean {
  const a = track.keyframes[k], b = track.keyframes[k + 1];
  return !!b && b.t > a.t && Math.hypot(b.x - a.x, b.z - a.z) > 1e-3;
}

export interface ActionMix {
  /** The action at t (as `samplePose` says). */
  action: Action;
  /** The action before it, still fading out, when t is just past a change. */
  previous?: Action;
  /** Weight of `action` (0 → 1); `previous` has `1 - w`. */
  w: number;
}

/**
 * Which action a figure is in at t, blended with the one before it for `fade` seconds after a
 * change. Found from the keyframes alone, so scrubbing back into a change shows the same blend.
 */
export function actionMix(track: Track, t: number, eventSeconds: number, fade = FADE_SECONDS): ActionMix {
  const action = samplePose(track, t).action;
  const ks = track.keyframes;
  if (ks.length < 2 || !(fade > 0) || !(eventSeconds > 0)) return { action, w: 1 };
  const start = ks[segmentAt(track, t)].t;
  if (start <= 0 || t < start) return { action, w: 1 };
  const previous = samplePose(track, start - 1e-9).action;
  const u = ((t - start) * eventSeconds) / fade;
  if (previous === action || u >= 1) return { action, w: 1 };
  return { action, previous, w: smooth(u) };
}

/** The signed shortest turn from angle a to angle b, in (-π, π]. */
function turnBetween(a: number, b: number): number {
  const d = (((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  return d === -Math.PI ? Math.PI : d;
}

/**
 * Which way a figure faces at t: along its latest move, turning smoothly (the short way round,
 * over `turn` seconds) each time it sets off in a new direction, and keeping that heading while
 * it stands. Facing +Z (0) until it first moves. A function of t alone, unlike remembering the
 * last frame's heading, so a deep link or a scrub back faces the same way.
 */
export function headingAt(track: Track, t: number, eventSeconds: number, turn = TURN_SECONDS): number {
  const ks = track.keyframes;
  let from = 0, to = 0, since = -Infinity;
  const at = (time: number) => {
    const u = turn > 0 && eventSeconds > 0 ? ((time - since) * eventSeconds) / turn : 1;
    return from + turnBetween(from, to) * smooth(u);
  };
  for (let k = 0; k < ks.length - 1 && ks[k].t <= t; k++) {
    if (!moves(track, k)) continue;
    const a = ks[k], b = ks[k + 1];
    const h = Math.atan2(b.x - a.x, b.z - a.z);
    if (Math.abs(turnBetween(to, h)) < 1e-6) continue; // same direction: no new turn
    from = at(a.t);
    to = h;
    since = a.t;
  }
  return at(t);
}

/**
 * How far a walk or run cycle has got at t, in seconds of the clip at its own pace: time spent
 * standing counts as it is, time on the move counts faster or slower as the figure covers ground
 * faster or slower than `pace(action)` (units per second for that gait), so feet keep up with
 * the ground. The rate is kept within `limits`, so a dash across the tile in a moment doesn't
 * turn the legs into a blur. Sums over the keyframes before t: pure, and continuous at every keyframe.
 */
export function strideSeconds(
  track: Track, t: number, eventSeconds: number, pace: (action: Action) => number, limits: [number, number] = [0.5, 2.5],
): number {
  const ks = track.keyframes;
  if (!ks.length) return t * eventSeconds;
  let s = Math.min(t, ks[0].t) * eventSeconds;
  for (let k = 0; k < ks.length - 1 && ks[k].t < t; k++) {
    const a = ks[k], b = ks[k + 1];
    const secs = (Math.min(t, b.t) - a.t) * eventSeconds;
    if (!moves(track, k)) { s += secs; continue; }
    const action = samplePose(track, (a.t + b.t) / 2).action;
    const speed = Math.hypot(b.x - a.x, b.z - a.z) / ((b.t - a.t) * eventSeconds);
    const p = pace(action);
    const rate = p > 0 ? Math.min(Math.max(speed / p, limits[0]), limits[1]) : 1;
    s += secs * rate;
  }
  if (t > ks[ks.length - 1].t) s += (t - ks[ks.length - 1].t) * eventSeconds;
  return s;
}
