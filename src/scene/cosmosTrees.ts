import * as THREE from 'three';
import type { Stage } from './stage';
import { clamp01, disposeTree, hash, pulse, ramp } from './util';
import { createCosmosWorld, fitCamera, Glows, nameLabel, showLabel, type CosmosLabels } from './cosmosWorld';
import {
  at, buildTree, E, CALACIRYA, ELDER, ERESSEA, EZELLOHAR, fillDrops, Forest, heightsFor, landColor, N, S, toU, toV, VALMAR,
  amanCoast, meCoast, Slab,
} from './cosmosLands';

/**
 * The Two Trees of Valinor: after the Lamps, the Valar raise the Pelóri along the coast of
 * Aman and make Valinor behind them; Yavanna sings on the green mound Ezellohar while Nienna
 * waters it with tears; silver Telperion grows, then golden Laurelin, and their lights wax
 * and wane in turn, mingling twice a day. Middle-earth lies dark under the stars beyond.
 *
 * Everything is a pure function of `t`; `ambient` only drives drifting motes and drops.
 */

// Timeline (normalised event time), tuned against the passages in staging.yaml.
const T = {
  pelori: [0.03, 0.15], valinor: [0.08, 0.2], valmar: [0.12, 0.2],
  mound: [0.22, 0.27], valar: [0.24, 0.3], song: [0.25, 0.3], tears: [0.29, 0.34], songEnd: [0.42, 0.5],
  shoots: [0.42, 0.45], telperion: [0.43, 0.54], telLight: [0.48, 0.58],
  laurelin: [0.62, 0.72], lauLight: [0.67, 0.76],
  cycle: [0.81, 1.0],
} as const;

const TREE_S = 1.3;
const CAM_D = 13;
const MOUND_H = 0.15;

export function createTreesStage(labels: CosmosLabels): Stage {
  const slab = new Slab(26, 104, 5);
  const before = heightsFor(slab.gx, slab.gz, { ...ELDER, pelori: 0 });
  const after = heightsFor(slab.gx, slab.gz, ELDER);
  const raw = new Float32Array(slab.nv);
  const fu = Array.from(slab.fx, (x, f) => toU(x, slab.fz[f])), fv = Array.from(slab.fx, (x, f) => toV(x, slab.fz[f]));
  const inValinor = fu.map((u, f) => u < amanCoast(fv[f]) - 0.45);
  const dark = new THREE.Color('#5d6b55');

  // Forests of Middle-earth, dark under the stars; a few in Valinor.
  const forest = new Forest(260, (u, v) => (u > meCoast(v) + 0.15 ? 0.35 : u < amanCoast(v) - 0.6 ? 0.05 : 0), 61);
  const forestY = forest.at.map((p) => Math.max(0, heightsFor(Float32Array.of(p.x), Float32Array.of(p.z), ELDER)[0]));

  // ---------- Ezellohar, Valmar, the Two Trees ----------
  const moundAt = at(EZELLOHAR.u, EZELLOHAR.v, 0.06);
  const moundGeo = new THREE.CylinderGeometry(0.14, 0.42, MOUND_H, 9);
  moundGeo.translate(0, MOUND_H / 2, 0);
  const mound = new THREE.Mesh(moundGeo, new THREE.MeshStandardMaterial({ color: '#6fbf50', flatShading: true, roughness: 0.8 }));
  mound.position.copy(moundAt);

  const valmar = new THREE.Group();
  const hallMat = new THREE.MeshStandardMaterial({ color: '#f4ead6', flatShading: true, roughness: 0.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#d9b25c', flatShading: true, roughness: 0.45, metalness: 0.2 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = i === 0 ? 0 : 0.1 + hash(i, 1, 72) * 0.08;
    const h = i === 0 ? 0.2 : 0.06 + hash(i, 2, 72) * 0.07, w = i === 0 ? 0.04 : 0.025 + hash(i, 3, 72) * 0.015;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(w, w * 1.1, h, 6), hallMat);
    body.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 1.4, w * 2.2, 6), roofMat);
    roof.position.set(Math.cos(a) * r, h + w * 1.1, Math.sin(a) * r);
    valmar.add(body, roof);
  }
  const valmarAt = at(VALMAR.u, VALMAR.v, 0.07);
  valmar.position.copy(valmarAt);

  const tel = buildTree('telperion'), lau = buildTree('laurelin');
  const side = new THREE.Vector3().copy(N).multiplyScalar(0.17);
  const telAt = moundAt.clone().add(side).setY(moundAt.y + MOUND_H - 0.01);
  const lauAt = moundAt.clone().sub(side).setY(moundAt.y + MOUND_H - 0.01);
  tel.group.position.copy(telAt);
  lau.group.position.copy(lauAt);
  tel.group.rotation.y = 0.5; lau.group.rotation.y = 2.1;
  const telLight = new THREE.PointLight(tel.color, 0, 0, 1.6);
  const lauLight = new THREE.PointLight(lau.color, 0, 0, 1.6);
  const valarLight = new THREE.PointLight('#ffe9c0', 0, 0, 1.8);
  valarLight.position.copy(moundAt).setY(1.2);

  // Motes of Yavanna's song, Nienna's tears, and the light dripping from the Trees.
  const MOTES = 220, TEARS = 140, DROPS = 220;
  const nP = MOTES + TEARS + DROPS * 2;
  const pPos = new Float32Array(nP * 3), pCol = new Float32Array(nP * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const songCol = new THREE.Color('#c8f08a'), songGold = new THREE.Color('#ffe7a0'), tearCol = new THREE.Color('#a8d4ff');

  let glows!: Glows;
  let points!: THREE.Points;
  const world = createCosmosWorld(labels, (scene, tex) => {
    scene.add(slab.top, slab.glow, slab.under, forest.mesh, mound, valmar, tel.group, lau.group, telLight, lauLight, valarLight);
    glows = new Glows(tex, scene);
    points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.07, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(points);
  });
  const { scene, camera, target, hemi, sun, tex, shells, starMat } = world;
  const telGlow = glows.make(tel.color), lauGlow = glows.make(lau.color), mingleGlow = glows.make('#fff1d0');
  const yavanna = glows.make('#b8f07a'), valinorGlow = glows.make('#ffe2a8');
  const passGlows = [0, 1, 2].map(() => glows.make('#fff0d0'));
  const valar = Array.from({ length: 12 }, () => glows.make('#fff4e0'));

  target.copy(at(-2.35, 0.05, 0.35));
  const view = new THREE.Vector3().copy(E).addScaledVector(S, 0.32).normalize();
  camera.position.copy(target).addScaledVector(view, CAM_D * Math.cos(0.9)).setY(target.y + CAM_D * Math.sin(0.9));
  hemi.color.set('#9fb0d8'); hemi.groundColor.set('#141a26');
  sun.color.set('#9fb4e8');
  sun.position.set(-4, 9, 6);

  const valinorLabel = nameLabel(world, 'Valinor');
  valinorLabel.position.copy(at(-3.45, 0.95, 0.35));
  const peloriLabel = nameLabel(world, 'Pelóri', '');
  peloriLabel.position.copy(at(-2.6, -1.25, 1.25));
  const moundLabel = nameLabel(world, 'Ezellohar', '');
  moundLabel.position.copy(moundAt).add(new THREE.Vector3().copy(S).multiplyScalar(0.42)).setY(0.02);
  const telLabel = nameLabel(world, 'Telperion');
  const lauLabel = nameLabel(world, 'Laurelin');

  const c = new THREE.Color(), v3 = new THREE.Vector3(), off = new THREE.Vector3();
  // Light carried through the Calacirya onto the Bay of Eldamar and Tol Eressëa: u, v, height, size.
  const PASS_AT = [[CALACIRYA.u + 0.05, CALACIRYA.v, 0.35, 1.4], [CALACIRYA.u + 0.42, CALACIRYA.v - 0.02, 0.15, 1.8], [ERESSEA.u, ERESSEA.v, 0.22, 1.5]] as const;
  const mix = new THREE.Color();

  return {
    scene, camera, target,

    update(t, ambient) {
      // --- the lights of the Trees: grow, then wax and wane in turn ---
      const telGrow = ramp(t, T.telperion[0], T.telperion[1]), lauGrow = ramp(t, T.laurelin[0], T.laurelin[1]);
      const shoots = ramp(t, T.shoots[0], T.shoots[1]);
      const cyc = ramp(t, T.cycle[0], T.cycle[0] + 0.03);
      const phase = (t - T.cycle[0]) / (T.cycle[1] - T.cycle[0]);
      const wave = 0.5 + 0.5 * Math.cos(phase * Math.PI * 2);
      let telK = ramp(t, T.telLight[0], T.telLight[1]), lauK = ramp(t, T.lauLight[0], T.lauLight[1]);
      telK *= 1 - cyc + cyc * (0.12 + 0.88 * wave);
      lauK *= 1 - cyc + cyc * (0.12 + 0.88 * (1 - wave));
      // While Laurelin grows, Telperion's light softens a little, so each has its moment.
      telK *= 1 - 0.35 * pulse(t, T.laurelin[0], T.lauLight[0] + 0.03, T.cycle[0]);
      const light = Math.max(telK, lauK);
      const mingling = cyc * clamp01(1 - Math.abs(telK - lauK) * 2.2) * Math.min(telK, lauK) * 2.2;
      mix.copy(tel.color).multiplyScalar(telK).add(c.copy(lau.color).multiplyScalar(lauK));
      const mixMax = Math.max(mix.r, mix.g, mix.b, 1e-3);
      mix.multiplyScalar(1 / mixMax);

      // --- the land: the Pelóri rise, Valinor greens ---
      const pel = ramp(t, T.pelori[0], T.pelori[1]);
      for (let k = 0; k < slab.nv; k++) {
        raw[k] = before[k] + (after[k] - before[k]) * pel;
        slab.gy[k] = Math.max(0, raw[k]);
      }
      const green = ramp(t, T.valinor[0], T.valinor[1]);
      const tris = slab.tris;
      slab.update((f, water, _y, col, glow) => {
        const r = (raw[tris[f * 3]] + raw[tris[f * 3 + 1]] + raw[tris[f * 3 + 2]]) / 3;
        landColor(fu[f], fv[f], r, slab.seed[f], col);
        if (inValinor[f] && !water) col.lerp(dark, 1 - green);
        // The Trees' light on the plain of Valinor and out through the Calacirya.
        const du = fu[f] - EZELLOHAR.u, dv = fv[f] - EZELLOHAR.v;
        const near = clamp01(1 - Math.hypot(du, dv) / 1.3) * (fu[f] < amanCoast(fv[f]) - 0.2 ? 1 : 0.15);
        const pass = clamp01(1 - Math.abs(fv[f] - CALACIRYA.v + 0.05 * (fu[f] - CALACIRYA.u)) / (0.18 + 0.12 * Math.max(0, fu[f] - CALACIRYA.u))) * clamp01(1 - (fu[f] - CALACIRYA.u) / 1.1) * (fu[f] > CALACIRYA.u - 0.3 ? 1 : 0);
        const lit = light * Math.max(near * near, pass * 0.6);
        if (lit > 0.003) glow.copy(mix).multiplyScalar(lit * (water ? 0.16 : 0.12));
        return true;
      });

      forest.update((i) => forestY[i], (i) => (forestY[i] > 0.03 ? 1 : 0));

      // --- Valinor's halls and the mound ---
      const vm = ramp(t, T.valmar[0], T.valmar[1]);
      valmar.scale.set(1, Math.max(0.001, vm), 1);
      valmar.visible = vm > 0;
      const md = ramp(t, T.mound[0], T.mound[1]);
      mound.scale.set(0.6 + 0.4 * md, Math.max(0.001, md), 0.6 + 0.4 * md);
      mound.visible = md > 0;
      Glows.set(valinorGlow, v3.copy(valmarAt).setY(0.6), 2.6, 0.22 * pulse(t, T.valinor[0], T.valinor[1], T.telLight[1]));
      valarLight.intensity = 1.6 * green * (1 - ramp(t, T.telLight[0], T.telLight[1]));

      // --- the Trees ---
      const place = (p: typeof tel, grow: number, k: number, lightObj: THREE.PointLight, glow: THREE.Mesh, base: THREE.Vector3) => {
        const s = TREE_S * Math.max(0.001, Math.max(grow, shoots * 0.07));
        p.group.scale.setScalar(s);
        p.group.visible = shoots > 0;
        p.glowMat.opacity = k;
        p.leaves.emissive.copy(p.color).multiplyScalar(0.12 * k);
        const top = v3.copy(p.crown).multiplyScalar(s).add(base);
        lightObj.position.copy(top).setY(top.y + 0.25);
        lightObj.color.copy(p.color);
        lightObj.intensity = k * 5.5;
        Glows.set(glow, top.setY(top.y + 0.18 * s), 1.6 * s + 0.5, k * 0.5 * (0.95 + 0.05 * Math.sin(ambient * 1.7)));
      };
      place(tel, telGrow, telK, telLight, telGlow, telAt);
      place(lau, lauGrow, lauK, lauLight, lauGlow, lauAt);
      if (lau.blossomMat) lau.blossomMat.color.set('#5a4a2a').lerp(c.set('#ffd36a'), lauK).multiplyScalar(1 + lauK * 0.5);
      Glows.set(mingleGlow, v3.copy(moundAt).setY(moundAt.y + 1.0), 4.5, mingling * 0.45);

      // Light carried through the Calacirya onto the Bay of Eldamar and Tol Eressëa.
      passGlows.forEach((g, i) => Glows.set(g, at(PASS_AT[i][0], PASS_AT[i][1], PASS_AT[i][2], v3), PASS_AT[i][3], light * 0.12));
      (passGlows[0].material as THREE.MeshBasicMaterial).color.copy(mix);
      (passGlows[1].material as THREE.MeshBasicMaterial).color.copy(mix);
      (passGlows[2].material as THREE.MeshBasicMaterial).color.copy(mix);

      // --- Yavanna's song, the Valar in silence, Nienna's tears ---
      const song = ramp(t, T.song[0], T.song[1]) * (1 - ramp(t, T.songEnd[0], T.songEnd[1]) * 0.85);
      const tears = ramp(t, T.tears[0], T.tears[1]) * (1 - ramp(t, T.songEnd[0], T.songEnd[1]));
      const moundTop = moundAt.y + MOUND_H * md;
      Glows.set(yavanna, v3.copy(moundAt).setY(moundTop + 0.12), 0.9, song * 0.8 * (0.9 + 0.1 * Math.sin(ambient * 2.3)));
      const valarOn = ramp(t, T.valar[0], T.valar[1]) * (1 - 0.6 * ramp(t, T.cycle[0], T.cycle[1]));
      valar.forEach((g, i) => {
        const a = (i / valar.length) * Math.PI * 2 + 0.3;
        const p = v3.copy(moundAt).add(off.set(Math.cos(a) * 0.72, 0.1, Math.sin(a) * 0.72));
        Glows.set(g, p, 0.32, valarOn * 0.55);
      });
      let i = 0;
      for (let m = 0; m < MOTES; m++, i++) {
        const h1 = hash(m, 1, 5), h2 = hash(m, 2, 5);
        const life = (ambient * 0.1 + h1) % 1;
        const ang = h2 * Math.PI * 2 + life * 5, rr = 0.08 + life * 0.55;
        pPos[i * 3] = moundAt.x + Math.cos(ang) * rr;
        pPos[i * 3 + 1] = moundTop + 0.05 + life * 1.5;
        pPos[i * 3 + 2] = moundAt.z + Math.sin(ang) * rr;
        c.copy(songCol).lerp(songGold, h2);
        const b = song * Math.sin(life * Math.PI) * 0.8;
        pCol[i * 3] = c.r * b; pCol[i * 3 + 1] = c.g * b; pCol[i * 3 + 2] = c.b * b;
      }
      for (let m = 0; m < TEARS; m++, i++) {
        const h1 = hash(m, 1, 6), h2 = hash(m, 2, 6), h3 = hash(m, 3, 6);
        const life = (ambient * (0.22 + 0.1 * h3) + h1) % 1;
        const ang = h2 * Math.PI * 2, rr = 0.06 + Math.sqrt(h3) * 0.32;
        pPos[i * 3] = moundAt.x + Math.cos(ang) * rr;
        pPos[i * 3 + 1] = moundTop + 1.9 * (1 - life);
        pPos[i * 3 + 2] = moundAt.z + Math.sin(ang) * rr;
        const b = tears * (0.3 + 0.7 * life) * 0.7;
        pCol[i * 3] = tearCol.r * b; pCol[i * 3 + 1] = tearCol.g * b; pCol[i * 3 + 2] = tearCol.b * b;
      }
      fillDrops(pPos, pCol, i, DROPS, telAt, TREE_S * telGrow, ambient, tel.color, telK * 0.9, 8);
      fillDrops(pPos, pCol, i + DROPS, DROPS, lauAt, TREE_S * lauGrow, ambient, lau.color, lauK * 0.9, 9);
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      pGeo.computeBoundingSphere();

      // --- names ---
      showLabel(valinorLabel, ramp(t, 0.06, 0.1) * (1 - ramp(t, 0.4, 0.44)));
      showLabel(peloriLabel, ramp(t, 0.11, 0.15) * (1 - ramp(t, 0.4, 0.44)));
      showLabel(moundLabel, ramp(t, 0.25, 0.29) * (1 - ramp(t, 0.6, 0.64)));
      telLabel.position.copy(telAt).addScaledVector(N, 0.45).setY(telAt.y + 1.25 * TREE_S * telGrow + 0.15);
      lauLabel.position.copy(lauAt).addScaledVector(S, 0.45).setY(lauAt.y + 1.25 * TREE_S * lauGrow + 0.15);
      showLabel(telLabel, ramp(t, 0.47, 0.51));
      showLabel(lauLabel, ramp(t, 0.66, 0.7));

      // --- sky: starlight over Middle-earth, the shells warmed by the Trees ---
      hemi.intensity = 0.3 + 0.2 * light;
      hemi.color.set('#9fb0d8').lerp(c.copy(mix), 0.35 * light);
      sun.intensity = 0.28;
      starMat.opacity = 0.75 * (0.85 + 0.15 * Math.sin(ambient * 2));
      shells.forEach((sh, si) => {
        sh.mat.uniforms.uOpacity.value = sh.strength * (0.7 + (si === 0 ? 0.25 * light : 0));
        sh.mesh.visible = true;
      });
      glows.face(camera);
    },

    flash: () => 0,

    resize(w, h) { fitCamera(camera, target, w, h, CAM_D, 3.2); },

    dispose() {
      for (const l of world.labels) l.element.remove();
      disposeTree(scene);
      tex.dispose();
    },
  };
}
