import * as THREE from 'three';
import type { Stage } from './stage';
import { clamp01, disposeTree, hash, pulse, ramp } from './util';
import { createCosmosWorld, fitCamera, Glows, nameLabel, showLabel, type CosmosLabels } from './cosmosWorld';
import {
  amanCoast, at, buildTree, CALACIRYA, E, ELDER, W, EZELLOHAR, fillDrops, Forest, heightsFor, landColor, N, S, Slab, toU, toV, VALMAR,
  type TreeParts,
} from './cosmosLands';
import { dreamWorld, Jewel, pale } from './cosmosForetold';

/**
 * Foretold: the Two Trees are rekindled. In a Valinor still dark, the dead Trees stand grey on
 * Ezellohar with Yavanna beside them and the Valar round about. Fëanor comes up from the
 * Calacirya, a figure of fire with the three Silmarils going before him; for a moment he holds
 * them close, as once he would not give them up; then he lays them before Yavanna. She breaks
 * them, and the light kept inside them through all the ages pours into Telperion and Laurelin,
 * which wake, silver and gold, and light Valinor again.
 *
 * Shown in the dream register of what is foretold (cosmosForetold.ts). Everything is a pure
 * function of `t`; `ambient` only drives drifting motes, drops and twinkle.
 */

// Timeline (normalised event time), tuned against the passages in staging.yaml.
const T = {
  walk: [0.03, 0.2], clutch: [0.24, 0.3, 0.38], climb: [0.36, 0.44], lay: [0.4, 0.46],
  break: 0.49, pour: [0.5, 0.68],
  wake: [0.62, 0.74], telLight: [0.68, 0.78], lauLight: [0.72, 0.82], flood: [0.76, 0.9], cycle: [0.88, 1.0],
} as const;

const TREE_S = 1.3;
const CAM_D = 6.6;
const MOUND_H = 0.15;

export function createRekindledStage(labels: CosmosLabels): Stage {
  const slab = new Slab(26, 104, 5);
  const raw = heightsFor(slab.gx, slab.gz, ELDER);
  for (let k = 0; k < slab.nv; k++) slab.gy[k] = Math.max(0, raw[k]);
  const fu = Array.from(slab.fx, (x, f) => toU(x, slab.fz[f])), fv = Array.from(slab.fx, (x, f) => toV(x, slab.fz[f]));
  const faceRaw = Array.from(fu, (_u, f) => (raw[slab.tris[f * 3]] + raw[slab.tris[f * 3 + 1]] + raw[slab.tris[f * 3 + 2]]) / 3);
  const inAman = fu.map((u, f) => u < amanCoast(fv[f]) + 0.05);
  const near = fu.map((u, f) => clamp01(1 - Math.hypot(u - EZELLOHAR.u, fv[f] - EZELLOHAR.v) / 1.4));

  const forest = new Forest(200, (u, v) => (u < amanCoast(v) - 0.6 ? 0.08 : u > -1.2 ? 0.3 : 0), 65);
  const forestY = forest.at.map((p) => Math.max(0, heightsFor(Float32Array.of(p.x), Float32Array.of(p.z), ELDER)[0]));

  // ---------- Ezellohar, Valmar, the Trees ----------
  const moundAt = at(EZELLOHAR.u, EZELLOHAR.v, 0.06);
  const moundGeo = new THREE.CylinderGeometry(0.14, 0.42, MOUND_H, 9);
  moundGeo.translate(0, MOUND_H / 2, 0);
  const moundMat = new THREE.MeshStandardMaterial({ color: '#56794a', flatShading: true, roughness: 0.85 });
  const mound = new THREE.Mesh(moundGeo, moundMat);
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
  valmar.position.copy(at(VALMAR.u, VALMAR.v, 0.07));

  const side = new THREE.Vector3().copy(N).multiplyScalar(0.17);
  const telAt = moundAt.clone().add(side).setY(moundAt.y + MOUND_H - 0.01);
  const lauAt = moundAt.clone().sub(side).setY(moundAt.y + MOUND_H - 0.01);
  const tree = (p: TreeParts, base: THREE.Vector3, rot: number) => {
    p.group.position.copy(base);
    p.group.scale.setScalar(TREE_S);
    p.group.rotation.y = rot;
    return p;
  };
  const tel = tree(buildTree('telperion'), telAt, 0.5), lau = tree(buildTree('laurelin'), lauAt, 2.1);
  const telBark = tel.bark.color.clone(), lauBark = lau.bark.color.clone();
  const telLight = new THREE.PointLight(tel.color, 0, 0, 1.6), lauLight = new THREE.PointLight(lau.color, 0, 0, 1.6);
  const telTop = telAt.clone().setY(telAt.y + 0.62 * TREE_S), lauTop = lauAt.clone().setY(lauAt.y + 0.62 * TREE_S);
  telLight.position.copy(telTop).setY(telTop.y + 0.3); lauLight.position.copy(lauTop).setY(lauTop.y + 0.3);
  const fireLight = new THREE.PointLight('#ff9a50', 0, 0, 2);
  // Fëanor: a small figure of fire (his name is "spirit of fire").
  const figMat = new THREE.MeshBasicMaterial({ color: '#ffb070', transparent: true });
  const robe = new THREE.ConeGeometry(0.035, 0.15, 6);
  robe.translate(0, 0.075, 0);
  const headGeo = new THREE.IcosahedronGeometry(0.018, 0);
  headGeo.translate(0, 0.165, 0);
  const figure = new THREE.Group();
  figure.add(new THREE.Mesh(robe, figMat), new THREE.Mesh(headGeo, figMat));
  figure.scale.setScalar(1.5);

  // Where Fëanor walks: up from the Calacirya to the foot of the mound, then up it.
  const path = [at(CALACIRYA.u + 0.36, CALACIRYA.v - 0.04, 0.05), at(CALACIRYA.u - 0.1, CALACIRYA.v - 0.02, 0.1), moundAt.clone().addScaledVector(E, 0.5).addScaledVector(S, 0.1).setY(0.08)];
  const top = moundAt.clone().addScaledVector(E, 0.2).setY(moundAt.y + MOUND_H + 0.02);
  const before = moundAt.clone().addScaledVector(E, 0.1).setY(moundAt.y + MOUND_H + 0.32);
  const yavannaAt = moundAt.clone().addScaledVector(S, 0.08).addScaledVector(E, 0.02).setY(moundAt.y + MOUND_H + 0.16);

  // Song motes, Fëanor's embers, the pouring light (silver and gold), the Trees' drops, shards.
  const MOTES = 120, EMBERS = 90, POUR = 260, DROPS = 200, SHARDS = 90;
  const nP = MOTES + EMBERS + POUR * 2 + DROPS * 2 + SHARDS;
  const pPos = new Float32Array(nP * 3), pCol = new Float32Array(nP * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));

  let glows!: Glows;
  const world = createCosmosWorld(labels, (scene, tex) => {
    scene.add(slab.top, slab.glow, slab.under, forest.mesh, mound, valmar, tel.group, lau.group, telLight, lauLight, fireLight, figure);
    glows = new Glows(tex, scene);
    const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.075, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.renderOrder = 4;
    scene.add(pts);
  });
  const { scene, camera, target, hemi, sun, tex, shells, starMat } = world;
  const dream = dreamWorld(world, 3.2, moundAt);
  const feanor = glows.make('#ff9a50'), feanorCore = glows.make('#fff0d8');
  const yavanna = glows.make('#b8f07a'), breakGlow = glows.make('#ffffff');
  const telGlow = glows.make(tel.color), lauGlow = glows.make(lau.color), mingle = glows.make('#fff1d0'), valinorGlow = glows.make('#ffe2a8');
  const valar = Array.from({ length: 12 }, () => glows.make('#e8e4ff'));
  const jewels = [new Jewel(scene, glows), new Jewel(scene, glows), new Jewel(scene, glows)];

  target.copy(moundAt).setY(0.72).addScaledVector(E, -0.15);
  const view = new THREE.Vector3().copy(E).addScaledVector(S, 0.8).normalize();
  camera.position.copy(target).addScaledVector(view, CAM_D * Math.cos(0.92)).setY(target.y + CAM_D * Math.sin(0.92));
  hemi.groundColor.set('#141a26');
  sun.intensity = 0;

  const feanorLabel = nameLabel(world, 'Fëanor', ''), yavannaLabel = nameLabel(world, 'Yavanna', '');
  const telLabel = nameLabel(world, 'Telperion'), lauLabel = nameLabel(world, 'Laurelin');
  const moundLabel = nameLabel(world, 'Ezellohar', '');
  moundLabel.position.copy(moundAt).addScaledVector(S, 0.5).setY(0.02);
  telLabel.position.copy(telAt).addScaledVector(N, 0.35).setY(telAt.y + 1.25 * TREE_S);
  lauLabel.position.copy(lauAt).addScaledVector(S, 0.35).setY(lauAt.y + 1.25 * TREE_S);
  yavannaLabel.position.copy(yavannaAt).addScaledVector(W, 0.5).setY(yavannaAt.y + 0.2);

  const c = new THREE.Color(), v3 = new THREE.Vector3(), fp = new THREE.Vector3(), jp = new THREE.Vector3(), off = new THREE.Vector3(), mix = new THREE.Color();
  const deadBark = new THREE.Color('#6b645d'), deadLeaf = new THREE.Color('#767a78'), white = new THREE.Color('#ffffff');
  const ember = new THREE.Color('#ff8a3a'), song = new THREE.Color('#c8f08a'), dimNight = new THREE.Color('#2a3048');

  /** Fëanor's place at t. */
  const feanorAt = (t: number, out: THREE.Vector3) => {
    const w = ramp(t, T.walk[0], T.walk[1]) * 2;
    if (w <= 1) out.lerpVectors(path[0], path[1], w); else out.lerpVectors(path[1], path[2], w - 1);
    // The old refusal: a step back, holding them close.
    out.addScaledVector(E, 0.12 * pulse(t, T.clutch[0], T.clutch[1], T.clutch[2]));
    return out.lerp(top, ramp(t, T.climb[0], T.climb[1]));
  };

  return {
    scene, camera, target,

    update(t, ambient) {
      // --- the Trees wake, and their light comes back ---
      const wake = ramp(t, T.wake[0], T.wake[1]);
      const cyc = ramp(t, T.cycle[0], T.cycle[0] + 0.04);
      const wave = 0.5 + 0.5 * Math.cos(((t - T.cycle[0]) / (T.cycle[1] - T.cycle[0])) * Math.PI);
      let telK = ramp(t, T.telLight[0], T.telLight[1]), lauK = ramp(t, T.lauLight[0], T.lauLight[1]);
      telK *= 1 - cyc * 0.25 * (1 - wave); lauK *= 1 - cyc * 0.25 * wave;
      const light = Math.max(telK, lauK);
      const flood = ramp(t, T.flood[0], T.flood[1]);
      mix.copy(tel.color).multiplyScalar(telK).add(c.copy(lau.color).multiplyScalar(lauK));
      mix.multiplyScalar(1 / Math.max(mix.r, mix.g, mix.b, 1e-3));
      const memory = pulse(t, T.clutch[0] - 0.02, T.clutch[1], T.clutch[2]);

      slab.update((f, water, _y, col, glow) => {
        landColor(fu[f], fv[f], faceRaw[f], slab.seed[f], col);
        pale(col, 0.16);
        // Valinor dark around the dead Trees, then lit from the mound outwards.
        const lit = inAman[f] ? Math.max(light * near[f] * near[f] * 1.6, flood * (0.55 + 0.45 * near[f])) : 0.35 * flood;
        col.lerp(dimNight, (0.32 - 0.28 * clamp01(lit)) * (1 + 0.6 * memory));
        if (lit > 0.003) glow.copy(mix).multiplyScalar(clamp01(lit) * (water ? 0.1 : 0.06));
        return true;
      });
      forest.update((i) => forestY[i], (i) => (forestY[i] > 0.03 ? 1 : 0));
      moundMat.color.set('#4e6a45').lerp(c.set('#6fbf50'), wake);

      // --- the Trees: grey and dead, then living ---
      tel.bark.color.copy(deadBark).lerp(telBark, wake);
      lau.bark.color.copy(deadBark).lerp(lauBark, wake);
      tel.leaves.color.copy(deadLeaf).lerp(white, wake);
      lau.leaves.color.copy(deadLeaf).lerp(white, wake);
      const place = (p: TreeParts, k: number, pl: THREE.PointLight, g: THREE.Mesh, top: THREE.Vector3) => {
        p.glowMat.opacity = k;
        p.leaves.emissive.copy(p.color).multiplyScalar(0.12 * k);
        pl.intensity = k * 5;
        Glows.set(g, v3.copy(top).setY(top.y + 0.25), 2.6, k * 0.5 * (0.95 + 0.05 * Math.sin(ambient * 1.7)));
      };
      place(tel, telK, telLight, telGlow, telTop);
      place(lau, lauK, lauLight, lauGlow, lauTop);
      if (lau.blossomMat) lau.blossomMat.color.set('#3f3a30').lerp(c.set('#ffd36a'), lauK).multiplyScalar(1 + lauK * 0.5);
      Glows.set(mingle, v3.copy(moundAt).setY(moundAt.y + 1.1), 5, 0.4 * Math.min(telK, lauK) * cyc);
      Glows.set(valinorGlow, v3.copy(moundAt).setY(0.5), 6, 0.16 * flood);

      // --- Fëanor, with the jewels going before him ---
      feanorAt(t, fp);
      const fOn = ramp(t, T.walk[0] - 0.02, T.walk[0] + 0.02) * (1 - 0.6 * ramp(t, T.break, T.break + 0.1));
      const flick = 0.9 + 0.1 * Math.sin(ambient * 5.3) * Math.sin(ambient * 3.1);
      Glows.set(feanor, v3.copy(fp).setY(fp.y + 0.1), 0.42, fOn * 0.45 * flick);
      Glows.set(feanorCore, v3.copy(fp).setY(fp.y + 0.12), 0.1, fOn * 0.6);
      figure.position.copy(fp);
      figure.lookAt(v3.copy(before).setY(fp.y));
      figMat.opacity = fOn;
      figure.visible = fOn > 0.01;
      fireLight.position.copy(fp).setY(fp.y + 0.35);
      fireLight.intensity = fOn * 0.12;
      const lay = ramp(t, T.lay[0], T.lay[1]);
      const broken = t >= T.break;
      const hold = 0.09 + 0.05 * (1 - memory);
      jewels.forEach((j, i) => {
        const a = (i / 3) * Math.PI * 2 + (t - T.walk[0]) * 10 * (1 - lay);
        jp.copy(fp).addScaledVector(E, -0.14).setY(fp.y + 0.26 + 0.03 * Math.sin(a * 2));
        jp.x += Math.cos(a) * hold; jp.z += Math.sin(a) * hold;
        const b = (i / 3) * Math.PI * 2 + 0.4;
        v3.copy(before).add(off.set(Math.cos(b) * 0.09, 0.04 * Math.sin(b), Math.sin(b) * 0.09));
        jp.lerp(v3, lay);
        j.set(jp, broken ? 0 : ramp(t, T.walk[0], T.walk[0] + 0.04), ambient, 0.34, i);
      });

      // --- Yavanna, and the breaking ---
      const yOn = ramp(t, 0.06, 0.12);
      const yBright = 0.45 + 0.4 * pulse(t, T.lay[0], T.break, T.pour[1]);
      Glows.set(yavanna, yavannaAt, 0.9, yOn * yBright * (0.92 + 0.08 * Math.sin(ambient * 2.3)));
      const burst = pulse(t, T.break - 0.004, T.break + 0.003, T.break + 0.06);
      Glows.set(breakGlow, before, 1.5 + 3 * burst, burst * 0.9);
      valar.forEach((g, i) => {
        const a = (i / valar.length) * Math.PI * 2 + 0.3;
        Glows.set(g, v3.copy(moundAt).add(off.set(Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.85)), 0.3, (0.25 + 0.35 * light) * yOn);
      });

      // --- particles ---
      let i = 0;
      const songK = yOn * (0.3 + 0.7 * pulse(t, T.lay[0], T.pour[0], T.wake[1]));
      for (let m = 0; m < MOTES; m++, i++) {
        const h1 = hash(m, 1, 5), h2 = hash(m, 2, 5), life = (ambient * 0.1 + h1) % 1;
        const ang = h2 * Math.PI * 2 + life * 5, rr = 0.08 + life * 0.5;
        pPos.set([yavannaAt.x + Math.cos(ang) * rr, yavannaAt.y + life * 1.2, yavannaAt.z + Math.sin(ang) * rr], i * 3);
        const b = songK * Math.sin(life * Math.PI) * 0.6;
        pCol.set([song.r * b, song.g * b, song.b * b], i * 3);
      }
      for (let e = 0; e < EMBERS; e++, i++) {
        const h1 = hash(e, 1, 66), h2 = hash(e, 2, 66), life = (ambient * 0.45 + h1) % 1;
        pPos.set([fp.x + (h2 - 0.5) * 0.12, fp.y + 0.08 + life * 0.45, fp.z + (hash(e, 3, 66) - 0.5) * 0.12], i * 3);
        const b = fOn * Math.sin(life * Math.PI) * 0.7;
        pCol.set([ember.r * b, ember.g * b, ember.b * b], i * 3);
      }
      // The light pouring out of the broken jewels, spiralling into each Tree and up to its crown.
      const pour = clamp01((t - T.pour[0]) / (T.pour[1] - T.pour[0]));
      const pourK = pulse(t, T.pour[0] - 0.01, T.pour[0] + 0.05, T.pour[1] + 0.04);
      for (const [base, crown, color, seed] of [[telAt, telTop, tel.color, 67], [lauAt, lauTop, lau.color, 68]] as const) {
        for (let q = 0; q < POUR; q++, i++) {
          const h1 = hash(q, 1, seed), h2 = hash(q, 2, seed);
          const s = (h1 + ambient * 0.25) % 1;
          if (s > pour * 1.2) { pPos.set([before.x, before.y, before.z], i * 3); pCol.set([0, 0, 0], i * 3); continue; }
          const k1 = clamp01(s / 0.35), k2 = clamp01((s - 0.35) / 0.65);
          v3.lerpVectors(before, base, k1 * k1 * (3 - 2 * k1)).setY(before.y + (base.y + 0.02 - before.y) * k1 + Math.sin(k1 * Math.PI) * 0.15);
          if (k2 > 0) {
            const ang = k2 * 9 + h2 * 6.28, rr = 0.05 + 0.25 * k2;
            v3.set(base.x + Math.cos(ang) * rr, base.y + k2 * (crown.y - base.y + 0.3), base.z + Math.sin(ang) * rr);
          }
          v3.toArray(pPos, i * 3);
          const b = pourK * (0.6 + 0.4 * Math.sin(s * 30 + h2 * 6)) * 1.4;
          pCol.set([color.r * b, color.g * b, color.b * b], i * 3);
        }
      }
      fillDrops(pPos, pCol, i, DROPS, telAt, TREE_S, ambient, tel.color, telK * 0.85, 8);
      fillDrops(pPos, pCol, i + DROPS, DROPS, lauAt, TREE_S, ambient, lau.color, lauK * 0.85, 9);
      i += DROPS * 2;
      const sk = ramp(t, T.break, T.break + 0.08);
      for (let s = 0; s < SHARDS; s++, i++) {
        const th = hash(s, 1, 69) * Math.PI * 2, ph = Math.acos(2 * hash(s, 2, 69) - 1), r = sk * (0.15 + 0.6 * hash(s, 3, 69));
        pPos.set([before.x + r * Math.sin(ph) * Math.cos(th), before.y + r * Math.cos(ph) - sk * sk * 0.2, before.z + r * Math.sin(ph) * Math.sin(th)], i * 3);
        const b = (broken ? 1 - sk : 0) * 1.2;
        pCol.set([b, b * 0.96, b * 0.88], i * 3);
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      pGeo.computeBoundingSphere();

      // --- names ---
      feanorLabel.position.copy(fp).addScaledVector(S, 0.12).setY(fp.y + 0.45);
      showLabel(feanorLabel, ramp(t, 0.05, 0.09) * (1 - ramp(t, T.lay[1], T.lay[1] + 0.04)));
      showLabel(yavannaLabel, ramp(t, 0.1, 0.14) * (1 - ramp(t, T.break + 0.06, T.break + 0.1)));
      showLabel(moundLabel, ramp(t, 0.02, 0.06) * (1 - ramp(t, 0.2, 0.24)));
      showLabel(telLabel, ramp(t, T.telLight[0] + 0.02, T.telLight[0] + 0.06));
      showLabel(lauLabel, ramp(t, T.lauLight[0] + 0.02, T.lauLight[0] + 0.06));

      // --- sky: no Sun, no Moon; starlight, then the Trees ---
      hemi.color.set('#8890c8').lerp(c.copy(mix), 0.35 * light);
      hemi.intensity = 0.68 + 0.12 * light - 0.2 * memory;
      starMat.opacity = (0.75 - 0.25 * flood) * (0.85 + 0.15 * Math.sin(ambient * 2));
      shells.forEach((sh, si) => {
        sh.mat.uniforms.uOpacity.value = sh.strength * (0.55 + (si === 0 ? 0.3 * flood : 0));
        sh.mesh.visible = true;
      });
      dream.update(ambient);
      glows.face(camera);
    },

    flash(t) {
      return 0.18 * pulse(t, T.break - 0.004, T.break + 0.002, T.break + 0.03);
    },

    resize(w, h) { fitCamera(camera, target, w, h, CAM_D, 1.9); },

    dispose() {
      for (const l of world.labels) l.element.remove();
      disposeTree(scene);
      tex.dispose();
    },
  };
}
