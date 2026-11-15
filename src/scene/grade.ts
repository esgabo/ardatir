// The grade of a place: the Shire warm and green, Mirkwood oppressive, Lake-town cold and grey,
// Mordor without comfort. It is applied to the light the event's `light:` keys ask for, so the
// time of day still reads and two events in the same place agree with each other.
//
// We grade the light rather than the pixels. A post-processing pass would be a second render of
// the whole frame, a chunk of its own and the first thing to die on a phone; pulling the sun, the
// sky, the background and the haze toward a place's colour costs nothing, stays a pure function
// of `t` and the place, and cannot drift out of step with the shadows. What it cannot do is grade
// what does not take light: emissive windows and lamps keep their own colour, which is right.
//
// A place with no grade of its own gets `plain`, which is exactly the light as it was.

import { desaturate, lerpColour, type Light } from './lighting';

export interface Grade {
  /** The colour this place pulls its light toward, and how far (0 leaves it alone). */
  tint: string;
  amount: number;
  /** Multiplies the sun and the sky: under 1 for a place the light struggles to reach. */
  sun: number;
  ambient: number;
  /** How much colour survives: 1 as lit, 0 grey. */
  saturation: number;
  /** Multiplies the haze the light asks for. */
  fog: number;
  /**
   * Multiplies the soft second light that keeps a dark scene readable (default 1).
   *
   * A place whose own grade takes light away needs more of it back, not less: graded down with
   * everything else, a cave or a night wood would end up exactly as hard to see as before.
   */
  fill?: number;
  /** The haze's own tint, when it differs from the light's (defaults to `tint` and `amount`). */
  fogTint?: string;
  fogAmount?: number;
}

const PLAIN: Grade = { tint: '#ffffff', amount: 0, sun: 1, ambient: 1, saturation: 1, fog: 1 };

export const GRADES: Record<string, Grade> = {
  plain: PLAIN,
  // Hobbiton and Bree: sunlight through leaves, a little more green and gold than it really is.
  shire: { tint: '#ffd9a0', amount: 0.14, sun: 1.05, ambient: 1.06, saturation: 1.08, fog: 0.85 },
  // Wild country under trees: damp, a touch colder, and more air between the near trees and the far.
  wild: { tint: '#a8bcc2', amount: 0.13, sun: 0.95, ambient: 1, saturation: 0.95, fog: 1.4 },
  // Elvish places: the air clear and silver, and more of it, so the valley has depth.
  elvish: { tint: '#d6e2ff', amount: 0.15, sun: 1, ambient: 1.14, saturation: 1.02, fog: 1.2, fogTint: '#3a4a6e', fogAmount: 0.4 },
  // Mirkwood and Dol Guldur: the light does not get down here, and the colour goes with it.
  mirkwood: { tint: '#3f4a33', amount: 0.3, sun: 0.68, ambient: 0.74, saturation: 0.68, fog: 1.9, fill: 1.45 },
  // Lake-town and Dale: cold water, grey timber, weather coming off the mountain.
  laketown: { tint: '#b4c4d4', amount: 0.2, sun: 0.9, ambient: 1, saturation: 0.72, fog: 1.5 },
  // Bare stone and thin air.
  mountain: { tint: '#c6ccd8', amount: 0.16, sun: 0.96, ambient: 0.9, saturation: 0.86, fog: 1.25 },
  // Under the mountains: no sky worth the name, and what light there is comes from the lamps.
  underground: { tint: '#4a4452', amount: 0.32, sun: 0.5, ambient: 0.62, saturation: 0.78, fog: 1.5, fill: 1.9 },
  // Mordor: nothing here is comfortable, and the air is full of what the mountain throws up.
  mordor: { tint: '#6b4a3a', amount: 0.32, sun: 0.8, ambient: 0.7, saturation: 0.55, fog: 1.8, fill: 1.35 },
};

/**
 * Which grade each place takes. Places not named here are `plain`: a place gets a grade when
 * someone has looked at a diorama built for it and decided what its air is like, not before.
 */
export const PLACE_GRADES: Record<string, keyof typeof GRADES> = {
  'bag-end': 'shire', bywater: 'shire', 'green-dragon': 'shire', hobbiton: 'shire',
  'the-shire': 'shire', 'woody-end': 'shire', crickhollow: 'shire', 'prancing-pony': 'shire',
  'beorns-house': 'shire',

  trollshaws: 'wild', 'ford-of-bruinen': 'wild', weathertop: 'wild', hollin: 'wild',
  'old-forest': 'wild', 'barrow-downs': 'wild', 'sarn-ford': 'wild', fangorn: 'wild',

  rivendell: 'elvish', lothlorien: 'elvish', lindon: 'elvish', 'grey-havens': 'elvish',
  gondolin: 'elvish', menegroth: 'elvish', doriath: 'elvish', eregion: 'elvish',
  'ost-in-edhil': 'elvish', tirion: 'elvish', alqualonde: 'elvish', valinor: 'elvish',

  mirkwood: 'mirkwood', 'forest-gate': 'mirkwood', 'dol-guldur': 'mirkwood',
  'taur-nu-fuin': 'mirkwood', 'nan-elmoth': 'mirkwood',

  'lake-town': 'laketown', dale: 'laketown',

  caradhras: 'mountain', erebor: 'mountain', 'eagles-eyrie': 'mountain', zirakzigil: 'mountain',
  azanulbizar: 'mountain', 'ered-luin': 'mountain', mindolluin: 'mountain', helcaraxe: 'mountain',

  'goblin-town': 'underground', 'gollums-lake': 'underground', moria: 'underground',
  'elvenking-halls': 'underground', 'shelobs-lair': 'underground', utumno: 'underground',
  angband: 'underground', 'paths-of-the-dead': 'underground', nargothrond: 'underground',

  mordor: 'mordor', 'mount-doom': 'mordor', orodruin: 'mordor', morannon: 'mordor',
  'minas-morgul': 'mordor', 'cirith-ungol': 'mordor', 'barad-dur': 'mordor',
  'dead-marshes': 'mordor', anfauglith: 'mordor', thangorodrim: 'mordor',
};

/** The grade for a place id: `plain` for a place nobody has graded yet. */
export function gradeFor(placeId: string | undefined): Grade {
  return GRADES[(placeId && PLACE_GRADES[placeId]) || 'plain'] ?? PLAIN;
}

/** A light as this place makes it look. `plain` returns the light unchanged. */
export function graded(light: Light, g: Grade): Light {
  if (g === PLAIN || (g.amount === 0 && g.sun === 1 && g.ambient === 1 && g.saturation === 1 && g.fog === 1 && (g.fill ?? 1) === 1)) return light;
  const paint = (c: string) => lerpColour(desaturate(c, g.saturation), g.tint, g.amount);
  const fogTint = g.fogTint ?? g.tint;
  const fogAmount = g.fogAmount ?? g.amount;
  return {
    ...light,
    sun: paint(light.sun),
    sunIntensity: light.sunIntensity * g.sun,
    sky: paint(light.sky),
    ground: paint(light.ground),
    hemiIntensity: light.hemiIntensity * g.ambient,
    fill: paint(light.fill),
    fillIntensity: light.fillIntensity * (g.fill ?? 1),
    // The background is the void the diorama sits in, not part of the place: it takes a third of
    // the tint, to tie the two together, and none of the brightening. Graded in full it goes pale,
    // and the tile stops reading as a made object on a dark field and starts reading as a photograph.
    background: lerpColour(light.background, g.tint, g.amount * 0.35),
    fog: lerpColour(desaturate(light.fog, g.saturation), fogTint, fogAmount),
    fogDepth: Math.min(1, light.fogDepth * g.fog),
  };
}
