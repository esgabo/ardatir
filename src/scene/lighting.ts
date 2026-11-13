// The light of a diorama, from `t` (staging.yaml `light`): a few looks (dawn to night), blended
// between the keys. Pure, so a scrub or a deep link lands on exactly the same light.

import type { LightKey, LightPreset } from '../data/types';

/** Everything the stage sets from the light: one value per t. */
export interface Light {
  /** Sun (or moon) colour, intensity and direction it shines from. */
  sun: string;
  sunIntensity: number;
  sunFrom: [number, number, number];
  sky: string;
  ground: string;
  hemiIntensity: number;
  background: string;
  /** How lit the lamps, windows and fires are: 0 by day, 1 at night. */
  lamps: number;
  /** Fireflies, from 0 (none) to 1. */
  fireflies: number;
}

export const LIGHTS: Record<LightPreset, Light> = {
  dawn: { sun: '#ffb37a', sunIntensity: 1.3, sunFrom: [12, 5, 7], sky: '#ffd9c0', ground: '#4a3a50', hemiIntensity: 0.75, background: '#2a2433', lamps: 0.45, fireflies: 0 },
  morning: { sun: '#fff0d0', sunIntensity: 2.3, sunFrom: [10, 12, 8], sky: '#fff4e0', ground: '#3a3040', hemiIntensity: 1.1, background: '#1d2029', lamps: 0, fireflies: 0 },
  // The look every diorama had before it had a light: the default.
  day: { sun: '#fff0d0', sunIntensity: 2.2, sunFrom: [8, 14, 5], sky: '#fff4e0', ground: '#3a3040', hemiIntensity: 1.1, background: '#1b1e26', lamps: 0, fireflies: 0 },
  evening: { sun: '#ffc283', sunIntensity: 1.9, sunFrom: [-5, 7, 10], sky: '#ffd6a8', ground: '#3a2c3a', hemiIntensity: 0.8, background: '#231d26', lamps: 0.55, fireflies: 0.2 },
  dusk: { sun: '#ff9468', sunIntensity: 1.0, sunFrom: [-9, 3.5, 7], sky: '#9a90c8', ground: '#2e2638', hemiIntensity: 0.75, background: '#17151f', lamps: 1, fireflies: 1 },
  night: { sun: '#a8bcff', sunIntensity: 0.4, sunFrom: [-4, 12, -6], sky: '#5a6aa0', ground: '#141420', hemiIntensity: 0.38, background: '#0c0e16', lamps: 1, fireflies: 0.7 },
};

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: number[]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const lerpColour = (a: string, b: string, f: number) => toHex(hex(a).map((v, i) => lerp(v, hex(b)[i], f)));

/** Two lights mixed: `f` = 0 is `a`, 1 is `b`. */
export function mixLights(a: Light, b: Light, f: number): Light {
  return {
    sun: lerpColour(a.sun, b.sun, f),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, f),
    sunFrom: [0, 1, 2].map((i) => lerp(a.sunFrom[i], b.sunFrom[i], f)) as [number, number, number],
    sky: lerpColour(a.sky, b.sky, f),
    ground: lerpColour(a.ground, b.ground, f),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, f),
    background: lerpColour(a.background, b.background, f),
    lamps: lerp(a.lamps, b.lamps, f),
    fireflies: lerp(a.fireflies, b.fireflies, f),
  };
}

/**
 * The light at t: each key's look at its own t, eased between keys, held before the first and
 * after the last. Without keys, the default day.
 */
export function lightAt(keys: readonly LightKey[] | undefined, t: number): Light {
  if (!keys?.length) return LIGHTS.day;
  if (t <= keys[0].t) return LIGHTS[keys[0].preset];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t < b.t) {
      const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      return mixLights(LIGHTS[a.preset], LIGHTS[b.preset], u * u * (3 - 2 * u));
    }
  }
  return LIGHTS[keys[keys.length - 1].preset];
}
