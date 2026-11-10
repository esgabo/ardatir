import * as THREE from 'three';
import type { Stage } from './stage';
import { clamp01, disposeTree, hash, pulse, ramp } from './util';
import { createCosmosWorld, fitCamera, Glows, nameLabel, showLabel, type CosmosLabels } from './cosmosWorld';
import {
  amanCoast, at, buildTree, E, ELDER, EZELLOHAR, fillDrops, Forest, heightsFor, landColor, N, S, Slab, toU, toV,
  type TreeParts,
} from './cosmosLands';
import { dreamWorld, pale } from './cosmosForetold';

/**
 * Foretold: the Mountains of Valinor are levelled. The Trees shine again on Ezellohar, but the
 * Pelóri still hold their light in; then the wall sinks to the plain in dust, and the light of
 * the Trees flows out over the whole world, to every shore. In it the Valar grow young and
 * bright, the Elves wake everywhere and their dead come out of the Halls of Mandos. Of Men the
 * prophecy says nothing; one light alone, Túrin's, stands among the Valar.
 *
 * Shown in the dream register of what is foretold (cosmosForetold.ts). Everything is a pure
 * function of `t`; `ambient` only drives dust, drops and twinkle.
 */

// Timeline (normalised event time), tuned against the passages in staging.yaml.
const T = {
  sink: [0.04, 0.22], dust: [0.03, 0.2, 0.34],
  flood: [0.25, 0.5],
  young: [0.5, 0.64], elves: [0.53, 0.72], dead: [0.55, 0.76],
  turin: [0.78, 0.84],
} as const;

const TREE_S = 0.95;
const CAM_D = 11;
const MANDOS = { u: -3.55, v: -0.55 };

export function createLevelledStage(labels: CosmosLabels): Stage {
  const slab = new Slab(26, 104, 5);
  const high = heightsFor(slab.gx, slab.gz, ELDER);
  const low = heightsFor(slab.gx, slab.gz, { ...ELDER, pelori: 0 });
  const raw = new Float32Array(slab.nv);
  const fu = Array.from(slab.fx, (x, f) => toU(x, slab.fz[f])), fv = Array.from(slab.fx, (x, f) => toV(x, slab.fz[f]));
  const dist = fu.map((u, f) => Math.hypot(u - EZELLOHAR.u, fv[f] - EZELLOHAR.v));
  const inValinor = fu.map((u, f) => u < amanCoast(fv[f]) - 0.4);
  const tris = slab.tris;

  const forest = new Forest(230, (u, v) => (u < amanCoast(v) - 0.6 ? 0.06 : u > -1.2 ? 0.3 : 0), 71);
  const forestY = forest.at.map((p) => Math.max(0, heightsFor(Float32Array.of(p.x), Float32Array.of(p.z), ELDER)[0]));

  // ---------- the mound and the Trees, shining ----------
  const moundAt = at(EZELLOHAR.u, EZELLOHAR.v, 0.06);
  const moundGeo = new THREE.CylinderGeometry(0.14, 0.42, 0.15, 9);
  moundGeo.translate(0, 0.075, 0);
  const mound = new THREE.Mesh(moundGeo, new THREE.MeshStandardMaterial({ color: '#6fbf50', flatShading: true, roughness: 0.8 }));
  mound.position.copy(moundAt);
  const side = new THREE.Vector3().copy(N).multiplyScalar(0.17);
  const telAt = moundAt.clone().add(side).setY(moundAt.y + 0.14);
  const lauAt = moundAt.clone().sub(side).setY(moundAt.y + 0.14);
  const tree = (p: TreeParts, base: THREE.Vector3, rot: number) => {
    p.group.position.copy(base); p.group.scale.setScalar(TREE_S); p.group.rotation.y = rot;
    p.glowMat.opacity = 1;
    p.leaves.emissive.copy(p.color).multiplyScalar(0.12);
    if (p.blossomMat) p.blossomMat.color.set('#ffd36a').multiplyScalar(1.5);
    return p;
  };
  const tel = tree(buildTree('telperion'), telAt, 0.5), lau = tree(buildTree('laurelin'), lauAt, 2.1);
  const treeLight = new THREE.PointLight('#fff1d0', 5, 0, 1.6);
  treeLight.position.copy(moundAt).setY(1.0);

  // Who wakes: the Elves everywhere on the land, their dead from the Halls of Mandos.
  const ELVES = 460, DEAD = 140, DUST = 360, DROPS = 140;
  const elfAt: THREE.Vector3[] = [];
  for (let k = 0; elfAt.length < ELVES && k < ELVES * 40; k++) {
    const r = Math.sqrt(hash(k, 1, 73)) * 3.7, a = hash(k, 2, 73) * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, u = toU(x, z);
    const h = heightsFor(Float32Array.of(x), Float32Array.of(z), { ...ELDER, pelori: 0 })[0];
    // Not in the far east, where Men woke: the prophecy is silent about them.
    if (h <= 0.02 || u > 2.2) continue;
    elfAt.push(new THREE.Vector3(x, h + 0.04, z));
  }
  const mandosAt = at(MANDOS.u, MANDOS.v, 0.1);
  const peloriPts: THREE.Vector3[] = [];
  for (let k = 0; peloriPts.length < 90 && k < 4000; k++) {
    const f = Math.floor(hash(k, 3, 74) * slab.nt);
    const g = (high[tris[f * 3]] + high[tris[f * 3 + 1]] + high[tris[f * 3 + 2]]) / 3;
    const l = (low[tris[f * 3]] + low[tris[f * 3 + 1]] + low[tris[f * 3 + 2]]) / 3;
    if (g - l > 0.25) peloriPts.push(new THREE.Vector3(slab.fx[f], l, slab.fz[f]));
  }
  const nP = ELVES + DEAD + DUST + DROPS * 2;
  const pPos = new Float32Array(nP * 3), pCol = new Float32Array(nP * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));

  let glows!: Glows;
  let dustPts!: THREE.Points;
  const dGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST * 3), dCol = new Float32Array(DUST * 3);
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
  const world = createCosmosWorld(labels, (scene, tex) => {
    scene.add(slab.top, slab.glow, slab.under, forest.mesh, mound, tel.group, lau.group, treeLight);
    glows = new Glows(tex, scene);
    dustPts = new THREE.Points(dGeo, new THREE.PointsMaterial({ size: 0.32, map: tex, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }));
    const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.1, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.renderOrder = 4;
    scene.add(dustPts, pts);
  });
  const { scene, camera, target, hemi, sun, tex, shells, starMat } = world;
  const dream = dreamWorld(world, 9);
  const treesGlow = glows.make('#fff1d0'), valinorGlow = glows.make('#ffe2a8'), worldGlow = glows.make('#fff4dc');
  const telGlow = glows.make(tel.color), lauGlow = glows.make(lau.color), mandosGlow = glows.make('#d6dcff');
  const valar = Array.from({ length: 14 }, () => glows.make('#fff4e0'));
  const turin = glows.make('#ff8a2a'), turinCore = glows.make('#fff0dc');

  target.copy(at(-1.9, 0.0, 0.25));
  const view = new THREE.Vector3().copy(S).addScaledVector(E, 0.75).normalize();
  camera.position.copy(target).addScaledVector(view, CAM_D * Math.cos(0.7)).setY(target.y + CAM_D * Math.sin(0.7));
  hemi.groundColor.set('#141a26');
  sun.intensity = 0;

  const peloriLabel = nameLabel(world, 'Pelóri', '');
  peloriLabel.position.copy(at(-2.5, -1.3, 1.1));
  const valinorLabel = nameLabel(world, 'Valinor');
  valinorLabel.position.copy(at(-3.3, 0.9, 0.55));
  const mandosLabel = nameLabel(world, 'Mandos', '');
  mandosLabel.position.copy(mandosAt).setY(0.55);
  const turinAt = moundAt.clone().addScaledVector(S, 1.0).addScaledVector(E, 0.8).setY(0.24);
  const turinLabel = nameLabel(world, 'Túrin');
  turinLabel.position.copy(turinAt).addScaledVector(E, 0.75).addScaledVector(S, 0.2).setY(turinAt.y + 0.1);

  const c = new THREE.Color(), v3 = new THREE.Vector3(), off = new THREE.Vector3();
  const mix = new THREE.Color('#fff1d0'), night = new THREE.Color('#283049'), elf = new THREE.Color('#d8e6ff'), dust = new THREE.Color('#bdb3c8');

  return {
    scene, camera, target,

    update(t, ambient) {
      // --- the Pelóri sink ---
      const sink = ramp(t, T.sink[0], T.sink[1]);
      for (let k = 0; k < slab.nv; k++) {
        raw[k] = high[k] + (low[k] - high[k]) * sink;
        slab.gy[k] = Math.max(0, raw[k]);
      }
      // --- the light flows out: a front from Ezellohar across the world ---
      const f0 = ramp(t, T.flood[0], T.flood[1]);
      const front = f0 * 7.2;
      slab.update((f, water, _y, col, glow) => {
        const r = (raw[tris[f * 3]] + raw[tris[f * 3 + 1]] + raw[tris[f * 3 + 2]]) / 3;
        landColor(fu[f], fv[f], r, slab.seed[f], col);
        pale(col, water ? 0.06 : 0.15);
        // Before: only Valinor is lit, behind its wall.
        const inside = inValinor[f] ? clamp01(1 - dist[f] / 1.6) * 0.8 + 0.25 : 0;
        const reached = clamp01((front - dist[f]) / 0.6);
        const edge = pulse(front - dist[f], 0, 0.15, 0.9);
        const lit = Math.max(inside, reached);
        col.lerp(night, 0.5 * (1 - lit));
        glow.copy(mix).multiplyScalar((water ? 0.04 : 0.018) * lit + 0.12 * edge);
        return true;
      });
      forest.update((i) => forestY[i], (i) => (forestY[i] > 0.03 ? 1 : 0));

      // --- the Trees ---
      const tw = 0.95 + 0.05 * Math.sin(ambient * 1.7);
      Glows.set(telGlow, v3.copy(telAt).setY(telAt.y + 0.75 * TREE_S), 1.6, 0.5 * tw);
      Glows.set(lauGlow, v3.copy(lauAt).setY(lauAt.y + 0.75 * TREE_S), 1.6, 0.5 * tw);
      Glows.set(treesGlow, v3.copy(moundAt).setY(1.0), 2.8 + 1.5 * f0, 0.22 - 0.06 * f0);
      Glows.set(valinorGlow, v3.copy(moundAt).setY(0.6), 3 + 3 * sink, 0.22 * (1 - 0.85 * f0));
      Glows.set(worldGlow, at(0, 0.3, 1.2, v3), 9, 0.08 * ramp(t, T.flood[0] + 0.1, T.flood[1] + 0.05));
      treeLight.intensity = 5 + 3 * f0;

      // --- the Valar made young, Túrin among them ---
      const young = ramp(t, T.young[0], T.young[1]);
      valar.forEach((g, i) => {
        const a = (i / valar.length) * Math.PI * 2 + 0.2;
        Glows.set(g, v3.copy(moundAt).add(off.set(Math.cos(a) * 0.95, 0.12 + 0.08 * young, Math.sin(a) * 0.95)), 0.2 + 0.14 * young, (0.22 + 0.4 * young) * (0.92 + 0.08 * Math.sin(ambient * 1.3 + i)));
      });
      const tu = ramp(t, T.turin[0], T.turin[1]);
      Glows.set(turin, turinAt, 0.75, 1.0 * tu * (0.9 + 0.1 * Math.sin(ambient * 1.1)));
      Glows.set(turinCore, turinAt, 0.16, 1.0 * tu);

      // --- the Elves wake, and their dead come out of Mandos ---
      let i = 0;
      for (let e = 0; e < ELVES; e++, i++) {
        const p = elfAt[e % elfAt.length];
        const d = Math.hypot(toU(p.x, p.z) - EZELLOHAR.u, toV(p.x, p.z) - EZELLOHAR.v);
        // Each wakes as the light reaches it, during the waking.
        const k = clamp01((ramp(t, T.elves[0], T.elves[1]) * 1.3 - d / 7.2 * 0.7 - hash(e, 4, 73) * 0.3) * 4);
        pPos.set([p.x, p.y + 0.06 * k, p.z], i * 3);
        const b = k * (0.6 + 0.4 * Math.sin(ambient * 1.6 + e));
        pCol.set([elf.r * b, elf.g * b, elf.b * b], i * 3);
      }
      for (let d = 0; d < DEAD; d++, i++) {
        const s = clamp01((t - T.dead[0]) / (T.dead[1] - T.dead[0]) * 1.4 - hash(d, 1, 75) * 0.4);
        v3.lerpVectors(mandosAt, moundAt, s * 0.82);
        v3.addScaledVector(N, (hash(d, 2, 75) - 0.5) * 0.35 * (1 - s * 0.5)).addScaledVector(E, (hash(d, 3, 75) - 0.5) * 0.12);
        v3.y = 0.14 + 0.03 * Math.sin(ambient * 2 + d);
        v3.toArray(pPos, i * 3);
        const b = (s > 0 ? 1 : 0) * (0.5 + 0.5 * Math.sin(s * Math.PI * 0.9 + 0.3)) * 0.75;
        pCol.set([elf.r * b, elf.g * b, elf.b * b], i * 3);
      }
      Glows.set(mandosGlow, v3.copy(mandosAt).setY(0.25), 1.3, 0.35 * pulse(t, T.dead[0] - 0.02, T.dead[0] + 0.05, T.dead[1]));
      fillDrops(pPos, pCol, i, DROPS, telAt, TREE_S, ambient, tel.color, 0.8, 8);
      fillDrops(pPos, pCol, i + DROPS, DROPS, lauAt, TREE_S, ambient, lau.color, 0.8, 9);
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      pGeo.computeBoundingSphere();

      // Dust off the falling mountains.
      const dk = pulse(t, T.dust[0], T.dust[1], T.dust[2]);
      for (let d = 0; d < DUST; d++) {
        const p = peloriPts[d % peloriPts.length];
        const h1 = hash(d, 1, 76), h2 = hash(d, 2, 76);
        const life = (ambient * 0.12 + h1) % 1;
        dPos.set([p.x + (h2 - 0.5) * 0.5 + life * 0.2, p.y + 0.1 + life * 0.9, p.z + (hash(d, 3, 76) - 0.5) * 0.5], d * 3);
        const b = dk * Math.sin(life * Math.PI);
        c.copy(dust).multiplyScalar(b);
        dCol.set([c.r, c.g, c.b], d * 3);
      }
      (dustPts.material as THREE.PointsMaterial).opacity = 0.55 * dk;
      dustPts.visible = dk > 0.005;
      dGeo.attributes.position.needsUpdate = true;
      dGeo.attributes.color.needsUpdate = true;
      dGeo.computeBoundingSphere();

      // --- names ---
      showLabel(peloriLabel, ramp(t, 0.01, 0.05) * (1 - ramp(t, 0.18, 0.24)));
      showLabel(valinorLabel, ramp(t, 0.02, 0.06) * (1 - ramp(t, 0.3, 0.36)));
      showLabel(mandosLabel, ramp(t, T.dead[0], T.dead[0] + 0.04) * (1 - ramp(t, T.dead[1] - 0.02, T.dead[1] + 0.02)));
      showLabel(turinLabel, ramp(t, T.turin[0] + 0.01, T.turin[1] + 0.01));

      // --- sky: no Sun, no Moon; the light of the Trees on everything ---
      hemi.color.set('#8890c8').lerp(c.set('#fff0d8'), 0.5 * f0);
      hemi.intensity = 0.5 + 0.25 * f0;
      starMat.opacity = (0.75 - 0.35 * f0) * (0.85 + 0.15 * Math.sin(ambient * 2));
      shells.forEach((sh, si) => {
        sh.mat.uniforms.uOpacity.value = sh.strength * (0.6 + (si === 0 ? 0.12 * f0 : 0));
        sh.mesh.visible = true;
      });
      (shells[0].mat.uniforms.uColor.value as THREE.Color).set('#8fd0ff').lerp(c.set('#ffe2b0'), 0.35 * f0);
      dream.update(ambient);
      glows.face(camera);
    },

    flash: () => 0,

    resize(w, h) { fitCamera(camera, target, w, h, CAM_D, 3.4); },

    dispose() {
      for (const l of world.labels) l.element.remove();
      disposeTree(scene);
      tex.dispose();
    },
  };
}
