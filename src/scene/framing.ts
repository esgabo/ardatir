// How a diorama is framed at `t` (staging.yaml `camera`): where the view looks and how much
// ground it holds, eased between the author's keys. Pure, like the light, so a scrub or a deep
// link lands on exactly the same shot.
//
// The camera itself is not moved here. The stage reports the framing and the app glides the
// view onto it, keeping whatever the visitor has panned or zoomed as an offset from it — the
// same trick "follow" uses, so an author's framing never fights a visitor's hand.

import type { CameraKey } from '../data/types';

/** Where the view looks, and the side of the square of ground it keeps in frame. */
export interface Framing {
  x: number;
  z: number;
  width: number;
}

/**
 * How wide and how tall a square of ground of side 1 draws on screen, in the camera's own units.
 *
 * The diorama camera is a true isometric: orthographic, on the (1, 1, 1) diagonal, up +Y. A
 * ground vector (dx, dz) lands at ((dx − dz)/√2, −(dx + dz)/√6), so a square of side w spans
 * w·√2 across and w·√(2/3) up the screen. Worth having exactly: guessing it either crops the
 * subject or leaves the shot loose, and both read as carelessness at this scale.
 */
export const GROUND_ACROSS = Math.SQRT2;
export const GROUND_UP = Math.sqrt(2 / 3);

/**
 * Room above the ground square for whatever stands on it, in the camera's own units.
 *
 * World +Y draws √(2/3) up the screen, so this is about two tile units of height: a wizard with
 * his hat, a doorway, the lip of a hill behind the subject. Without it a framing tight enough to
 * hold a room would cut the heads off everyone in it.
 */
export const HEADROOM = 2 * GROUND_UP;

/** The frustum the stage builds at zoom 1: half-height 9, half-width 9 × aspect (dioramaStage.resize). */
export const HALF_HEIGHT = 9;

/**
 * The camera zoom that holds a square of ground `width` across, on a viewport of this aspect.
 *
 * Fits both ways and takes the tighter, so the square is visible whatever the window's shape: a
 * phone held upright shows more ground than a wide monitor rather than cropping the scene.
 */
export function zoomFor(width: number, aspect: number): number {
  const w = Math.max(width, 0.5);
  const a = aspect > 0 ? aspect : 1;
  const across = (2 * HALF_HEIGHT * a) / (w * GROUND_ACROSS);
  const up = (2 * HALF_HEIGHT) / (w * GROUND_UP + HEADROOM);
  return Math.min(across, up);
}

const smooth = (u: number) => u * u * (3 - 2 * u);

const mix = (a: Framing, b: Framing, f: number): Framing => ({
  x: a.x + (b.x - a.x) * f,
  z: a.z + (b.z - a.z) * f,
  // Widths read as a ratio, not a difference: halving the frame should feel the same move
  // whether it starts at the whole tile or at one room, so this eases through their logarithms.
  width: a.width * (b.width / a.width) ** f,
});

/**
 * The framing at t: each key's shot at its own t, eased between keys, held before the first and
 * after the last. Without keys there is no staged framing and the view stays where it is.
 */
export function framingAt(keys: readonly CameraKey[] | undefined, t: number): Framing | undefined {
  if (!keys?.length) return undefined;
  const at = (k: CameraKey): Framing => ({ x: k.x, z: k.z, width: k.width });
  if (t <= keys[0].t) return at(keys[0]);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t < b.t) {
      const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      return mix(at(a), at(b), smooth(u));
    }
  }
  return at(keys[keys.length - 1]);
}
