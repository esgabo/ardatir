// How much render to ask for. One setting turns the shadow map, the haze, the pixel ratio and
// the counts of small moving things (smoke puffs, spray, fireflies) down together, so a phone
// gets a diorama that looks like the same object, only cheaper.
//
// Nothing here changes what happens in a scene: every one of these is a cost, never story state,
// so the same `t` lands on the same frame at every quality. Contact shadows stay on all the way
// down — they are a handful of flat discs, and with the shadow map gone they are the only thing
// left holding the figures on the ground.
//
// The haze is not here either, and on purpose. It is a term in the shaders three.js already
// compiles, not a pass of its own, so switching it off would buy a device nothing and cost it
// the depth of the scene. Every quality gets the same air.
//
// The guessing below is coarse on purpose. Measuring what a device can actually do is #30; until
// then a visitor who disagrees with the guess can say so with `?quality=`.

export type Quality = 'low' | 'medium' | 'high';

export interface QualitySettings {
  /** The sun's shadow map: off on `low`, where contact shadows carry it alone. */
  shadows: boolean;
  shadowMap: number;
  contactShadows: boolean;
  maxPixelRatio: number;
  smokePuffs: number;
  fireflies: number;
  sprayPoints: number;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  high: { shadows: true, shadowMap: 2048, contactShadows: true, maxPixelRatio: 2, smokePuffs: 9, fireflies: 9, sprayPoints: 40 },
  medium: { shadows: true, shadowMap: 1024, contactShadows: true, maxPixelRatio: 1.5, smokePuffs: 6, fireflies: 6, sprayPoints: 22 },
  low: { shadows: false, shadowMap: 512, contactShadows: true, maxPixelRatio: 1, smokePuffs: 4, fireflies: 4, sprayPoints: 10 },
};

export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];

export function isQuality(v: string | null | undefined): v is Quality {
  return !!v && (QUALITIES as readonly string[]).includes(v);
}

/** What we can see of the device without asking it to draw anything. */
export interface DeviceHints {
  /** `navigator.hardwareConcurrency`, where the browser reports it. */
  cores?: number;
  /** `navigator.deviceMemory` in GB, which only some browsers report. */
  memory?: number;
  /** A touch screen rather than a mouse (`(pointer: coarse)`). */
  coarsePointer?: boolean;
}

/**
 * A first guess at what a device can afford, from what it will tell us for free.
 *
 * Deliberately pessimistic about touch devices: a phone that can manage `high` loses a little
 * depth of haze, while a phone that cannot manage `medium` drops frames through the whole event,
 * which is the one thing that stops a scene working.
 */
export function detectQuality(d: DeviceHints = {}): Quality {
  const cores = d.cores ?? 4;
  const memory = d.memory ?? 4;
  if (cores <= 2 || memory <= 2) return 'low';
  if (d.coarsePointer) return cores >= 8 && memory >= 6 ? 'medium' : 'low';
  if (cores <= 4 || memory <= 4) return 'medium';
  return 'high';
}

/** The quality to use: what was asked for, else what was remembered, else the guess. */
export function chooseQuality(asked: string | null | undefined, remembered: string | null | undefined, device: DeviceHints = {}): Quality {
  if (isQuality(asked)) return asked;
  if (asked === 'auto') return detectQuality(device);
  if (isQuality(remembered)) return remembered;
  return detectQuality(device);
}
