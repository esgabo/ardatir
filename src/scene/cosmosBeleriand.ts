import * as THREE from 'three';
import type { Stage } from './stage';
import { clamp01, disposeTree, hash, pulse, ramp, smoothNoise } from './util';
import { createCosmosWorld, fitCamera, Glows, nameLabel, showLabel, type CosmosLabels } from './cosmosWorld';
import {
  at, drownedMask, E, ereLuinU, FIRST_AGE, Forest, heightsFor, landColor, landHeight, lindonCoast, meCoast, S, SECOND_AGE, Slab,
  THANGORODRIM, toU, toV,
} from './cosmosLands';

/**
 * Beleriand is drowned: the host of the Valar comes over the sea and drives Morgoth's armies
 * back to Angband; Thangorodrim falls, the land cracks and its rivers lose their way; when
 * Morgoth is overthrown the sea pours in from the west and Beleriand sinks, until only
 * Lindon is left west of the Blue Mountains, with a few of its hills standing as islands.
 *
 * Everything is a pure function of `t`; `ambient` only drives flicker, smoke and foam.
 */

// Timeline (normalised event time), tuned against the passages in staging.yaml.
const T = {
  host: [0.02, 0.26], foes: [0.04, 0.2], clash: [0.14, 0.31], warEnd: [0.27, 0.34],
  fall: [0.3, 0.4], rumple: [0.3, 0.46], cracks: [0.3, 0.38, 0.58], rivers: [0.32, 0.47],
  sea: [0.49, 0.69], seaSpan: 0.05,
  calm: [0.72, 0.86],
} as const;

const CAM_D = 8.6;
/** When the sea reaches longitude `u` (it comes in from the west). */
const seaArrives = (u: number, v: number) => T.sea[0] + clamp01((u + 1.6) / 1.6) * (T.sea[1] - T.sea[0]) + 0.015 * (smoothNoise(u * 3, v * 3, 91) - 0.5);
const inBeleriand = (u: number, v: number) => u < ereLuinU(v) + 0.05 && u > meCoast(v) - 0.1 && v > 0.1 && v < 3.3;

export function createBeleriandStage(labels: CosmosLabels): Stage {
  const slab = new Slab(30, 120, 9);
  const nv = slab.nv;
  const gu = Array.from(slab.gx, (x, k) => toU(x, slab.gz[k])), gv = Array.from(slab.gx, (x, k) => toV(x, slab.gz[k]));
  const hBase = heightsFor(slab.gx, slab.gz, { ...FIRST_AGE, thangorodrim: 0 });
  const hFull = heightsFor(slab.gx, slab.gz, FIRST_AGE);
  const hAfter = heightsFor(slab.gx, slab.gz, { ...SECOND_AGE, numenor: 0, ice: 1 });
  const rumple = new Float32Array(nv), arrive = new Float32Array(nv), raw = new Float32Array(nv), sinking = new Float32Array(nv);
  for (let k = 0; k < nv; k++) {
    const u = gu[k], v = gv[k];
    const r = 1 - Math.abs(2 * smoothNoise(u * 2.6 + 3, v * 2.6 + 3, 93) - 1);
    rumple[k] = inBeleriand(u, v) ? r * r * r * 0.22 - 0.06 : 0;
    arrive[k] = seaArrives(u, v);
  }
  const fu = Array.from(slab.fx, (x, f) => toU(x, slab.fz[f])), fv = Array.from(slab.fx, (x, f) => toV(x, slab.fz[f]));
  const crack = fu.map((u, f) => {
    const v = fv[f];
    if (!inBeleriand(u, v)) return 0;
    const n = smoothNoise(u * 3.4 + 11, v * 3.4 + 11, 95);
    return clamp01(1 - Math.abs(n - 0.5) / 0.035);
  });
  const scorch = fu.map((u, f) => clamp01(1 - Math.hypot(u - THANGORODRIM.u, fv[f] - THANGORODRIM.v) / 1.1));

  const forest = new Forest(330, (u, v) => {
    if (inBeleriand(u, v)) {
      // Doriath, Brethil and the pines of Dorthonion stand thick; the rest is open country.
      const woods = Math.max(
        1 - Math.hypot(u + 0.45, v - 1.3) / 0.45, 1 - Math.hypot(u + 0.95, v - 1.45) / 0.25, 1 - Math.hypot(u + 0.55, (v - 2.12) * 1.6) / 0.4,
      );
      return 0.12 + 0.85 * clamp01(woods);
    }
    return u > meCoast(v) + 0.1 ? 0.12 : 0;
  }, 67, 0.3);
  const treeG = forest.at.map((p) => {
    const u = toU(p.x, p.z), v = toV(p.x, p.z);
    return { u, v, arrive: seaArrives(u, v), base: Math.max(0, landHeight(u, v, { ...FIRST_AGE, thangorodrim: 0 })), after: landHeight(u, v, { ...SECOND_AGE, numenor: 0, ice: 1 }) };
  });

  // ---------- fortresses of the Elves ----------
  const stone = new THREE.MeshStandardMaterial({ color: '#e6dccb', flatShading: true, roughness: 0.6 });
  const roof = new THREE.MeshStandardMaterial({ color: '#8fa6c8', flatShading: true, roughness: 0.5 });
  const forts = [[-1.0, 1.05], [-0.45, 1.3], [-0.22, 2.22], [-1.05, 2.2], [-1.25, 0.6], [-0.95, 0.55]].map(([u, v]) => {
    const g = new THREE.Group();
    const h = 0.12 + hash(u, v, 1) * 0.06;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, h, 6), stone);
    tower.position.y = h / 2;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 6), roof);
    cap.position.y = h + 0.03;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.04, 7), stone);
    wall.position.y = 0.02;
    g.add(tower, cap, wall);
    const ground = Math.max(0, landHeight(u, v, { ...FIRST_AGE, thangorodrim: 0 }));
    return { g, u, v, ground, arrive: seaArrives(u, v), after: landHeight(u, v, { ...SECOND_AGE, numenor: 0, ice: 1 }) };
  });

  // ---------- hosts, smoke, dust, rivers, foam (one point cloud) ----------
  const HOST = 170, FOES = 150, SMOKE = 120, DUST = 160, RIVER = 110, FOAM = 420;
  const nP = HOST + FOES + RIVER + DUST;
  const fPos = new Float32Array(FOAM * 3), fCol = new Float32Array(FOAM * 3);
  const foamGeo = new THREE.BufferGeometry();
  foamGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  foamGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  const pPos = new Float32Array(nP * 3), pCol = new Float32Array(nP * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const sPos = new Float32Array(SMOKE * 3);
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const smokeMat = new THREE.PointsMaterial({ size: 0.7, color: '#120c0c', transparent: true, opacity: 0, depthWrite: false });
  // The Sirion, from the north down to its mouths.
  const river: [number, number][] = [];
  for (let i = 0; i < RIVER; i++) {
    const k = i / (RIVER - 1);
    river.push([-0.72 - 0.25 * k + 0.06 * Math.sin(k * 11), 2.25 - 1.85 * k]);
  }
  const riverG = river.map(([u, v]) => Math.max(0, landHeight(u, v, { ...FIRST_AGE, thangorodrim: 0 })));

  let glows!: Glows;
  let smoke!: THREE.Points;
  const world = createCosmosWorld(labels, (scene, tex) => {
    scene.add(slab.top, slab.glow, slab.under, forest.mesh, ...forts.map((f) => f.g));
    smokeMat.map = tex;
    smoke = new THREE.Points(smokeGeo, smokeMat);
    scene.add(new THREE.Points(foamGeo, new THREE.PointsMaterial({ size: 0.16, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    scene.add(smoke, new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.1, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    glows = new Glows(tex, scene);
  });
  const { scene, camera, target, hemi, sun, tex, shells, starMat } = world;
  const angband = glows.make('#ff4a1e'), fallGlow = glows.make('#ffb060');
  const clashes = Array.from({ length: 7 }, () => glows.make('#fff0c8'));
  const hostGlow = glows.make('#fff2cc');

  target.copy(at(-0.8, 1.65, 0));
  const view = new THREE.Vector3().copy(S).addScaledVector(E, 0.12).normalize();
  camera.position.copy(target).addScaledVector(view, CAM_D * Math.cos(0.95)).setY(target.y + CAM_D * Math.sin(0.95));

  const beleriandLabel = nameLabel(world, 'Beleriand');
  beleriandLabel.position.copy(at(-0.75, 1.25, 0.55));
  const thangLabel = nameLabel(world, 'Thangorodrim', '');
  thangLabel.position.copy(at(THANGORODRIM.u, THANGORODRIM.v + 0.15, 1.55));
  const luinLabel = nameLabel(world, 'Ered Luin', '');
  luinLabel.position.copy(at(ereLuinU(0.6) + 0.15, 0.6, 0.7));
  const lindonLabel = nameLabel(world, 'Lindon');
  lindonLabel.position.copy(at((lindonCoast(1.75) + ereLuinU(1.75)) / 2 - 0.05, 1.75, 0.4));

  const c = new THREE.Color(), wetCol = new THREE.Color('#3f7f8c'), dark = new THREE.Color('#2e2622'), crackCol = new THREE.Color('#ff5a1e'), v3 = new THREE.Vector3();
  const gold = new THREE.Color('#ffe7b0'), foe = new THREE.Color('#ff3a14'), foam = new THREE.Color('#e8f6ff'), sirion = new THREE.Color('#7cc8ff');
  const meet = (i: number, out: THREE.Vector3) => at(THANGORODRIM.u - 0.55 + (i / 6) * 0.95, THANGORODRIM.v - 0.5 - 0.15 * Math.sin(i * 1.3), 0, out);

  return {
    scene, camera, target,

    update(t, ambient) {
      const fall = ramp(t, T.fall[0], T.fall[1]);
      const rum = ramp(t, T.rumple[0], T.rumple[1]);
      const cracks = pulse(t, T.cracks[0], T.cracks[1], T.cracks[2]);
      const war = 1 - ramp(t, T.warEnd[0], T.warEnd[1]);
      const calm = ramp(t, T.calm[0], T.calm[1]);

      // --- the land: Thangorodrim falls, the land buckles, then sinks as the sea comes ---
      for (let k = 0; k < nv; k++) {
        let h = hBase[k] + (hFull[k] - hBase[k]) * (1 - fall) + rumple[k] * rum;
        const m = ramp(t, arrive[k], arrive[k] + T.seaSpan);
        sinking[k] = m > 0 && m < 1 && hAfter[k] < 0 ? 1 - Math.abs(2 * m - 1) : 0;
        if (m > 0) h += (Math.min(h, hAfter[k] - 0.05) - h) * m;
        raw[k] = h;
        slab.gy[k] = Math.max(0, h);
      }
      const tris = slab.tris;
      slab.update((f, water, _y, col, glow) => {
        const r = (raw[tris[f * 3]] + raw[tris[f * 3 + 1]] + raw[tris[f * 3 + 2]]) / 3;
        landColor(fu[f], fv[f], r, slab.seed[f], col);
        if (!water) {
          col.lerp(dark, scorch[f] * 0.75 * (1 - 0.6 * calm));
          const wet = (sinking[tris[f * 3]] + sinking[tris[f * 3 + 1]] + sinking[tris[f * 3 + 2]]) / 3;
          if (wet > 0) { col.lerp(wetCol, wet * 0.8); glow.setRGB(0.22 * wet, 0.3 * wet, 0.34 * wet); }
          const cr = crack[f] * cracks;
          if (cr > 0.01) { col.lerp(dark, cr * 0.6); glow.copy(crackCol).multiplyScalar(cr * (0.45 + 0.1 * Math.sin(ambient * 4 + f))); }
          if (scorch[f] > 0 && war > 0) glow.r += scorch[f] * scorch[f] * 0.12 * war;
        }
        return true;
      });

      // Forests and fortresses go down with the land.
      forest.update(
        (i) => { const g = treeG[i]; const m = ramp(t, g.arrive, g.arrive + T.seaSpan); return g.base + (Math.min(g.base, g.after) - g.base) * m; },
        (i) => {
          const g = treeG[i]; const m = ramp(t, g.arrive, g.arrive + T.seaSpan);
          const y = g.base + (Math.min(g.base, g.after - 0.05) - g.base) * m;
          return y > 0.03 ? 1 - 0.5 * scorchAt(g.u, g.v) * war : 0;
        },
      );
      for (const fo of forts) {
        const m = ramp(t, fo.arrive, fo.arrive + T.seaSpan);
        const y = fo.ground + (Math.min(fo.ground, fo.after - 0.05) - fo.ground) * m;
        at(fo.u, fo.v, y - m * 0.2, fo.g.position);
        fo.g.visible = y > -0.15;
      }

      // --- the hosts: the Valar's from the sea, Morgoth's from Angband ---
      let i = 0;
      for (let h = 0; h < HOST; h++, i++) {
        const h1 = hash(h, 1, 71), h2 = hash(h, 2, 71), h3 = hash(h, 3, 71);
        const q = clamp01((t - T.host[0] - 0.04 * h3) / (T.host[1] - T.host[0] - 0.04));
        const e = q * q * (3 - 2 * q);
        const su = -1.85 + h1 * 0.2, sv = 0.85 + h2 * 1.3;
        const eu = THANGORODRIM.u - 0.65 + h1 * 1.1, ev = THANGORODRIM.v - 0.55 - h2 * 0.45 - 0.2 * Math.abs(h1 - 0.5);
        const u = su + (eu - su) * e, v = sv + (ev - sv) * e;
        at(u, v, Math.max(0, landHeight(u, v, FIRST_AGE)) + 0.05 + 0.02 * Math.sin(ambient * 3 + h), v3).toArray(pPos, i * 3);
        const b = ramp(t, T.host[0], T.host[0] + 0.03) * war * (0.55 + 0.45 * Math.sin(ambient * 2.5 + h * 1.9));
        pCol.set([gold.r * b, gold.g * b, gold.b * b], i * 3);
      }
      for (let h = 0; h < FOES; h++, i++) {
        const h1 = hash(h, 1, 73), h2 = hash(h, 2, 73);
        const q = ramp(t, T.foes[0] + 0.03 * h2, T.foes[1]);
        const back = ramp(t, T.clash[0] + 0.05, T.warEnd[0]); // driven back to Angband
        const a = h1 * Math.PI - Math.PI, rr = 0.15 + 0.25 * h2;
        const su = THANGORODRIM.u + Math.cos(a) * 0.1, sv = THANGORODRIM.v - 0.05;
        const eu = THANGORODRIM.u - 0.55 + h1 * 0.95, ev = THANGORODRIM.v - 0.4 - rr * 0.6;
        const k = q * (1 - back * 0.8);
        const u = su + (eu - su) * k, v = sv + (ev - sv) * k;
        at(u, v, Math.max(0, landHeight(u, v, FIRST_AGE)) + 0.04, v3).toArray(pPos, i * 3);
        const b = ramp(t, T.foes[0], T.foes[0] + 0.03) * (1 - ramp(t, 0.24, 0.31)) * (0.4 + 0.6 * hash(h, Math.floor(ambient * 5), 74));
        pCol.set([foe.r * b, foe.g * b, foe.b * b], i * 3);
      }

      // --- the Sirion loses its way ---
      const lost = ramp(t, T.rivers[0], T.rivers[1]);
      for (let r = 0; r < RIVER; r++, i++) {
        const [u0, v0] = river[r];
        const du = (smoothNoise(r * 0.15, 3, 97) - 0.5) * 0.5 * lost, dv = (smoothNoise(r * 0.15, 7, 97) - 0.5) * 0.3 * lost;
        const u = u0 + du, v = v0 + dv;
        const m = ramp(t, seaArrives(u, v), seaArrives(u, v) + T.seaSpan);
        at(u, v, riverG[r] + 0.03 + rum * 0.04, v3).toArray(pPos, i * 3);
        const b = 0.55 * (1 - lost * 0.85) * (1 - m) * (r % 7 === 3 && lost > 0.3 ? 0 : 1);
        pCol.set([sirion.r * b, sirion.g * b, sirion.b * b], i * 3);
      }

      // --- the sea pours in: a line of foam running east ---
      const seaOn = pulse(t, T.sea[0] - 0.01, T.sea[0] + 0.03, T.sea[1] + 0.06);
      const front = -1.6 + 1.6 * clamp01((t - T.sea[0]) / (T.sea[1] - T.sea[0]));
      for (let fm = 0; fm < FOAM; fm++) {
        const h1 = hash(fm, 1, 77), h2 = hash(fm, 2, 77);
        const v = 0.15 + h1 * 3.1;
        const u = Math.min(front, lindonCoast(v) + 0.02) - 0.02 - h2 * h2 * 0.3 + 0.03 * Math.sin(ambient * 2 + fm);
        at(u, v, 0.03 + 0.05 * h2, v3).toArray(fPos, fm * 3);
        const live = drownedMask(u + 0.1, v) > 0.3 ? 1 : 0;
        const b = seaOn * live * (0.75 + 0.25 * Math.sin(ambient * 3 + fm * 2.3)) * (1 - h2 * 0.7);
        fCol.set([foam.r * b, foam.g * b, foam.b * b], fm * 3);
      }
      foamGeo.attributes.position.needsUpdate = true;
      foamGeo.attributes.color.needsUpdate = true;
      foamGeo.computeBoundingSphere();

      // --- Thangorodrim's fall: a burst of dust and fire ---
      for (let d = 0; d < DUST; d++, i++) {
        const h1 = hash(d, 1, 79), h2 = hash(d, 2, 79), h3 = hash(d, 3, 79);
        const u = clamp01((t - T.fall[0] - 0.02 * h3) / 0.12);
        const a = h1 * Math.PI * 2, out = u * (0.2 + 0.7 * h2);
        at(THANGORODRIM.u + Math.cos(a) * out, THANGORODRIM.v + Math.sin(a) * out, 0.3 + u * (0.9 * h3) - u * u * 0.6, v3).toArray(pPos, i * 3);
        const b = t > T.fall[0] ? (1 - u) * 0.8 : 0;
        c.set('#ffd08a').lerp(foe, u);
        pCol.set([c.r * b, c.g * b, c.b * b], i * 3);
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      pGeo.computeBoundingSphere();

      // Smoke over Angband, while the war lasts.
      for (let s = 0; s < SMOKE; s++) {
        const h1 = hash(s, 1, 99), h2 = hash(s, 2, 99), h3 = hash(s, 3, 99);
        const life = (ambient * 0.05 + h1) % 1;
        at(THANGORODRIM.u + (h2 - 0.5) * (0.4 + life * 0.8) - life * 0.3, THANGORODRIM.v - life * 0.5 + (h3 - 0.5) * 0.3, 1.0 + life * 1.0, v3).toArray(sPos, s * 3);
      }
      smokeGeo.attributes.position.needsUpdate = true;
      smokeMat.opacity = 0.55 * (1 - ramp(t, T.fall[0] + 0.04, T.fall[1] + 0.08));
      smoke.visible = smokeMat.opacity > 0.002;

      // --- glows ---
      const thangTop = at(THANGORODRIM.u, THANGORODRIM.v, 0.9 * (1 - fall) + 0.25, v3);
      Glows.set(angband, thangTop, 2.2, 0.5 * war * (0.85 + 0.15 * Math.sin(ambient * 2.5)));
      Glows.set(fallGlow, at(THANGORODRIM.u, THANGORODRIM.v, 0.4, v3), 2 + 2 * fall, 0.9 * pulse(t, T.fall[0], T.fall[0] + 0.03, T.fall[1] + 0.05));
      clashes.forEach((g, k) => {
        const on = pulse(t, T.clash[0] + k * 0.01, T.clash[0] + 0.06 + k * 0.01, T.clash[1]);
        const beat = 0.5 + 0.5 * Math.sin(t * 900 + k * 2.1);
        Glows.set(g, meet(k, v3).setY(0.5), 0.7 + 0.5 * beat, on * beat * 0.7);
      });
      Glows.set(hostGlow, at(-1.6, 1.5, 0.5, v3), 3, 0.35 * pulse(t, 0, 0.04, 0.14));

      // --- names ---
      showLabel(beleriandLabel, ramp(t, 0.03, 0.07) * (1 - ramp(t, 0.52, 0.58)));
      showLabel(thangLabel, ramp(t, 0.05, 0.09) * (1 - ramp(t, T.fall[0], T.fall[0] + 0.04)));
      showLabel(luinLabel, ramp(t, 0.75, 0.79));
      showLabel(lindonLabel, ramp(t, 0.77, 0.81));

      // --- light: the smoke and fire of war, then a clear sky over the new sea ---
      hemi.color.set('#c9b8b0').lerp(c.set('#fff3e2'), calm);
      hemi.intensity = 0.55 + 0.4 * calm;
      sun.color.set('#ffd2a8').lerp(c.set('#fff6e6'), calm);
      sun.position.set(-2, 10, 6);
      sun.intensity = 0.55 + 0.75 * calm;
      starMat.opacity = 0.35 * (1 - calm) * (0.85 + 0.15 * Math.sin(ambient * 2));
      shells.forEach((sh) => { sh.mat.uniforms.uOpacity.value = sh.strength * 0.7; sh.mesh.visible = true; });
      glows.face(camera);
    },

    flash(t) {
      return 0.14 * pulse(t, T.fall[0], T.fall[0] + 0.006, T.fall[0] + 0.04);
    },

    resize(w, h) { fitCamera(camera, target, w, h, CAM_D, 2.6); },

    dispose() {
      for (const l of world.labels) l.element.remove();
      disposeTree(scene);
      tex.dispose();
    },
  };
}

const scorchAt = (u: number, v: number) => clamp01(1 - Math.hypot(u - THANGORODRIM.u, v - THANGORODRIM.v) / 1.1);
