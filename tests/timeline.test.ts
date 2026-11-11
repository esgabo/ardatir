import { describe, expect, it } from 'vitest';
import { actionMix, headingAt, onTile, samplePose, strideSeconds } from '../src/timeline';

const at = (x: number, z: number, action: 'hide' | 'walk' | 'run' | 'idle', t: number) => ({ t, x, z, action });

describe('samplePose', () => {
  it('keeps a move between two hide keyframes hidden', () => {
    const track = { characterId: 'a', keyframes: [at(0, 0, 'hide', 0), at(2, 2, 'hide', 1)] };
    expect(samplePose(track, 0.5).action).toBe('hide');
  });
  it('walks or runs when moving otherwise', () => {
    const w = { characterId: 'a', keyframes: [at(0, 0, 'idle', 0), at(2, 2, 'walk', 1)] };
    const r = { characterId: 'a', keyframes: [at(0, 0, 'hide', 0), at(2, 2, 'run', 1)] };
    expect(samplePose(w, 0.5).action).toBe('walk');
    expect(samplePose(r, 0.5).action).toBe('run');
  });
});

describe('onTile', () => {
  it('hides figures off the tile', () => {
    expect(onTile({ x: 6, z: -6 })).toBe(true);
    expect(onTile({ x: 11, z: 11 })).toBe(false);
    expect(onTile({ x: -13, z: 0 })).toBe(false);
  });
});

describe('motion between poses', () => {
  // Stands at the origin, walks east (+x) from 0.2 to 0.4, stands, then walks north (-z) from 0.6 to 0.8.
  const k = (t: number, x: number, z: number, action?: 'idle' | 'walk' | 'run' | 'talk') => ({ t, x, z, ...action ? { action } : {} });
  const track = { characterId: 'a', keyframes: [k(0, 0, 0, 'idle'), k(0.2, 0, 0, 'idle'), k(0.4, 4, 0, 'talk'), k(0.6, 4, 0, 'talk'), k(0.8, 4, -4, 'walk'), k(1, 4, -4, 'idle')] };
  const S = 10; // event seconds

  it('cross-fades into a new action for a moment after it changes', () => {
    expect(actionMix(track, 0.1, S)).toEqual({ action: 'idle', w: 1 });
    const m = actionMix(track, 0.21, S, 0.25);
    expect(m.action).toBe('walk');
    expect(m.previous).toBe('idle');
    expect(m.w).toBeGreaterThan(0);
    expect(m.w).toBeLessThan(1);
    expect(actionMix(track, 0.3, S, 0.25)).toEqual({ action: 'walk', w: 1 });
    // From walking into talk at 0.4.
    expect(actionMix(track, 0.41, S, 0.25)).toMatchObject({ action: 'talk', previous: 'walk' });
  });

  it('is the same blend whatever came before (pure in t)', () => {
    actionMix(track, 0.9, S);
    expect(actionMix(track, 0.21, S)).toEqual(actionMix(track, 0.21, S));
  });

  it('faces along the latest move, keeps it while standing, and turns the short way', () => {
    expect(headingAt(track, 0.1, S)).toBe(0);
    expect(headingAt(track, 0.3, S)).toBeCloseTo(Math.PI / 2); // east, turned
    expect(headingAt(track, 0.5, S)).toBeCloseTo(Math.PI / 2); // still east while talking
    expect(headingAt(track, 0.75, S)).toBeCloseTo(Math.PI); // north (-z)
    const mid = headingAt(track, 0.6 + 0.15 / S, S, 0.35); // part way through the turn east → north
    expect(mid).toBeGreaterThan(Math.PI / 2);
    expect(mid).toBeLessThan(Math.PI);
  });

  it('turns through the short side across ±π', () => {
    const t2 = { characterId: 'b', keyframes: [k(0, 0, 0), k(0.5, -1, -4, 'walk'), k(1, 1, -8, 'walk')] };
    // Headings of about -166° then +166°: the turn passes through 180°, not through 0.
    const h = headingAt(t2, 0.5 + 0.1 / S, S, 0.35);
    expect(Math.abs(Math.cos(h))).toBeGreaterThan(0.95);
    expect(Math.cos(h)).toBeLessThan(0);
  });

  it('paces a walk by the ground covered, within limits, and counts standing time as it is', () => {
    const pace = () => 1; // one unit per second
    expect(strideSeconds(track, 0.2, S, pace)).toBeCloseTo(2); // stood for 2 s
    // Walked 4 units in 2 s (2 u/s): the cycle runs twice as fast.
    expect(strideSeconds(track, 0.4, S, pace)).toBeCloseTo(2 + 4);
    expect(strideSeconds(track, 0.3, S, pace)).toBeCloseTo(2 + 2);
    // Too fast for the legs: kept to the upper limit.
    expect(strideSeconds(track, 0.4, S, () => 0.1, [0.5, 2.5])).toBeCloseTo(2 + 2 * 2.5);
    // Continuous across a keyframe.
    expect(strideSeconds(track, 0.4 - 1e-9, S, pace)).toBeCloseTo(strideSeconds(track, 0.4 + 1e-9, S, pace));
    expect(strideSeconds(track, 1, S, pace)).toBeCloseTo(2 + 4 + 2 + 4 + 2);
  });
});
