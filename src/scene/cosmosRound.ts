import * as THREE from 'three';
import type { Stage } from './stage';
import { clamp01, disposeTree, hash, pulse, ramp } from './util';
import { createCosmosWorld, fitCamera, Glows, nameLabel, shellMaterial, showLabel, type CosmosLabels } from './cosmosWorld';
import {
  amanCoast, at, E, ERESSEA, heightsFor, landColor, mergeFlat, N, NUMENOR, S, SECOND_AGE, Slab, toU, toV, W,
} from './cosmosLands';

/**
 * The World is made round: Ar-Pharazôn's fleet sails from Númenor and lands on Aman; the
 * Valar lay down their rule and call on Ilúvatar; the sea opens between Númenor and Aman,
 * swallowing the fleet, Númenor goes down, and Aman with Tol Eressëa is lifted out of the
 * world. Then the flat slab bends and closes into a globe (a ship sailing west comes back
 * from the east), and the Straight Road runs on, straight and faint, from the bent sea up
 * towards the lost West.
 *
 * Everything is a pure function of `t`; `ambient` only drives shimmer, foam and twinkle.
 */

// Timeline (normalised event time), tuned against the passages in staging.yaml.
const T = {
  fleet: [0.02, 0.19],
  plea: [0.23, 0.3, 0.4], answer: [0.3, 0.36, 0.44],
  change: 0.37, chasm: [0.37, 0.42, 0.58], swallow: [0.38, 0.47], sink: [0.41, 0.53], wave: [0.43, 0.6],
  lift: [0.4, 0.57],
  round: [0.58, 0.71], around: [0.7, 0.8], roll: [0.79, 0.85],
  road: [0.81, 0.9], elfShip: [0.86, 0.995],
} as const;

const CAM_D = 19;
const R0 = 4 / Math.PI;           // the globe's radius if the slab kept its size
const GROW = 1.6;                 // ...but it grows a little as it closes, to stay readable
const RG = R0 * GROW;             // the round world's radius
const CENTRE_Y = 0.3;             // where its centre ends up
const ROLL = Math.PI / 2;         // how far it turns to show the Road leaving the sea
const CHASM = { u: -1.98, v: -0.3 };

export function createRoundStage(labels: CosmosLabels): Stage {
  const slab = new Slab(28, 112, 11);
  const nv = slab.nv;
  const hBefore = heightsFor(slab.gx, slab.gz, SECOND_AGE);
  const hSunk = heightsFor(slab.gx, slab.gz, { ...SECOND_AGE, numenor: 0 });
  const hAfter = heightsFor(slab.gx, slab.gz, { ...SECOND_AGE, numenor: 0, aman: 0 });
  const raw = new Float32Array(nv);
  const fu = Array.from(slab.fx, (x, f) => toU(x, slab.fz[f])), fv = Array.from(slab.fx, (x, f) => toV(x, slab.fz[f]));
  const isAman = fu.map((u, f) => u < amanCoast(fv[f]) + 0.14 || Math.hypot((u - ERESSEA.u) * 1.7, fv[f] - ERESSEA.v) < 0.45);
  const tris = slab.tris;

  // ---------- Aman, as a piece of its own that can be lifted away ----------
  const amanPos: number[] = [], amanCol: number[] = [];
  let cx = 0, cz = 0, n = 0;
  for (let f = 0; f < slab.nt; f++) if (isAman[f]) { cx += slab.fx[f]; cz += slab.fz[f]; n++; }
  cx /= n; cz /= n;
  const edgeCount = new Map<string, number>();
  const edgeKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const col = new THREE.Color();
  for (let f = 0; f < slab.nt; f++) {
    if (!isAman[f]) continue;
    const vs = [tris[f * 3], tris[f * 3 + 1], tris[f * 3 + 2]];
    const r = (hBefore[vs[0]] + hBefore[vs[1]] + hBefore[vs[2]]) / 3;
    landColor(fu[f], fv[f], r, slab.seed[f], col);
    for (const k of vs) {
      amanPos.push(slab.gx[k] - cx, Math.max(0, hBefore[k]) + 0.004, slab.gz[k] - cz);
      amanCol.push(col.r, col.g, col.b);
    }
    for (let e = 0; e < 3; e++) { const key = edgeKey(vs[e], vs[(e + 1) % 3]); edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1); }
  }
  // The torn earth under it: every outer edge down to a rough point below.
  const skirt: number[] = [];
  for (const [key, count] of edgeCount) {
    if (count !== 1) continue;
    const [a, b] = key.split('_').map(Number);
    skirt.push(slab.gx[a] - cx, 0, slab.gz[a] - cz, slab.gx[b] - cx, 0, slab.gz[b] - cz, 0, -1.1, 0);
  }
  const amanGeo = new THREE.BufferGeometry();
  amanGeo.setAttribute('position', new THREE.Float32BufferAttribute(amanPos, 3));
  amanGeo.setAttribute('color', new THREE.Float32BufferAttribute(amanCol, 3));
  const skirtGeo = new THREE.BufferGeometry();
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirt, 3));
  const amanMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, transparent: true, emissive: '#ffd890', emissiveIntensity: 0 });
  const skirtMat = new THREE.MeshStandardMaterial({ color: '#7d6a55', flatShading: true, roughness: 1, side: THREE.DoubleSide, transparent: true });
  const aman = new THREE.Group();
  aman.add(new THREE.Mesh(amanGeo, amanMat), new THREE.Mesh(skirtGeo, skirtMat));
  const amanHome = new THREE.Vector3(cx, 0, cz);

  // ---------- ships ----------
  const shipGeo = (hull: string, sail: string) => {
    const h = new THREE.ConeGeometry(0.35, 1.6, 4);
    h.rotateX(Math.PI / 2); h.scale(1, 0.45, 1); h.translate(0, 0.12, 0);
    const s = new THREE.ConeGeometry(0.42, 1.0, 3);
    s.scale(0.25, 1, 1); s.translate(0, 0.62, -0.05);
    return mergeFlat([{ geo: h, color: new THREE.Color(hull) }, { geo: s, color: new THREE.Color(sail) }]);
  };
  const FLEET = 54;
  const fleet = new THREE.InstancedMesh(shipGeo('#2c2724', '#caa24c'), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 }), FLEET);
  const fleetPath = Array.from({ length: FLEET }, (_, i) => {
    const h1 = hash(i, 1, 41), h2 = hash(i, 2, 41), h3 = hash(i, 3, 41);
    const vEnd = -0.75 + 0.95 * h2;
    return {
      from: at(NUMENOR.u - 0.28 - h1 * 0.25, NUMENOR.v + (h2 - 0.5) * 0.5, 0),
      to: at(amanCoast(vEnd) + 0.07 + h3 * 0.1, vEnd, 0),
      d: h3, spin: h1 * Math.PI * 2,
    };
  });
  const lone = new THREE.Mesh(shipGeo('#6b5b4a', '#f2ece0'), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 }));
  const elf = new THREE.Mesh(shipGeo('#f4f1ea', '#ffffff'), new THREE.MeshBasicMaterial({ vertexColors: true }));

  // ---------- the call to Ilúvatar: a pillar of light ----------
  const pillarGeo = new THREE.CylinderGeometry(0.02, 0.07, 12, 8, 1, true);
  pillarGeo.translate(0, 6, 0);
  const pillarMat = new THREE.MeshBasicMaterial({ color: '#fff1d0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);
  pillar.position.copy(at(amanCoast(0.4) - 0.3, 0.4, 0.8));

  // The chasm: a dark eye in the sea.
  const eyeGeo = new THREE.CylinderGeometry(1, 1, 0.01, 24);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#06121c', transparent: true, opacity: 0, depthWrite: false });
  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.copy(at(CHASM.u, CHASM.v, 0.012));

  // Foam of the whirlpool, the wave from Númenor, the trail of the lone ship, the Straight Road.
  const SWIRL = 320, WAVE = 260, TRAIL = 40, ROAD = 200;
  const nP = SWIRL + WAVE + TRAIL + ROAD;
  const pPos = new Float32Array(nP * 3), pCol = new Float32Array(nP * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));

  // The air round the round world.
  const airMat = shellMaterial('#9fd8ff');
  const air = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), airMat);

  let glows!: Glows;
  const world = createCosmosWorld(labels, (scene, tex) => {
    scene.add(slab.top, slab.glow, slab.under, aman, fleet, lone, elf, pillar, eye);
    scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    glows = new Glows(tex, scene);
  });
  const { scene, camera, target, hemi, sun, tex, shells, starMat } = world;
  scene.add(air);
  const answer = glows.make('#ffffff'), amanGlow = glows.make('#ffd890'), farWest = glows.make('#ffe4b0');
  const numenorGlow = glows.make('#ff9a5a'), roadEnd = glows.make('#fff6e0');

  target.set(0, 1.2, 0);
  const view = new THREE.Vector3().copy(S).addScaledVector(E, 0.12).normalize();
  camera.position.copy(target).addScaledVector(view, CAM_D * Math.cos(0.36)).setY(target.y + CAM_D * Math.sin(0.36));
  sun.position.set(4, 10, 7);

  const numenorLabel = nameLabel(world, 'Númenor');
  numenorLabel.position.copy(at(NUMENOR.u, NUMENOR.v - 0.6, 0.6));
  const amanLabel = nameLabel(world, 'Aman');
  const roadLabel = nameLabel(world, labels.straightRoad);

  // ---------- the bending: flat slab → globe, then a quarter turn ----------
  const centre = new THREE.Vector3(0, CENTRE_Y, 0);
  const rollQ = new THREE.Quaternion();
  let k = 0;
  const warp = (x: number, y: number, z: number, out: THREE.Vector3) => {
    if (k < 1e-4) { out.set(x, y, z); }
    else {
      const r = Math.hypot(x, z), a = Math.atan2(z, x);
      const rho = R0 / k, th = r / rho, s = 1 + (GROW - 1) * k;
      const d = Math.max(-rho + 0.05, y * (1 - 0.7 * k));
      const rr = rho + d;
      out.set(Math.sin(th) * Math.cos(a) * rr * s, ((rr * Math.cos(th)) - rho) * s + (R0 * GROW + CENTRE_Y) * k, Math.sin(th) * Math.sin(a) * rr * s);
    }
    out.sub(centre).applyQuaternion(rollQ).add(centre);
  };
  // The top of the round world once it has turned: where the Straight Road leaves the sea.
  const roadStart = new THREE.Vector3(0, CENTRE_Y + RG + 0.03, 0);
  const ROAD_UP = 0.2;
  const roadDir = new THREE.Vector3().copy(W).multiplyScalar(Math.cos(ROAD_UP)).setY(Math.sin(ROAD_UP));
  const ROAD_LEN = 5.6;
  const roadFar = roadStart.clone().addScaledVector(roadDir, ROAD_LEN);
  const amanFar = roadFar.clone().addScaledVector(roadDir, 0.4);

  const c = new THREE.Color(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), dummy = new THREE.Object3D();
  const swirlCol = new THREE.Color('#dff2ff'), waveCol = new THREE.Color('#f0f8ff'), roadCol = new THREE.Color('#fff2d8');
  const seaDark = new THREE.Color('#0f2a3a');
  const NA = new THREE.Vector3().copy(N);
  const aroundAxis = new THREE.Vector3().copy(W).addScaledVector(S, 0.6).normalize();

  return {
    scene, camera, target,

    update(t, ambient) {
      k = ramp(t, T.round[0], T.round[1]);
      rollQ.setFromAxisAngle(NA, ROLL * ramp(t, T.roll[0], T.roll[1]));
      const sink = ramp(t, T.sink[0], T.sink[1]);
      const lift = ramp(t, T.lift[0], T.lift[1]);
      const lifted = t >= T.lift[0];
      const chasm = pulse(t, T.chasm[0], T.chasm[1], T.chasm[2]);
      const dim = pulse(t, T.plea[0], T.plea[1] + 0.06, T.round[0] + 0.04);

      // --- the land: Númenor sinks, Aman's place becomes sea, then it all bends ---
      for (let q = 0; q < nv; q++) {
        let h = hBefore[q] + (hSunk[q] - hBefore[q]) * sink;
        if (lifted) h = Math.min(h, hAfter[q] + (h - hAfter[q]) * (1 - ramp(t, T.lift[0], T.lift[0] + 0.03)));
        raw[q] = h;
        slab.gy[q] = Math.max(0, h);
      }
      slab.update((f, water, _y, cc, glow) => {
        if (isAman[f] && !lifted) return false;
        const r = (raw[tris[f * 3]] + raw[tris[f * 3 + 1]] + raw[tris[f * 3 + 2]]) / 3;
        landColor(fu[f], fv[f], r, slab.seed[f], cc);
        if (water) {
          // The sea darkens round the chasm.
          const dc = Math.hypot(fu[f] - CHASM.u, fv[f] - CHASM.v);
          cc.lerp(seaDark, chasm * clamp01(1 - dc / 1.4) * 0.8);
        }
        cc.multiplyScalar(1 - 0.35 * dim);
        if (!water && Math.hypot(fu[f] - NUMENOR.u, fv[f] - NUMENOR.v) < 0.6) glow.setRGB(0.25, 0.1, 0.04).multiplyScalar(pulse(t, T.sink[0] - 0.04, T.sink[0], T.sink[1]));
        return true;
      }, warp);

      // --- Aman, lifted out of the world ---
      const amanAt = v3.lerpVectors(amanHome, amanFar, lift * lift * (3 - 2 * lift));
      amanAt.y += Math.sin(lift * Math.PI) * 1.5;
      aman.position.copy(amanAt);
      aman.scale.setScalar(1 - 0.72 * lift);
      const fade = 1 - 0.85 * ramp(t, T.lift[0] + 0.06, T.lift[1]);
      amanMat.opacity = fade; skirtMat.opacity = fade;
      amanMat.emissiveIntensity = 0.6 * lift;
      aman.visible = fade > 0.02;
      Glows.set(amanGlow, v4.copy(amanAt).setY(amanAt.y + 0.3), 2.5 + 2 * (1 - lift), 0.25 * lift + 0.15 * pulse(t, T.plea[0], T.plea[1], T.lift[0]));
      Glows.set(farWest, amanFar, 2.2, 0.55 * ramp(t, T.lift[1] - 0.05, T.lift[1] + 0.03) * (0.92 + 0.08 * Math.sin(ambient)));
      amanLabel.position.copy(amanAt).setY(amanAt.y + 1.1 - 0.5 * lift);
      showLabel(amanLabel, ramp(t, 0.03, 0.07) * (1 - ramp(t, T.lift[0] + 0.05, T.lift[0] + 0.1)));

      // --- the fleet sails, lands, and is swallowed ---
      const swallow = ramp(t, T.swallow[0], T.swallow[1]);
      const chasmAt = at(CHASM.u, CHASM.v, 0, v4);
      for (let i = 0; i < FLEET; i++) {
        const p = fleetPath[i];
        const q = ramp(t, T.fleet[0] + 0.03 * p.d, T.fleet[1] - 0.02 + 0.02 * p.d);
        dummy.position.lerpVectors(p.from, p.to, q);
        const dir = v3.subVectors(p.to, p.from);
        // Pulled into the chasm: spinning in, then gone.
        const pull = clamp01(swallow * 1.3 - p.d * 0.3);
        if (pull > 0) {
          const ang = p.spin + pull * 5, rr = (1 - pull) * dummy.position.distanceTo(chasmAt);
          dummy.position.set(chasmAt.x + Math.cos(ang) * rr, 0, chasmAt.z + Math.sin(ang) * rr);
          dir.set(-Math.sin(ang), 0, Math.cos(ang));
        }
        dummy.position.y = 0.03 + 0.012 * Math.sin(ambient * 2 + i) - 0.12 * pull;
        dummy.lookAt(v3.copy(dummy.position).add(dir.normalize()));
        dummy.scale.setScalar(t > T.fleet[0] ? 0.1 * (1 - pull) + 1e-4 : 1e-4);
        dummy.updateMatrix();
        fleet.setMatrixAt(i, dummy.matrix);
      }
      fleet.instanceMatrix.needsUpdate = true;
      fleet.visible = t > T.fleet[0] - 0.01 && swallow < 1;
      showLabel(numenorLabel, ramp(t, 0.03, 0.07) * (1 - ramp(t, T.sink[0], T.sink[0] + 0.05)));
      Glows.set(numenorGlow, at(NUMENOR.u, NUMENOR.v, 0.25, v3), 1.6, 0.35 * pulse(t, T.sink[0] - 0.03, T.sink[0] + 0.02, T.sink[1]));

      // --- the call to Ilúvatar, and the answer ---
      pillarMat.opacity = 0.22 * pulse(t, T.plea[0], T.plea[1], T.plea[2]) * (0.9 + 0.1 * Math.sin(ambient * 3));
      pillar.visible = pillarMat.opacity > 0.002;
      Glows.set(answer, v3.set(pillar.position.x, 9.5, pillar.position.z), 4, 0.6 * pulse(t, T.answer[0], T.answer[1], T.answer[2]));
      eye.scale.set(0.05 + 0.55 * chasm, 1, 0.05 + 0.55 * chasm);
      eyeMat.opacity = 0.85 * chasm;
      eye.visible = chasm > 0.002;

      // --- foam, waves, the lone ship's wake, the Road ---
      let i = 0;
      for (let s = 0; s < SWIRL; s++, i++) {
        const h1 = hash(s, 1, 43), h2 = hash(s, 2, 43);
        const rr = 0.08 + Math.sqrt(h1) * 0.85;
        const ang = h2 * Math.PI * 2 + ambient * (0.9 / rr) + (1 - rr) * 3;
        at(CHASM.u + Math.cos(ang) * rr, CHASM.v + Math.sin(ang) * rr, 0.02, v3).toArray(pPos, i * 3);
        const b = chasm * (0.25 + 0.55 * (1 - rr)) * (0.6 + 0.4 * Math.sin(ambient * 4 + s));
        pCol.set([swirlCol.r * b, swirlCol.g * b, swirlCol.b * b], i * 3);
      }
      const wave = clamp01((t - T.wave[0]) / (T.wave[1] - T.wave[0]));
      for (let w = 0; w < WAVE; w++, i++) {
        const a = (w / WAVE) * Math.PI * 2, rr = 0.35 + wave * 2.4 + 0.04 * hash(w, 3, 44);
        const u = NUMENOR.u + Math.cos(a) * rr, v = NUMENOR.v + Math.sin(a) * rr;
        const inside = Math.hypot(u, v) < 3.75 ? 1 : 0;
        at(u, v, 0.04, v3).toArray(pPos, i * 3);
        const b = (t > T.wave[0] ? (1 - wave) : 0) * 0.8 * inside;
        pCol.set([waveCol.r * b, waveCol.g * b, waveCol.b * b], i * 3);
      }
      // A ship sailing west on the round world comes back round from the east.
      const go = clamp01((t - T.around[0]) / (T.around[1] - T.around[0]));
      const ang0 = 0.15;
      const shipOn = t > T.around[0] && t < T.around[1] + 0.01;
      const shipAt = (g: number, out: THREE.Vector3) => {
        const a = ang0 + g * Math.PI * 2;
        return out.set(0, Math.cos(a), 0).addScaledVector(aroundAxis, Math.sin(a)).multiplyScalar(RG + 0.04).add(centre);
      };
      shipAt(go, v3);
      lone.position.copy(v3);
      shipAt(go + 0.01, v4);
      lone.up.copy(v3).sub(centre).normalize();
      lone.lookAt(v4);
      lone.scale.setScalar(0.13);
      lone.visible = shipOn;
      for (let w = 0; w < TRAIL; w++, i++) {
        shipAt(go - (w + 1) * 0.004, v3).toArray(pPos, i * 3);
        const b = shipOn ? 0.5 * (1 - w / TRAIL) : 0;
        pCol.set([b, b, b], i * 3);
      }
      const drawn = ramp(t, T.road[0], T.road[1]);
      for (let r = 0; r < ROAD; r++, i++) {
        const q = r / (ROAD - 1);
        v3.copy(roadStart).addScaledVector(roadDir, q * ROAD_LEN);
        v3.y += (hash(r, 1, 45) - 0.5) * 0.03;
        v3.toArray(pPos, i * 3);
        const b = clamp01((drawn * 1.1 - q) * 6) * (0.32 + 0.2 * Math.sin(q * 60 - ambient * 2.5)) * (1 - 0.4 * q);
        pCol.set([roadCol.r * b, roadCol.g * b, roadCol.b * b], i * 3);
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      pGeo.computeBoundingSphere();
      Glows.set(roadEnd, roadStart, 0.9, 0.5 * drawn * (0.85 + 0.15 * Math.sin(ambient * 2)));

      // The Elves' ship takes the Road.
      const e = ramp(t, T.elfShip[0], T.elfShip[1]);
      elf.position.copy(roadStart).addScaledVector(roadDir, e * (ROAD_LEN - 0.2));
      elf.lookAt(v3.copy(elf.position).add(roadDir));
      elf.scale.setScalar(0.1 * (1 - 0.45 * e));
      elf.visible = t > T.elfShip[0];
      roadLabel.position.copy(roadStart).addScaledVector(roadDir, ROAD_LEN * 0.55).setY(roadStart.y + ROAD_LEN * 0.55 * Math.sin(ROAD_UP) + 0.45);
      showLabel(roadLabel, ramp(t, T.road[0] + 0.03, T.road[1]));

      // --- sky and shells: the domes over the flat world give way to the air round the globe ---
      hemi.color.set('#e8eef8').lerp(c.set('#8a96b8'), dim);
      hemi.intensity = 0.85 - 0.4 * dim;
      sun.color.set('#fff2dc');
      sun.intensity = 1.25 - 0.65 * dim;
      starMat.opacity = (0.3 + 0.35 * dim + 0.3 * k) * (0.85 + 0.15 * Math.sin(ambient * 2));
      shells.forEach((sh, si) => {
        const domes = si < 2 ? 1 - k : 1;
        sh.mat.uniforms.uOpacity.value = sh.strength * 0.7 * domes;
        sh.mesh.visible = sh.mat.uniforms.uOpacity.value > 0.002;
      });
      air.position.copy(centre);
      air.scale.setScalar(RG * 1.14);
      airMat.uniforms.uOpacity.value = 0.42 * ramp(t, T.round[1] - 0.04, T.round[1] + 0.04);
      air.visible = airMat.uniforms.uOpacity.value > 0.002;
      glows.face(camera);
    },

    flash(t) {
      return 0.2 * pulse(t, T.change, T.change + 0.006, T.change + 0.045);
    },

    resize(w, h) { fitCamera(camera, target, w, h, CAM_D, 7.4); },

    dispose() {
      for (const l of world.labels) l.element.remove();
      disposeTree(scene);
      tex.dispose();
    },
  };
}
