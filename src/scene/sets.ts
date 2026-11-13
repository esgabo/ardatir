// A place built for an event (staging.yaml `set`, a kit .glb from assets/kits/): the whole
// diorama tile in place of the generic one, with what makes it alive: lamps and windows that
// light up as the light fades, chimney smoke, waterfall spray, fireflies at dusk. Loaded with
// a dynamic import() from dioramaStage.ts, so it shares the models chunk.
//
// What the kit names (scripts/models/blender/shire.py): `terrain` (walkable ground), materials
// `glow-*` (lit by `Light.lamps`), and empty markers `fx-smoke`, `fx-spray`, `fx-fireflies-*`,
// `fx-lamp-*`, `fx-fire`. Story state comes from the light (a function of t); `ambient` seconds
// only move the smoke, spray, flames and fireflies.

import * as THREE from 'three';
import type { Light } from './lighting';
import { loadModel } from './models';

export interface SetInstance {
  object: THREE.Object3D;
  /** `figures`: where the characters stand at this t (a door opens while one is near it). */
  update(light: Light, ambient: number, figures: readonly THREE.Vector3[]): void;
  dispose(): void;
}

const SMOKE_PUFFS = 9;
const FIREFLIES = 9;

/** A tiny repeatable hash in [0, 1). */
function rnd(i: number, k: number): number {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export async function loadSet(url: string): Promise<SetInstance> {
  const model = await loadModel(url);
  const object = model.scene.clone(true);
  object.name = 'set';
  const owned: { dispose(): void }[] = [];

  // Glowing materials: their own copies, so the cached model stays untouched.
  const glows: { mat: THREE.MeshStandardMaterial; base: number; fire: boolean }[] = [];
  const copies = new Map<THREE.Material, THREE.Material>();
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.name !== 'terrain';
    mesh.receiveShadow = true;
    const swap = (m: THREE.Material) => {
      if (!m.name.startsWith('glow-')) return m;
      let c = copies.get(m);
      if (!c) {
        const mat = (m as THREE.MeshStandardMaterial).clone();
        copies.set(m, mat);
        owned.push(mat);
        glows.push({ mat, base: mat.emissiveIntensity || 1, fire: m.name.startsWith('glow-fire') });
        c = mat;
      }
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    if (mesh.name !== 'terrain') mesh.raycast = () => {}; // only the ground is picked or stood on
  });

  const marker = (prefix: string) => {
    const out: THREE.Object3D[] = [];
    object.traverse((o) => { if (o.name.startsWith(prefix)) out.push(o); });
    return out;
  };

  // Warm lights at the lamps, a flickering one at the hearth.
  const lamps: { light: THREE.PointLight; fire: boolean }[] = [];
  for (const m of [...marker('fx-lamp-'), ...marker('fx-fire').filter((o) => o.name === 'fx-fire')]) {
    const fire = m.name === 'fx-fire';
    const light = new THREE.PointLight(fire ? '#ff8a3a' : '#ffbe70', 0, fire ? 3.2 : 3.6, 1.6);
    m.add(light);
    lamps.push({ light, fire });
  }

  // Smoke: faceted puffs rising from the chimney, drifting, growing and fading.
  const smokeMat = new THREE.MeshStandardMaterial({ color: '#d8d4cc', flatShading: true, transparent: true, depthWrite: false, roughness: 1 });
  const puffGeo = new THREE.IcosahedronGeometry(0.12, 0);
  owned.push(smokeMat, puffGeo);
  const smoke = marker('fx-smoke').map((m) => {
    const group = new THREE.Group();
    const puffs = Array.from({ length: SMOKE_PUFFS }, (_, i) => {
      const puff = new THREE.Mesh(puffGeo, smokeMat.clone());
      owned.push(puff.material as THREE.Material);
      puff.rotation.set(rnd(i, 1) * 6, rnd(i, 2) * 6, 0);
      group.add(puff);
      return puff;
    });
    m.add(group);
    return puffs;
  });

  // Spray at the foot of the waterfall, and fireflies: soft points.
  const dotGeo = (n: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    owned.push(g);
    return g;
  };
  const sprayMat = new THREE.PointsMaterial({ color: '#eef8fb', size: 0.07, transparent: true, opacity: 0.85, depthWrite: false });
  const flyMat = new THREE.PointsMaterial({ color: '#f4ff9a', size: 0.08, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  owned.push(sprayMat, flyMat);
  const spray = marker('fx-spray').map((m) => {
    const pts = new THREE.Points(dotGeo(40), sprayMat);
    m.add(pts);
    return pts;
  });
  const flies = marker('fx-fireflies').map((m) => {
    const pts = new THREE.Points(dotGeo(FIREFLIES), flyMat);
    m.add(pts);
    return pts;
  });

  // Doors: objects named `door*`, hinged at their origin, the leaf along +x; they swing inward
  // (towards -z) while anyone is within reach, so nobody walks through a closed door.
  const doors = marker('door').map((d) => {
    const box = new THREE.Box3().setFromObject(d);
    return { d, centre: box.getCenter(new THREE.Vector3()), rest: d.rotation.y };
  });

  return {
    object,
    update(light, ambient, figures) {
      for (const { d, centre, rest } of doors) {
        let near = Infinity;
        for (const f of figures) near = Math.min(near, Math.hypot(f.x - centre.x, f.z - centre.z));
        const open = 1 - Math.min(1, Math.max(0, (near - 0.55) / 0.6));
        d.rotation.y = rest + 1.7 * open * open * (3 - 2 * open);
      }
      for (const g of glows) {
        const flicker = g.fire ? 0.85 + 0.15 * Math.sin(ambient * 9.1) * Math.sin(ambient * 5.3 + 1) : 1;
        // fires always glow a little; windows and lamps only as the light goes
        g.mat.emissiveIntensity = g.base * (g.fire ? 0.6 + 1.4 * light.lamps : light.lamps * 1.6) * flicker;
      }
      for (const l of lamps) {
        const flicker = l.fire ? 0.8 + 0.2 * Math.sin(ambient * 11.3) * Math.sin(ambient * 6.7 + 2) : 1;
        l.light.intensity = (l.fire ? 1.5 + 4 * light.lamps : 5 * light.lamps) * flicker;
      }
      for (const puffs of smoke) {
        puffs.forEach((p, i) => {
          const age = (ambient * 0.18 + i / SMOKE_PUFFS) % 1;
          p.position.set(Math.sin(i * 2.1 + ambient * 0.5) * 0.08 + age * 0.9, age * 1.8, Math.cos(i * 1.7) * 0.08 + age * 0.35);
          p.scale.setScalar(0.6 + age * 2.2);
          (p.material as THREE.MeshStandardMaterial).opacity = 0.55 * Math.sin(Math.PI * Math.min(1, age * 1.15));
        });
      }
      for (const pts of spray) {
        const a = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < a.count; i++) {
          const age = (ambient * 0.9 + rnd(i, 3)) % 1;
          const ang = rnd(i, 4) * Math.PI * 2;
          const r = 0.1 + age * 0.45;
          a.setXYZ(i, Math.cos(ang) * r, age * 0.5 - age * age * 0.6, Math.sin(ang) * r * 0.6);
        }
        a.needsUpdate = true;
      }
      flyMat.opacity = light.fireflies;
      for (const [k, pts] of flies.entries()) {
        pts.visible = light.fireflies > 0.01;
        if (!pts.visible) continue;
        const a = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < a.count; i++) {
          const s = ambient * (0.25 + rnd(i, k) * 0.3);
          a.setXYZ(i, Math.sin(s + i * 2.3) * (0.6 + rnd(i, 7)), Math.sin(s * 1.7 + i) * 0.25, Math.cos(s * 0.8 + i * 1.1) * (0.6 + rnd(i, 8)));
        }
        a.needsUpdate = true;
      }
    },
    dispose() {
      object.removeFromParent();
      for (const d of owned) d.dispose();
    },
  };
}
