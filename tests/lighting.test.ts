import { describe, expect, it } from 'vitest';
import { LIGHTS, desaturate, fogRange, lightAt, mixLights } from '../src/scene/lighting';

describe('lightAt', () => {
  const keys = [{ t: 0.2, preset: 'morning' as const }, { t: 0.6, preset: 'dusk' as const }];

  it('is the default day without keys', () => {
    expect(lightAt(undefined, 0.5)).toBe(LIGHTS.day);
    expect(lightAt([], 0.5)).toBe(LIGHTS.day);
  });

  it('holds the first look before its key and the last after its key', () => {
    expect(lightAt(keys, 0)).toEqual(LIGHTS.morning);
    expect(lightAt(keys, 0.2)).toEqual(LIGHTS.morning);
    expect(lightAt(keys, 0.6)).toEqual(LIGHTS.dusk);
    expect(lightAt(keys, 1)).toEqual(LIGHTS.dusk);
  });

  it('eases between keys: halfway in t is halfway in the look', () => {
    const mid = lightAt(keys, 0.4), half = mixLights(LIGHTS.morning, LIGHTS.dusk, 0.5);
    expect(mid.sun).toBe(half.sun);
    expect(mid.sunIntensity).toBeCloseTo(half.sunIntensity);
    mid.sunFrom.forEach((v, i) => expect(v).toBeCloseTo(half.sunFrom[i]));
    expect(mid.lamps).toBeCloseTo(0.5);
    // eased: a quarter of the way in t is less than a quarter of the way in the look
    expect(lightAt(keys, 0.3).lamps).toBeLessThan(0.25);
  });

  it('mixes colours channel by channel', () => {
    const m = mixLights({ ...LIGHTS.day, sun: '#000000' }, { ...LIGHTS.day, sun: '#ff8000' }, 0.5);
    expect(m.sun).toBe('#804000');
  });
});

describe('fogRange', () => {
  // The isometric camera's near corner of a tile is about 26 units away and its far corner 43.
  const NEAR_CORNER = 26, FAR_CORNER = 43;
  const at = (depth: number, distance: number) => {
    const [near, far] = fogRange(depth);
    return Math.min(1, Math.max(0, (distance - near) / (far - near)));
  };

  it('leaves the front of the tile all but clear at every depth', () => {
    for (const d of [0, 0.25, 0.5, 0.75, 1]) expect(at(d, NEAR_CORNER)).toBeLessThan(0.08);
  });

  it('sets the back of the tile back without swallowing it', () => {
    expect(at(0, FAR_CORNER)).toBeGreaterThan(0.1);
    expect(at(1, FAR_CORNER)).toBeGreaterThan(0.4);
    expect(at(1, FAR_CORNER)).toBeLessThan(0.65);
  });

  it('puts more air in at a greater depth, and always some gradient across the tile', () => {
    expect(at(1, FAR_CORNER)).toBeGreaterThan(at(0.5, FAR_CORNER));
    expect(at(0.5, FAR_CORNER)).toBeGreaterThan(at(0, FAR_CORNER));
    for (const d of [0, 0.5, 1]) expect(at(d, FAR_CORNER)).toBeGreaterThan(at(d, NEAR_CORNER));
  });

  it('clamps a depth outside 0 to 1', () => {
    expect(fogRange(-1)).toEqual(fogRange(0));
    expect(fogRange(2)).toEqual(fogRange(1));
  });
});

describe('desaturate', () => {
  it('leaves a colour alone at 1 and makes it grey at 0', () => {
    expect(desaturate('#88cc44', 1)).toBe('#88cc44');
    const grey = desaturate('#88cc44', 0);
    expect(grey.slice(1, 3)).toBe(grey.slice(3, 5));
    expect(grey.slice(3, 5)).toBe(grey.slice(5, 7));
  });

  it('leaves a grey grey', () => {
    expect(desaturate('#808080', 0.5)).toBe('#808080');
  });
});

describe('the lights themselves', () => {
  it('all carry air: a colour and a depth inside 0 to 1', () => {
    for (const [name, light] of Object.entries(LIGHTS)) {
      expect(light.fog, name).toMatch(/^#[0-9a-f]{6}$/);
      expect(light.fogDepth, name).toBeGreaterThan(0);
      expect(light.fogDepth, name).toBeLessThanOrEqual(1);
    }
  });

  it('thickens the air as the light goes: dawn and night are hazier than midday', () => {
    expect(LIGHTS.dawn.fogDepth).toBeGreaterThan(LIGHTS.day.fogDepth);
    expect(LIGHTS.night.fogDepth).toBeGreaterThan(LIGHTS.day.fogDepth);
  });
});

describe('the soft second light', () => {
  it('is off in full day and strongest at night', () => {
    expect(LIGHTS.day.fillIntensity).toBe(0);
    expect(LIGHTS.morning.fillIntensity).toBe(0);
    expect(LIGHTS.night.fillIntensity).toBeGreaterThan(LIGHTS.dusk.fillIntensity);
    expect(LIGHTS.dusk.fillIntensity).toBeGreaterThan(LIGHTS.evening.fillIntensity);
  });

  it('comes up as the sun goes down, so no hour is left unreadable', () => {
    const order = ['day', 'evening', 'dusk', 'night'] as const;
    for (let i = 1; i < order.length; i++) {
      const dark = LIGHTS[order[i]], lighter = LIGHTS[order[i - 1]];
      expect(dark.sunIntensity).toBeLessThan(lighter.sunIntensity);
      expect(dark.fillIntensity).toBeGreaterThan(lighter.fillIntensity);
    }
  });

  it('is mixed between keys like everything else', () => {
    const keys = [{ t: 0, preset: 'day' as const }, { t: 1, preset: 'night' as const }];
    const mid = lightAt(keys, 0.5);
    expect(mid.fillIntensity).toBeCloseTo(LIGHTS.night.fillIntensity / 2);
    expect(mid.fill).toMatch(/^#[0-9a-f]{6}$/);
  });
});
