// The model loader end to end with the test model (meshopt-compressed by gltfpack, as real
// exports are): it decodes, stands at a character's height, and its clips are a pure function of t.

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { clipFor, clipTime } from '../src/scene/modelClips.ts';
import { instantiate, parseModel, type Model } from '../src/scene/models.ts';

const file = path.join(import.meta.dirname, 'fixtures/valid/assets/characters/test-figure/test-figure.glb');
const load = (): Promise<Model> => {
  const b = fs.readFileSync(file);
  return parseModel(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
};

describe('clips', () => {
  const all = new Set(['idle', 'walk', 'run', 'talk', 'hide', 'fight']);
  it('plays the action\'s own clip, else a fallback, else none', () => {
    expect(clipFor('run', all)).toBe('run');
    expect(clipFor('run', new Set(['idle', 'walk']))).toBe('walk');
    expect(clipFor('hide', new Set(['idle', 'walk']))).toBe('idle');
    expect(clipFor('talk', new Set(['walk']))).toBeUndefined();
    expect(clipFor('idle', new Set())).toBeUndefined();
  });

  it('places a clip by the event\'s seconds at t, wrapped to the clip', () => {
    expect(clipTime(0, 30, 1)).toBe(0);
    expect(clipTime(0.5, 30, 2)).toBeCloseTo(1);
    expect(clipTime(0.51, 30, 2)).toBeCloseTo(1.3);
    expect(clipTime(1, 30, 0.7)).toBeCloseTo(30 % 0.7);
    expect(clipTime(0.3, 30, 0)).toBe(0);
  });
});

describe('the test model', () => {
  it('decodes with its clips', async () => {
    const m = await load();
    expect(m.clips.map((c) => c.name).sort()).toEqual(['idle', 'talk', 'walk']);
    let meshes = 0;
    m.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
    expect(meshes).toBe(5);
  });

  it('stands at the height it is given, feet on the ground', async () => {
    const inst = instantiate(await load(), 1.23);
    inst.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inst.object);
    expect(box.max.y - box.min.y).toBeCloseTo(1.23, 2);
    expect(box.min.y).toBeCloseTo(0, 2);
  });

  it('poses from t alone: scrubbing back lands on the same frame', async () => {
    const inst = instantiate(await load(), 1);
    const arm = inst.object.getObjectByName('arm-left')!;
    const at = (action: 'walk' | 'run' | 'hide', t: number) => { inst.pose(action, t, 12); return arm.quaternion.clone(); };
    const first = at('walk', 0.37);
    at('walk', 0.9); at('hide', 0.1); at('walk', 0.02);
    // Compared by components: quantized rotations aren't exactly unit length, so angleTo isn't 0.
    expect(at('walk', 0.37).toArray()).toEqual(first.toArray());
    expect(Math.abs(at('walk', 0.37).x - at('walk', 0.4).x)).toBeGreaterThan(0.01); // and it does move
    expect(inst.pose('run', 0.5, 12)).toBe('walk');
    expect(inst.pose('hide', 0.5, 12)).toBe('idle');
    expect(inst.pose('talk', 0.5, 12)).toBe('talk');
  });

  it('plays nothing without clips, so the placeholder motion stays', async () => {
    const m = await load();
    expect(instantiate({ ...m, clips: [] }, 1).pose('walk', 0.5, 12)).toBeUndefined();
  });
});
