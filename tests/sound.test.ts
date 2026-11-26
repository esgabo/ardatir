import { describe, expect, it } from 'vitest';
import type { SoundKey, Track } from '../src/data/types';
import { LIGHTS } from '../src/scene/lighting';
import { DUCK, heard, scapeFor, SCAPES, SILENCE } from '../src/sound/scape';
import { authored, cuesBetween, footsteps, MAX_SPAN, RUN_CYCLE, stepGain, WALK_CYCLE, type Walker } from '../src/sound/cues';

const pace = (action: string, height: number) => ({ walk: 0.8, run: 2.0 }[action as 'walk' | 'run'] ?? 0) * height;

describe('scapeFor', () => {
  it('gives silence to a place nobody has listened for, as an ungraded place gets plain light', () => {
    expect(scapeFor(undefined)).toEqual(SILENCE);
    expect(scapeFor('somewhere-nobody-has-been')).toEqual(SILENCE);
  });

  it('gives the places with kits built for them the scape chosen for each', () => {
    expect(scapeFor('bag-end')).toBe(SCAPES.hall);
    expect(scapeFor('beorns-house')).toBe(SCAPES.hall);
    expect(scapeFor('trollshaws')).toBe(SCAPES.camp);
    expect(scapeFor('rivendell')).toBe(SCAPES.elvish);
    expect(scapeFor('bywater')).toBe(SCAPES.shire);
  });

  it('agrees with the grade about Mirkwood: very little gets down here, light or song', () => {
    expect(scapeFor('mirkwood').birds).toBeLessThan(scapeFor('bywater').birds / 5);
  });
});

describe('heard', () => {
  const shire = scapeFor('bywater');

  it('puts the birds to bed and brings the crickets up, off the same light the windows use', () => {
    const day = heard(shire, LIGHTS.day);
    const night = heard(shire, LIGHTS.night);
    expect(day.birds).toBeGreaterThan(0.8 * shire.birds);
    expect(day.night).toBe(0);
    expect(night.birds).toBe(0);
    expect(night.night).toBeCloseTo(shire.night, 6);
  });

  it('stops the birds before the light quite goes, so dusk is not full of song', () => {
    const dusk = heard(shire, LIGHTS.dusk);
    const evening = heard(shire, LIGHTS.evening);
    expect(dusk.birds).toBe(0);
    expect(evening.birds).toBeLessThan(0.3 * shire.birds);
  });

  it('drops the wind at night without silencing it', () => {
    const day = heard(shire, LIGHTS.day).wind;
    const night = heard(shire, LIGHTS.night).wind;
    expect(night).toBeLessThan(day);
    expect(night).toBeGreaterThan(0.5 * day);
  });

  it('keeps a hearth burning by day and brings it up once it is the light in the room', () => {
    const hall = scapeFor('bag-end');
    expect(heard(hall, LIGHTS.day).fire).toBeCloseTo(hall.fire * 0.45, 6);
    expect(heard(hall, LIGHTS.night).fire).toBeCloseTo(hall.fire, 6);
  });

  it('leaves water, walls and drips alone: a river and a cave do not keep hours', () => {
    const cave = scapeFor('moria');
    for (const light of [LIGHTS.day, LIGHTS.night]) {
      const now = heard(cave, light);
      expect(now.water).toBe(cave.water);
      expect(now.drip).toBe(cave.drip);
      expect(now.room).toBe(cave.room);
    }
  });

  it('hears nothing in a place with no scape, at any hour', () => {
    expect(heard(scapeFor(undefined), LIGHTS.night)).toEqual(SILENCE);
    expect(heard(scapeFor(undefined), LIGHTS.day)).toEqual(SILENCE);
  });

  it('ducks under a voice without silencing the world', () => {
    expect(DUCK).toBeGreaterThan(0);
    expect(DUCK).toBeLessThan(1);
  });
});

// ---- the one-shots ----------------------------------------------------------------------------

/** A figure walking straight across the tile for the whole event. */
const crossing: Track = {
  characterId: 'bilbo',
  keyframes: [{ t: 0, x: -4, z: 0, action: 'walk' }, { t: 1, x: 4, z: 0, action: 'walk' }],
};
const standing: Track = {
  characterId: 'gandalf',
  keyframes: [{ t: 0, x: 0, z: 2, action: 'idle' }, { t: 1, x: 0, z: 2, action: 'idle' }],
};
const walker = (track: Track, height = 1): Walker => ({ track, height });
/** Eight units in ten seconds is a walking pace of 0.8, which is what the walk clip is made for. */
const SECONDS = 10;

/** Every cue over the whole event, stepped through in frames small enough to be playback. */
function sweep(keys: SoundKey[] | undefined, walkers: Walker[], steps = 400, seconds = SECONDS) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    out.push(...cuesBetween(keys, walkers, i / steps, (i + 1) / steps, seconds, pace));
  }
  return out;
}

describe('footsteps', () => {
  it('lands a step for each half of the gait cycle the figure has walked', () => {
    const steps = sweep(undefined, [walker(crossing)]).length;
    // Ten seconds of walk cycle, two steps every 0.8 of it.
    expect(steps).toBeGreaterThan(22);
    expect(steps).toBeLessThan(28);
  });

  it('gives a figure standing still, hiding or offstage no feet at all', () => {
    expect(sweep(undefined, [walker(standing)])).toEqual([]);
    expect(sweep(undefined, [walker({
      characterId: 'bilbo',
      keyframes: [{ t: 0, x: -4, z: 0, action: 'hide' }, { t: 1, x: 4, z: 0, action: 'hide' }],
    })])).toEqual([]);
    expect(sweep(undefined, [walker({
      characterId: 'bilbo',
      keyframes: [{ t: 0, x: -40, z: 0, action: 'walk' }, { t: 1, x: -20, z: 0, action: 'walk' }],
    })])).toEqual([]);
  });

  it('steps faster when the ground is covered faster, because the legs do too', () => {
    const slow = sweep(undefined, [walker(crossing)]).length;
    const fast = sweep(undefined, [walker({
      characterId: 'bilbo',
      keyframes: [{ t: 0, x: -6.5, z: 0, action: 'walk' }, { t: 1, x: 6.5, z: 0, action: 'walk' }],
    })]).length;
    expect(fast).toBeGreaterThan(slow);
  });

  it('runs on a shorter cycle than it walks', () => {
    expect(RUN_CYCLE).toBeLessThan(WALK_CYCLE);
  });

  it('says nothing at all across a seek, so a scrub cannot fire every footstep at once', () => {
    const span = MAX_SPAN / SECONDS;
    expect(footsteps([walker(crossing)], 0, span, SECONDS, pace).length).toBeGreaterThan(0);
    expect(footsteps([walker(crossing)], 0, span * 3, SECONDS, pace)).toEqual([]);
    expect(footsteps([walker(crossing)], 0.6, 0.2, SECONDS, pace)).toEqual([]);
  });

  it('lands a heavier figure harder, and a run harder than a walk', () => {
    expect(stepGain(1.8, false)).toBeGreaterThan(stepGain(0.9, false));
    expect(stepGain(1, true)).toBeGreaterThan(stepGain(1, false));
  });

  it('is the same both times it is asked, so a deep link and a replay sound alike', () => {
    const once = sweep(undefined, [walker(crossing)]);
    const twice = sweep(undefined, [walker(crossing)]);
    expect(twice).toEqual(once);
  });
});

describe('authored cues', () => {
  const keys: SoundKey[] = [
    { t: 0.1, cue: 'knock' },
    { t: 0.12, cue: 'door', gain: 0.8 },
    { t: 0.9, cue: 'clatter' },
  ];

  it('fires each one exactly once over the event, in the order written', () => {
    const fired = sweep(keys, []).map((c) => c.kind);
    expect(fired).toEqual(['knock', 'door', 'clatter']);
  });

  it('carries the gain the author asked for, and 1 when they did not', () => {
    expect(authored(keys, 0.09, 0.13).map((c) => c.gain)).toEqual([1, 0.8]);
  });

  it('belongs to the moment it is passed, not to the frame before or after it', () => {
    expect(authored(keys, 0, 0.1).map((c) => c.kind)).toEqual(['knock']);
    expect(authored(keys, 0.1, 0.11)).toEqual([]);
    expect(authored(keys, 0.5, 0.5)).toEqual([]);
  });

  it('is not held back by a seek the way footsteps are: a beat still sounds when you jump to it', () => {
    expect(authored(keys, 0, 1).map((c) => c.kind)).toEqual(['knock', 'door', 'clatter']);
  });

  it('has nothing to say for an event that stages no sound', () => {
    expect(authored(undefined, 0, 1)).toEqual([]);
    expect(authored([], 0, 1)).toEqual([]);
  });

  it('comes before the feet, so a knock is heard over the step that brought it', () => {
    const both = cuesBetween([{ t: 0.005, cue: 'knock' }], [walker(crossing)], 0, 0.006, SECONDS, pace);
    expect(both[0].kind).toBe('knock');
  });
});
