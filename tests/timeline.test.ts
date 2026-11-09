import { describe, expect, it } from 'vitest';
import { onTile, samplePose } from '../src/timeline';

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
