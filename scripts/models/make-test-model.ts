// Writes the tiny test model the fixture uses (tests/fixtures/valid/assets/characters/test-figure/),
// so the model pipeline is tested end to end without a Blender file: three.js's GLTFExporter
// writes a .glb, then gltfpack compresses it with meshopt exactly as `npm run model:pack` does
// for real exports. Only for tests: never give it to a real character. See docs/MODELS.md.
//
//   node scripts/models/make-test-model.ts

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { pack } from './pack.ts';

// GLTFExporter reads its output Blob with a FileReader, which Node doesn't have.
class NodeFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); });
  }
}
(globalThis as Record<string, unknown>).FileReader ??= NodeFileReader;

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, 'tests/fixtures/valid/assets/characters/test-figure/test-figure.glb');

/** Flat-shaded part: non-indexed, so each face keeps its own normal (the faceted look). */
function part(name: string, geo: THREE.BufferGeometry, color: string, y: number): THREE.Mesh {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  m.name = name;
  m.position.y = y;
  return m;
}

// A 1.2 m cloaked figure with a tall hat, feet on the origin, facing +Z (glTF forward).
// Unmistakable next to the placeholders: a blue cone cloak, a red hat, two swinging arms.
const figure = new THREE.Group();
figure.name = 'test-figure';
const body = new THREE.Group();
body.name = 'body';
body.add(
  part('cloak', new THREE.ConeGeometry(0.28, 0.8, 7), '#2f5fd0', 0.4),
  part('head', new THREE.IcosahedronGeometry(0.13, 0), '#e0b48f', 0.9),
  part('hat', new THREE.ConeGeometry(0.17, 0.32, 6), '#b8322a', 1.13),
);
const arm = (side: 1 | -1) => {
  const pivot = new THREE.Group();
  pivot.name = side > 0 ? 'arm-left' : 'arm-right';
  pivot.position.set(0.17 * side, 0.68, 0);
  const a = part(`${pivot.name}-mesh`, new THREE.BoxGeometry(0.07, 0.38, 0.07), '#2a4fa8', -0.19);
  pivot.add(a);
  return pivot;
};
const left = arm(1), right = arm(-1);
body.add(left, right);
figure.add(body);

const q = (x: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, 0, 0)).toArray() as number[];
const swing = (name: string, amp: number, len: number, steps = 8) => {
  const times: number[] = [], values: number[] = [];
  for (let i = 0; i <= steps; i++) { const tt = (i / steps) * len; times.push(tt); values.push(...q(Math.sin((i / steps) * Math.PI * 2) * amp)); }
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
};
const counter = (name: string, amp: number, len: number, steps = 8) => {
  const t = swing(name, amp, len, steps);
  for (let i = 0; i < t.values.length; i += 4) { t.values[i] = -t.values[i]; } // opposite phase
  return t;
};
const bob = (amp: number, len: number) => new THREE.VectorKeyframeTrack(
  'body.position', [0, len / 4, len / 2, (3 * len) / 4, len], [0, 0, 0, 0, amp, 0, 0, 0, 0, 0, amp, 0, 0, 0, 0],
);

const clips = [
  new THREE.AnimationClip('idle', 2, [swing('arm-left', 0.06, 2), counter('arm-right', 0.06, 2)]),
  new THREE.AnimationClip('walk', 1, [swing('arm-left', 0.6, 1), counter('arm-right', 0.6, 1), bob(0.04, 1)]),
  new THREE.AnimationClip('talk', 1.5, [new THREE.QuaternionKeyframeTrack('arm-right.quaternion', [0, 0.75, 1.5], [...q(-0.4), ...q(-1.1), ...q(-0.4)])]),
];

const glb = await new GLTFExporter().parseAsync(figure, { binary: true, animations: clips }) as ArrayBuffer;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ardatir-model-'));
const raw = path.join(tmp, 'test-figure.glb');
fs.writeFileSync(raw, Buffer.from(glb));
fs.mkdirSync(path.dirname(out), { recursive: true });
await pack(raw, out);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${path.relative(root, out)} (${fs.statSync(out).size} bytes, from ${glb.byteLength} uncompressed)`);
