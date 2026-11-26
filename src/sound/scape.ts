// What a place sounds like at a moment: the ambience bed, as a pure function of the place and
// the light (DESIGN §9.5). The parallel to grade.ts is exact and on purpose — a place has an air
// and it has a sound, and both are decided once for the place rather than per event, so two
// events in the same place agree with each other and a new event is heard without authoring
// anything. The hour comes from the light the staging already asks for: `Light.lamps` is 0 by
// day and 1 at night, which is also when the birds stop and the crickets start.
//
// Nothing here is a recording. Every layer is built out of noise and a filter in sound/engine.ts,
// the way the terrain is built out of a few flat faces: original, weightless, and honest about
// being a made thing rather than a photograph of a wood.

import type { Light } from '../scene/lighting';

/**
 * The layers of an ambience bed, 0 → 1.
 *
 * As a `Scape` these are a place's full strengths — what you would hear there at the best hour
 * for each. As the result of `heard` they are the gains now.
 */
export interface Layers {
  /** Open air moving: the wider and higher the place, the more of it. */
  wind: number;
  /** That air in leaves. */
  leaves: number;
  /** Songbirds, which keep to the day. */
  birds: number;
  /** Crickets, and an owl now and then: the night's own sound. */
  night: number;
  /** A lake, a river, falls, rain off a roof. */
  water: number;
  /** A fire in the place's kit: a hearth, a camp fire. */
  fire: number;
  /** Walls close around the sound: a hall, a tunnel, a cave. */
  room: number;
  /** Water off stone. */
  drip: number;
}

export const SILENCE: Layers = { wind: 0, leaves: 0, birds: 0, night: 0, water: 0, fire: 0, room: 0, drip: 0 };

const scape = (s: Partial<Layers>): Layers => ({ ...SILENCE, ...s });

/**
 * The named scapes. A place takes one of these; a place nobody has listened for takes `silence`,
 * exactly as an ungraded place takes `plain`. Silence is a real answer, not a gap to fill: the
 * cosmos events have no place and no sound, because inventing a noise for the Music of the Ainur
 * is a decision somebody should make on purpose.
 */
export const SCAPES: Record<string, Layers> = {
  silence: SILENCE,

  // Open country under a wide sky: mostly the wind, and whatever sings in it.
  open: scape({ wind: 0.5, leaves: 0.14, birds: 0.55, night: 0.45 }),
  // The Shire: sheltered, full of hedges and birds, water somewhere out of sight.
  shire: scape({ wind: 0.28, leaves: 0.45, birds: 0.85, night: 0.6, water: 0.07 }),
  // A hall with a fire in it, and the day coming in at the windows.
  hall: scape({ wind: 0.1, leaves: 0.18, birds: 0.28, night: 0.3, fire: 0.75, room: 0.55 }),
  // Wild wood: more leaves than anything, and loud after dark.
  wood: scape({ wind: 0.24, leaves: 0.7, birds: 0.5, night: 0.8 }),
  // A camp in that wood, with a fire at the middle of it.
  camp: scape({ wind: 0.2, leaves: 0.6, birds: 0.3, night: 0.75, fire: 0.8 }),
  // Mirkwood: the light does not get down here and very little sings. DESIGN §9.1's grade says
  // the same thing about the air; what you hear is leaves with nothing living in them.
  mirkwood: scape({ wind: 0.12, leaves: 0.5, birds: 0.06, night: 0.4, drip: 0.14, room: 0.22 }),
  // Elvish places, which in Tolkien are always above running water.
  elvish: scape({ wind: 0.18, leaves: 0.4, birds: 0.45, night: 0.4, water: 0.7 }),
  // The Long Lake and the river out of it: water, and weather off the mountain.
  lake: scape({ wind: 0.45, leaves: 0.08, birds: 0.22, night: 0.28, water: 0.8, room: 0.12 }),
  // Bare stone and thin air, where the wind is the whole of it.
  mountain: scape({ wind: 0.9, birds: 0.1, night: 0.18 }),
  // Under the mountains: no weather, no life, and every sound coming back off the walls.
  cave: scape({ wind: 0.1, water: 0.18, room: 1, drip: 0.7 }),
  // Mordor: a place with nothing alive in it and a mountain working at the far end.
  mordor: scape({ wind: 0.62, room: 0.3 }),
};

/**
 * Which scape each place takes. As with `PLACE_GRADES`, a place is listed once somebody has
 * decided what it sounds like, and the places with dioramas built for them come first.
 */
export const PLACE_SCAPES: Record<string, keyof typeof SCAPES> = {
  // Indoors, with a hearth: these are the places with kits built for them (docs/MODELS.md).
  'bag-end': 'hall', 'green-dragon': 'hall', 'beorns-house': 'hall', 'prancing-pony': 'hall',
  trollshaws: 'camp',
  rivendell: 'elvish',

  bywater: 'shire', hobbiton: 'shire', 'the-shire': 'shire', 'woody-end': 'shire',
  crickhollow: 'shire', 'sarn-ford': 'shire', 'brandywine-bridge': 'shire',
  westmarch: 'shire', 'tower-hills': 'shire',

  'old-forest': 'wood', 'barrow-downs': 'open', weathertop: 'open', hollin: 'open',
  fangorn: 'wood', 'ford-of-bruinen': 'elvish', 'carrock': 'open',

  mirkwood: 'mirkwood', 'forest-gate': 'mirkwood', 'dol-guldur': 'mirkwood',
  'taur-nu-fuin': 'mirkwood', 'nan-elmoth': 'mirkwood',

  'lake-town': 'lake', dale: 'lake', 'long-lake': 'lake', 'running-river': 'lake',

  caradhras: 'mountain', erebor: 'mountain', 'eagles-eyrie': 'mountain', zirakzigil: 'mountain',
  azanulbizar: 'mountain', 'ered-luin': 'mountain', mindolluin: 'mountain', helcaraxe: 'mountain',
  'misty-mountains': 'mountain', 'high-pass': 'mountain', ravenhill: 'mountain',

  'goblin-town': 'cave', 'gollums-lake': 'cave', moria: 'cave', 'elvenking-halls': 'cave',
  'shelobs-lair': 'cave', utumno: 'cave', angband: 'cave', 'paths-of-the-dead': 'cave',
  nargothrond: 'cave', 'front-gate': 'cave',

  mordor: 'mordor', 'mount-doom': 'mordor', orodruin: 'mordor', morannon: 'mordor',
  'minas-morgul': 'mordor', 'cirith-ungol': 'mordor', 'barad-dur': 'mordor',
  'dead-marshes': 'mordor', anfauglith: 'mordor', thangorodrim: 'mordor',

  lothlorien: 'elvish', lindon: 'elvish', 'grey-havens': 'elvish', gondolin: 'elvish',
  menegroth: 'elvish', doriath: 'elvish', eregion: 'elvish', 'ost-in-edhil': 'elvish',
  tirion: 'elvish', alqualonde: 'elvish', valinor: 'elvish', 'cerin-amroth': 'elvish',

  edoras: 'open', 'pelennor-fields': 'open', 'minas-tirith': 'open', isengard: 'open',
  bree: 'shire', 'rohan': 'open',
};

/** The scape for a place id: silence for a place nobody has listened for yet. */
export function scapeFor(placeId: string | undefined): Layers {
  return SCAPES[(placeId && PLACE_SCAPES[placeId]) || 'silence'] ?? SILENCE;
}

/**
 * What is heard now: the place's layers with the hour folded in.
 *
 * `Light.lamps` is the hour — 0 in broad day, 1 after dark — so the same keys that light the
 * windows put the birds to bed. The wind drops at night, the birds stop before the light quite
 * does (hence the square), and a fire burns a little even by day, brighter once it is the only
 * light in the place, which is exactly what sets.ts does with its glow.
 */
export function heard(scape: Layers, light: Light): Layers {
  const dark = Math.min(1, Math.max(0, light.lamps));
  const day = 1 - dark;
  return {
    wind: scape.wind * (0.72 + 0.28 * day),
    leaves: scape.leaves * (0.72 + 0.28 * day),
    birds: scape.birds * day * day,
    night: scape.night * dark,
    water: scape.water,
    fire: scape.fire * (0.45 + 0.55 * dark),
    room: scape.room,
    drip: scape.drip,
  };
}

/**
 * What the bed drops to while a narration passage is being read. The world does not stop for the
 * narrator — a river under a voice is part of why the voice is worth listening to — it steps back.
 */
export const DUCK = 0.4;
