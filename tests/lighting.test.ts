import { describe, expect, it } from 'vitest';
import { LIGHTS, lightAt, mixLights } from '../src/scene/lighting';

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
