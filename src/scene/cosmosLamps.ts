import * as THREE from 'three';
import type { Stage } from './stage';
import { clamp01, disposeTree, hash, pulse, ramp, smoothNoise } from './util';
import { createCosmosWorld, SLAB_RADIUS, type CosmosLabels } from './cosmosWorld';

/**
 * The Spring of Arda: the young world in its shells, the two Lamps raised on their pillars
 * (Illuin in the north, Ormal in the south), the land greening, Almaren where their lights
 * meet, then Melkor's assault from Utumno: the Lamps thrown down, fire and ruin reshaping
 * lands and seas, and the Valar's light withdrawing into the West.
 *
 * Everything is a pure function of `t`; `ambient` only drives flicker and twinkle.
 */

// Timeline (normalised event time), tuned against the passages in staging.yaml.
const T = {
  marringEnd: 0.11,
  illuinRise: [0.125, 0.17], ormalRise: [0.14, 0.185],
  illuinKindle: [0.175, 0.22], ormalKindle: [0.19, 0.235],
  namesIn: 0.235,
  green: [0.32, 0.42], trees: [0.33, 0.45],
  almaren: [0.43, 0.47], mingle: [0.445, 0.5],
  utumno: [0.555, 0.6], shadow: [0.57, 0.655],
  illuinFall: [0.655, 0.69], ormalFall: [0.675, 0.71],
  ruinSpan: 0.075, ruinPerUnit: 0.012,
  west: [0.86, 0.97],
  stars: [0.84, 0.95],
} as const;

// Compass on the slab. The camera looks from the south-east, so the Lamps stand left and
// right of the view, and the West (Aman) lies away from it.
const N = new THREE.Vector3(1, 0, -1).normalize();
const E = new THREE.Vector3(1, 0, 1).normalize();
const W = E.clone().negate();
const LAMP_R = 2.3;
const PILLAR_H = 2.7;

interface Lamp {
  name: string;
  base: THREE.Vector3;
  /** Which way the pillar falls (along the ground). */
  fallDir: THREE.Vector3;
  rise: readonly [number, number];
  kindle: readonly [number, number];
  fall: readonly [number, number];
  color: THREE.Color;
  /** Where the lamp strikes the ground. */
  impact: THREE.Vector3;
}

const LAMPS: Lamp[] = [
  { name: 'Illuin', base: N.clone().multiplyScalar(LAMP_R), fallDir: E.clone(), rise: T.illuinRise, kindle: T.illuinKindle, fall: T.illuinFall, color: new THREE.Color('#e6eeff'), impact: new THREE.Vector3() },
  { name: 'Ormal', base: N.clone().multiplyScalar(-LAMP_R), fallDir: W.clone(), rise: T.ormalRise, kindle: T.ormalKindle, fall: T.ormalFall, color: new THREE.Color('#ffd98a'), impact: new THREE.Vector3() },
];
for (const l of LAMPS) l.impact.copy(l.base).addScaledVector(l.fallDir, PILLAR_H * 0.92);

const along = (x: number, z: number, d: THREE.Vector3) => x * d.x + z * d.z;
const dist2 = (x: number, z: number, p: THREE.Vector3) => Math.hypot(x - p.x, z - p.z);

/** The world as the Valar planned it: balanced, mirrored north–south and east–west. */
function heightBefore(x: number, z: number): number {
  const n = Math.abs(along(x, z, N)), e = Math.abs(along(x, z, E)), r = Math.hypot(x, z);
  let h = 0.2 + 0.2 * smoothNoise(n * 1.1 + 3, e * 1.1 + 3, 21) + 0.05 * smoothNoise(n * 2.7, e * 2.7, 22);
  h += Math.max(0, r - 3.2) * 0.22;
  h -= clamp01(1.3 - r / 0.95) * 0.6;          // the great lake in the middle
  h += clamp01(1 - r / 0.34) * 0.5;            // the isle of Almaren
  for (const l of LAMPS) h += 0.16 * clamp01(1 - dist2(x, z, l.base) / 0.55); // the pillars' feet
  return Math.max(0, h);
}

/** The world after the Lamps' fall: inland seas where they stood, torn and raised lands. */
function heightAfter(x: number, z: number): number {
  const n = along(x, z, N), r = Math.hypot(x, z);
  let h = 0.06 + 0.3 * smoothNoise(x * 0.9 + 40, z * 0.9 + 40, 31);
  const ridge = 1 - Math.abs(2 * smoothNoise(x * 1.5 + 7, z * 1.5 + 7, 33) - 1);
  h += 0.6 * ridge * ridge * ridge;
  h += Math.max(0, r - 3.2) * 0.26;
  // Helcar, where Illuin stood, and Ringil, where Ormal stood.
  const wob = (s: number) => 0.85 + 0.3 * smoothNoise(x * 2 + s, z * 2 + s, 35);
  h -= 1.0 * clamp01(1.5 - dist2(x, z, LAMPS[0].base) / (0.95 * wob(1)));
  h -= 0.9 * clamp01(1.5 - dist2(x, z, LAMPS[1].base) / (0.8 * wob(5)));
  // The lake of Almaren, broken and spilled.
  h -= 0.7 * clamp01(1.25 - Math.hypot(x - 0.25 * E.x + 0.2 * N.x, z - 0.25 * E.z + 0.2 * N.z) / (1.05 * wob(9)));
  // The mountains of the north, raised over Utumno.
  h += 0.9 * clamp01((n - 2.4) / 1.1) * (0.55 + 0.45 * smoothNoise(x * 2.5, z * 2.5, 37));
  return Math.max(0, h);
}

/** How far the ruin has spread to (x, z) at `t`: 0 untouched → 1 reshaped. */
function ruinAt(x: number, z: number, t: number): number {
  let m = 0;
  for (const l of LAMPS) {
    const d = dist2(x, z, l.impact);
    const s = l.fall[1] + d * T.ruinPerUnit;
    m = Math.max(m, ramp(t, s, s + T.ruinSpan));
  }
  return m;
}

/** Fire on the ground at (x, z): rises as the ruin reaches it, then dies to embers. */
function burnAt(x: number, z: number, t: number): number {
  let b = 0;
  for (const l of LAMPS) {
    const d = dist2(x, z, l.impact);
    if (d > 3.4) continue;
    const s = l.fall[1] + d * T.ruinPerUnit * 0.8;
    b = Math.max(b, pulse(t, s - 0.002, s + 0.02, s + 0.13 + (3.4 - d) * 0.02) * (1 - d / 3.6));
  }
  return b;
}

const heightAt = (x: number, z: number, t: number) => {
  const m = ruinAt(x, z, t);
  return m <= 0 ? heightBefore(x, z) : m >= 1 ? heightAfter(x, z) : THREE.MathUtils.lerp(heightBefore(x, z), heightAfter(x, z), m);
};

export function createLampsStage(labels: CosmosLabels): Stage {
  // ---------- Ambar, reshaped over time ----------
  const RINGS = 18, SEGS = 80;
  const nv = (RINGS + 1) * (SEGS + 1);
  const gx = new Float32Array(nv), gz = new Float32Array(nv), hb = new Float32Array(nv), ha = new Float32Array(nv), gy = new Float32Array(nv);
  const gi = (ri: number, si: number) => ri * (SEGS + 1) + (si % SEGS);
  for (let ri = 0; ri <= RINGS; ri++) {
    for (let si = 0; si <= SEGS; si++) {
      const r = (ri / RINGS) * SLAB_RADIUS, a = (si / SEGS) * Math.PI * 2;
      // A little jitter inside the slab, so the facets don't read as a perfect wheel.
      const j = ri > 0 && ri < RINGS ? 0.06 : 0;
      const x = Math.cos(a) * r + (hash(ri, si % SEGS, 3) - 0.5) * j, z = Math.sin(a) * r + (hash(ri, si % SEGS, 4) - 0.5) * j;
      const k = ri * (SEGS + 1) + si;
      gx[k] = x; gz[k] = z; hb[k] = heightBefore(x, z); ha[k] = heightAfter(x, z);
    }
  }
  // Triangles as vertex-index triples into the grid.
  const tris: number[] = [];
  for (let ri = 0; ri < RINGS; ri++) {
    for (let si = 0; si < SEGS; si++) {
      const a = gi(ri, si), b = gi(ri, si + 1), c = gi(ri + 1, si), d = gi(ri + 1, si + 1);
      if (ri === 0) tris.push(a, d, c);
      else tris.push(a, b, c, b, d, c);
    }
  }
  const nt = tris.length / 3;
  const topPos = new Float32Array(nt * 9), topCol = new Float32Array(nt * 9), glowCol = new Float32Array(nt * 9);
  const topGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(topPos, 3);
  topGeo.setAttribute('position', posAttr);
  topGeo.setAttribute('color', new THREE.BufferAttribute(topCol, 3));
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', posAttr);
  glowGeo.setAttribute('color', new THREE.BufferAttribute(glowCol, 3));
  const faceSeed = new Float32Array(nt);
  const faceN = new Float32Array(nt);
  for (let f = 0; f < nt; f++) {
    faceSeed[f] = hash(f, 3, 17);
    const [a, b, c] = [tris[f * 3], tris[f * 3 + 1], tris[f * 3 + 2]];
    faceN[f] = along((gx[a] + gx[b] + gx[c]) / 3, (gz[a] + gz[b] + gz[c]) / 3, N);
  }

  // The cut earth sides: rim → jagged ring → a rough point below.
  const rimSegs = SEGS;
  const underPos = new Float32Array(rimSegs * 27);
  const underGeo = new THREE.BufferGeometry();
  underGeo.setAttribute('position', new THREE.BufferAttribute(underPos, 3));
  const tip = [0, -3.2, 0];
  const inset = (si: number) => {
    const k = gi(RINGS, si), s = 0.82 - hash(si % SEGS, 6, 9) * 0.12;
    return [gx[k] * s, -0.9 - hash(si % SEGS, 5, 9) * 0.9, gz[k] * s];
  };

  const topMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
  const glowMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const rockMat = new THREE.MeshStandardMaterial({ color: '#7d6a55', flatShading: true, roughness: 1, side: THREE.DoubleSide });
  const topMesh = new THREE.Mesh(topGeo, topMat);
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  const underMesh = new THREE.Mesh(underGeo, rockMat);

  // ---------- trees ----------
  const TREES = 260;
  // One small two-tiered conifer, as triangles (side faces of two six-sided cones).
  const TREE: number[] = [];
  for (const [r, y0, y1] of [[0.08, 0.04, 0.2], [0.058, 0.13, 0.3]]) {
    for (let s = 0; s < 6; s++) {
      const a0 = (s / 6) * Math.PI * 2, a1 = ((s + 1) / 6) * Math.PI * 2;
      TREE.push(Math.cos(a0) * r, y0, Math.sin(a0) * r, 0, y1, 0, Math.cos(a1) * r, y0, Math.sin(a1) * r);
    }
  }
  const TV = TREE.length / 3;
  const treePos = new Float32Array(TREES * TV * 3), treeCol = new Float32Array(TREES * TV * 3);
  const treeGeo = new THREE.BufferGeometry();
  treeGeo.setAttribute('position', new THREE.BufferAttribute(treePos, 3));
  treeGeo.setAttribute('color', new THREE.BufferAttribute(treeCol, 3));
  const trees = new THREE.Mesh(treeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
  const treeAt: { x: number; z: number; s: number; d: number }[] = [];
  for (let k = 0; treeAt.length < TREES && k < 4000; k++) {
    const r = Math.sqrt(hash(k, 1, 51)) * 3.7, a = hash(k, 2, 51) * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (heightBefore(x, z) < 0.08) continue;                  // not in the lake
    if (Math.hypot(x, z) < 0.42) continue;                     // not on Almaren's halls
    if (LAMPS.some((l) => dist2(x, z, l.base) < 0.35)) continue;
    // Groves: denser where a slow noise says so.
    if (smoothNoise(x * 1.3 + 2, z * 1.3 + 2, 53) < 0.38) continue;
    const col = new THREE.Color().setHSL(0.26 + hash(k, 5, 51) * 0.08, 0.42, 0.3 + hash(k, 6, 51) * 0.1);
    for (let v = 0; v < TV; v++) treeCol.set([col.r, col.g, col.b], (treeAt.length * TV + v) * 3);
    treeAt.push({ x, z, s: 0.7 + hash(k, 3, 51) * 0.7, d: hash(k, 4, 51) });
  }
  treeGeo.setDrawRange(0, treeAt.length * TV);
  const q = new THREE.Quaternion(), v3 = new THREE.Vector3();

  // ---------- the Lamps ----------
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#efe5d0', flatShading: true, roughness: 0.55, metalness: 0.05 });
  const pillarGeo = new THREE.CylinderGeometry(0.075, 0.12, PILLAR_H, 7);
  pillarGeo.translate(0, PILLAR_H / 2, 0);
  const cupGeo = new THREE.CylinderGeometry(0.2, 0.07, 0.14, 7);
  cupGeo.translate(0, PILLAR_H + 0.03, 0);
  const lampGeo = new THREE.SphereGeometry(0.17, 8, 6);

  // Soft glows: camera-facing quads with the shared glow texture (turned in update).
  const quad = new THREE.PlaneGeometry(1, 1);
  const glows: THREE.Mesh[] = [];
  const glowQuad = (mat: THREE.MeshBasicMaterial) => {
    const m = new THREE.Mesh(quad, mat);
    glows.push(m);
    return m;
  };

  const UP = new THREE.Vector3(0, 1, 0);
  const lampParts = LAMPS.map((l) => {
    const pillar = new THREE.Group();
    pillar.add(new THREE.Mesh(pillarGeo, stoneMat), new THREE.Mesh(cupGeo, stoneMat));
    const lampMat = new THREE.MeshBasicMaterial({ color: '#6b6458' });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    const glow = glowQuad(new THREE.MeshBasicMaterial({ color: l.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const halo = glowQuad(new THREE.MeshBasicMaterial({ color: l.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const light = new THREE.PointLight(l.color, 0, 0, 1.6);
    const fallAxis = new THREE.Vector3().crossVectors(UP, l.fallDir).normalize();
    return { l, pillar, lamp, lampMat, glow, halo, light, fallAxis };
  });

  // ---------- fire ----------
  const FIRE = 2600;
  const fPos = new Float32Array(FIRE * 3), fCol = new Float32Array(FIRE * 3);
  const fireGeo = new THREE.BufferGeometry();
  fireGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fireGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  const fireHot = new THREE.Color('#ffe08a'), fireMid = new THREE.Color('#ff8a2a'), fireCold = new THREE.Color('#c22a10');

  // Melkor's marring before the Lamps: red rifts that flicker and are driven away.
  const MAR = 240;
  const marPos = new Float32Array(MAR * 3), marCol = new Float32Array(MAR * 3);
  const marGeo = new THREE.BufferGeometry();
  marGeo.setAttribute('position', new THREE.BufferAttribute(marPos, 3));
  marGeo.setAttribute('color', new THREE.BufferAttribute(marCol, 3));
  for (let i = 0; i < MAR; i++) {
    // Short jagged lines of embers across the land.
    const line = Math.floor(i / 20), k = (i % 20) / 20;
    const r = 0.8 + hash(line, 1, 61) * 2.6, a = hash(line, 2, 61) * Math.PI * 2, dir = hash(line, 3, 61) * Math.PI * 2;
    const x = Math.cos(a) * r + Math.cos(dir) * (k - 0.5) * 1.1 + (hash(i, 4, 61) - 0.5) * 0.12;
    const z = Math.sin(a) * r + Math.sin(dir) * (k - 0.5) * 1.1 + (hash(i, 5, 61) - 0.5) * 0.12;
    marPos.set([x, heightBefore(x, z) + 0.04, z], i * 3);
  }

  // ---------- Almaren ----------
  const almaren = new THREE.Group();
  const hallMat = new THREE.MeshStandardMaterial({ color: '#f4ead6', flatShading: true, roughness: 0.6, emissive: '#fff2d0', emissiveIntensity: 0 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#d9b25c', flatShading: true, roughness: 0.5, emissive: '#ffcc66', emissiveIntensity: 0 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3, r = i === 0 ? 0 : 0.14 + hash(i, 1, 71) * 0.07;
    const h = i === 0 ? 0.32 : 0.08 + hash(i, 2, 71) * 0.08;
    const w = i === 0 ? 0.045 : 0.035 + hash(i, 3, 71) * 0.02;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(w, w * 1.1, h, 6), hallMat);
    body.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 1.5, w * 2.4, 6), roofMat);
    roof.position.set(Math.cos(a) * r, h + w * 1.2, Math.sin(a) * r);
    almaren.add(body, roof);
  }
  const mingleMat = new THREE.MeshBasicMaterial({ color: '#fff3dc', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const mingle = glowQuad(mingleMat);

  // ---------- Utumno ----------
  const utumno = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({ color: '#211a1d', flatShading: true, roughness: 1, emissive: '#5a1206', emissiveIntensity: 0.6 });
  const utumnoAt = N.clone().multiplyScalar(3.45);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2, r = i === 0 ? 0 : 0.18 + hash(i, 1, 81) * 0.3;
    const h = i === 0 ? 1.05 : 0.35 + hash(i, 2, 81) * 0.5;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07 + hash(i, 3, 81) * 0.06, h, 5), darkMat);
    spike.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    spike.rotation.set((hash(i, 4, 81) - 0.5) * 0.3, 0, (hash(i, 5, 81) - 0.5) * 0.3);
    utumno.add(spike);
  }
  const utumnoGlow = glowQuad(new THREE.MeshBasicMaterial({ color: '#ff3a1e', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  // Smoke: dark, normally blended, drifting south.
  const SMOKE = 160;
  const sPos = new Float32Array(SMOKE * 3);
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const smokeMat = new THREE.PointsMaterial({ size: 0.9, color: '#0d0809', transparent: true, opacity: 0, depthWrite: false });

  // ---------- the Valar withdraw West ----------
  const westMat = new THREE.MeshBasicMaterial({ color: '#ffe6b0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const westGlow = glowQuad(westMat);
  const amanMat = new THREE.MeshBasicMaterial({ color: '#ffd890', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const amanGlow = glowQuad(amanMat);

  let fire!: THREE.Points, marring!: THREE.Points, smoke!: THREE.Points;
  const world = createCosmosWorld(labels, (scene, tex) => {
    scene.add(topMesh, glowMesh, underMesh, trees, almaren, utumno);
    for (const p of lampParts) {
      (p.glow.material as THREE.MeshBasicMaterial).map = tex;
      (p.halo.material as THREE.MeshBasicMaterial).map = tex;
      scene.add(p.pillar, p.lamp, p.glow, p.halo, p.light);
    }
    mingleMat.map = tex; westMat.map = tex; amanMat.map = tex;
    (utumnoGlow.material as THREE.MeshBasicMaterial).map = tex;
    smokeMat.map = tex;
    smoke = new THREE.Points(smokeGeo, smokeMat);
    marring = new THREE.Points(marGeo, new THREE.PointsMaterial({ size: 0.12, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    fire = new THREE.Points(fireGeo, new THREE.PointsMaterial({ size: 0.16, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(mingle, utumnoGlow, smoke, marring, fire, westGlow, amanGlow);
  });
  const { scene, camera, target, hemi, sun, tex, shells, starMat } = world;
  hemi.color.set('#cfd8f0');
  hemi.groundColor.set('#1a2030');
  sun.color.set('#fff4e0');
  camera.position.set(14, 8.2, 14);
  target.set(0, 0.7, 0);

  // Names over the Lamps, Almaren and Utumno.
  const nameLabel = (text: string) => {
    const l = world.mkLabel(text, 'big');
    scene.add(l);
    world.labels.push(l);
    return l;
  };
  const lampLabels = LAMPS.map((l) => nameLabel(l.name));
  const almarenLabel = nameLabel('Almaren');
  const utumnoLabel = nameLabel('Utumno');
  almarenLabel.position.set(0, 1.35, 0);
  utumnoLabel.position.copy(utumnoAt).setY(1.9);
  const showLabel = (l: { element: HTMLElement }, v: number) => { l.element.style.opacity = String(clamp01(v)); };

  // Colours reused every frame.
  const bare = new THREE.Color('#8f7f68'), grassA = new THREE.Color('#7fae5a'), grassB = new THREE.Color('#a9c56c');
  const lakeBright = new THREE.Color('#5c9ab4'), lakeDim = new THREE.Color('#3f6f86'), seaRuin = new THREE.Color('#284d61');
  const burnt = new THREE.Color('#3e302a'), ruinRock = new THREE.Color('#7d6b58');
  const c = new THREE.Color(), g = new THREE.Color();

  let aspect = 0;

  return {
    scene, camera, target,

    update(t, ambient) {
      const kindle = LAMPS.map((l) => ramp(t, l.kindle[0], l.kindle[1]));
      const lit = (kindle[0] + kindle[1]) / 2;
      const green = ramp(t, T.green[0], T.green[1]);
      const shadowOn = ramp(t, T.shadow[0], T.shadow[1]);
      const front = 3.9 - 1.6 * shadowOn;
      const fallen = LAMPS.map((l) => t >= l.fall[1]);
      const dark = ramp(t, LAMPS[1].fall[1], 0.86);

      // --- the land ---
      for (let k = 0; k < nv; k++) {
        const m = ruinAt(gx[k], gz[k], t);
        gy[k] = m <= 0 ? hb[k] : m >= 1 ? ha[k] : THREE.MathUtils.lerp(hb[k], ha[k], m);
      }
      for (let f = 0; f < nt; f++) {
        const a = tris[f * 3], b = tris[f * 3 + 1], cc = tris[f * 3 + 2];
        topPos.set([gx[a], gy[a], gz[a], gx[b], gy[b], gz[b], gx[cc], gy[cc], gz[cc]], f * 9);
        const cx = (gx[a] + gx[b] + gx[cc]) / 3, cz = (gz[a] + gz[b] + gz[cc]) / 3;
        const water = (gy[a] <= 0.001 ? 1 : 0) + (gy[b] <= 0.001 ? 1 : 0) + (gy[cc] <= 0.001 ? 1 : 0) >= 2;
        const ruin = ruinAt(cx, cz, t);
        const burn = burnAt(cx, cz, t);
        const s = faceSeed[f];
        if (water) {
          c.copy(lakeDim).lerp(lakeBright, lit).lerp(seaRuin, ruin);
        } else {
          c.copy(bare).lerp(s > 0.5 ? grassA : grassB, green * (0.55 + 0.45 * s));
          c.lerp(ruinRock, ruin * 0.75).lerp(burnt, Math.min(1, burn * 1.6) * 0.8);
          // Snow-pale peaks on the new northern mountains.
          const yMax = Math.max(gy[a], gy[b], gy[cc]);
          if (yMax > 0.95) c.lerp(new THREE.Color('#cfc8c0'), clamp01((yMax - 0.95) * 2) * ruin);
        }
        c.offsetHSL(0, 0, (s - 0.5) * 0.05);
        // Melkor's shadow creeping south from Utumno.
        const sh = clamp01((faceN[f] - front) / 0.7) * shadowOn * (1 - dark);
        c.multiplyScalar(1 - 0.7 * sh);
        // Glow: lava where the fire runs, and the faint red of the shadow.
        g.setRGB(0, 0, 0);
        if (burn > 0.01 && !water) g.copy(fireMid).lerp(fireCold, 1 - burn).multiplyScalar(burn * (0.3 + 0.12 * Math.sin(ambient * 3 + s * 20)));
        if (sh > 0) g.r += sh * 0.05;
        for (let v = 0; v < 3; v++) {
          topCol.set([c.r, c.g, c.b], f * 9 + v * 3);
          glowCol.set([g.r, g.g, g.b], f * 9 + v * 3);
        }
      }
      posAttr.needsUpdate = true;
      topGeo.attributes.color.needsUpdate = true;
      glowGeo.attributes.color.needsUpdate = true;
      topGeo.computeVertexNormals();
      topGeo.computeBoundingSphere();

      for (let si = 0; si < rimSegs; si++) {
        const k0 = gi(RINGS, si), k1 = gi(RINGS, si + 1);
        const r0 = [gx[k0], gy[k0], gz[k0]], r1 = [gx[k1], gy[k1], gz[k1]];
        const b0 = inset(si), b1 = inset(si + 1);
        underPos.set([...r0, ...b0, ...r1, ...r1, ...b0, ...b1, ...b0, ...tip, ...b1], si * 27);
      }
      underGeo.attributes.position.needsUpdate = true;
      underGeo.computeVertexNormals();

      // --- trees: they grow in the Spring and burn in the ruin ---
      for (let i = 0; i < treeAt.length; i++) {
        const tr = treeAt[i];
        const grow = ramp(t, T.trees[0] + tr.d * 0.07, T.trees[0] + 0.04 + tr.d * 0.07);
        const ruin = ruinAt(tr.x, tr.z, t);
        const y = heightAt(tr.x, tr.z, t);
        const alive = grow * (1 - ramp(ruin, 0.15, 0.6)) * (y > 0.02 ? 1 : 0);
        const s = alive * tr.s;
        for (let v = 0, o = i * TV * 3; v < TV; v++, o += 3) {
          treePos[o] = tr.x + TREE[v * 3] * s;
          treePos[o + 1] = y - 0.01 + TREE[v * 3 + 1] * s;
          treePos[o + 2] = tr.z + TREE[v * 3 + 2] * s;
        }
      }
      treeGeo.attributes.position.needsUpdate = true;
      treeGeo.computeVertexNormals();
      treeGeo.computeBoundingSphere();
      trees.visible = t > T.trees[0];

      // --- the Lamps ---
      lampParts.forEach((p, i) => {
        const l = p.l;
        const rise = ramp(t, l.rise[0], l.rise[1]);
        const u = clamp01((t - l.fall[0]) / (l.fall[1] - l.fall[0]));
        const angle = (Math.PI / 2 - 0.06) * u * u;
        q.setFromAxisAngle(p.fallAxis, angle);
        // After falling, the broken pillar sinks into the reshaped land.
        const sink = ramp(t, l.fall[1] + 0.03, l.fall[1] + 0.16);
        p.pillar.position.copy(l.base).setY(heightBefore(l.base.x, l.base.z) - 0.04 - sink * 0.5);
        p.pillar.quaternion.copy(q);
        p.pillar.scale.set(1, Math.max(rise, 0.001), 1);
        p.pillar.visible = rise > 0 && sink < 1;

        const top = v3.set(0, PILLAR_H * rise + 0.16, 0).applyQuaternion(q).add(p.pillar.position);
        const k = kindle[i];
        p.lamp.position.copy(top);
        p.lamp.visible = rise > 0.02 && !fallen[i];
        p.lampMat.color.set('#6b6458').lerp(l.color, k).multiplyScalar(1 + k * 0.4);
        const flicker = 0.94 + 0.06 * Math.sin(ambient * 2.2 + i * 2);
        const glowMat = p.glow.material as THREE.MeshBasicMaterial, haloMat = p.halo.material as THREE.MeshBasicMaterial;
        const burst = fallen[i] ? pulse(t, l.fall[1], l.fall[1] + 0.006, l.fall[1] + 0.05) : 0;
        if (!fallen[i]) {
          p.glow.position.copy(top); p.halo.position.copy(top);
          p.glow.scale.setScalar(1.1 + k * 0.5);
          p.halo.scale.setScalar(3.2 + k * 2.4);
          glowMat.opacity = k * flicker;
          haloMat.opacity = k * 0.35 * flicker;
          p.light.position.copy(top);
          p.light.color.copy(l.color);
          p.light.intensity = k * 11 * flicker;
        } else {
          // The lamp breaks: a burst of its light, then fire where it struck.
          const at = v3.copy(l.impact).setY(heightAt(l.impact.x, l.impact.z, t) + 0.3);
          p.glow.position.copy(at); p.halo.position.copy(at);
          p.glow.scale.setScalar(1.2 + burst * 1.2);
          p.halo.scale.setScalar(3 + burst * 2.5);
          const fireLeft = 1 - ramp(t, l.fall[1] + 0.06, l.fall[1] + 0.22);
          glowMat.color.copy(l.color).lerp(fireMid, ramp(t, l.fall[1], l.fall[1] + 0.04));
          haloMat.color.copy(glowMat.color);
          glowMat.opacity = Math.max(burst, 0.55 * fireLeft) * flicker;
          haloMat.opacity = Math.max(burst * 0.45, 0.2 * fireLeft) * flicker;
          p.light.position.copy(at).setY(at.y + 0.9);
          p.light.color.copy(glowMat.color);
          p.light.intensity = (burst * 10 + 5 * fireLeft) * flicker;
        }
        p.glow.visible = glowMat.opacity > 0.001;
        p.halo.visible = haloMat.opacity > 0.001;

        const name = lampLabels[i];
        name.position.copy(top).setY(top.y + 0.8);
        showLabel(name, ramp(t, T.namesIn, T.namesIn + 0.03) * (1 - ramp(t, 0.6, 0.63)));
      });

      // --- Melkor's marring at the start ---
      const marOn = 1 - ramp(t, 0.07, T.marringEnd);
      for (let i = 0; i < MAR; i++) {
        const b = marOn * (0.35 + 0.65 * hash(i, Math.floor(ambient * 6 + i * 0.3), 62));
        marCol.set([1.0 * b, 0.23 * b, 0.1 * b], i * 3);
      }
      marGeo.attributes.color.needsUpdate = true;
      marring.visible = marOn > 0;

      // --- fire ---
      for (let i = 0; i < FIRE; i++) {
        const l = LAMPS[i % 2];
        const s0 = l.fall[1];
        const h1 = hash(i, 1, 91), h2 = hash(i, 2, 91), h3 = hash(i, 3, 91);
        let x: number, y: number, z: number, b: number;
        if (i % 10 < 7) {
          // Fire pouring out over the land.
          const th = h1 * Math.PI * 2, maxR = 0.2 + Math.sqrt(h2) * 2.2;
          const r = maxR * ramp(t, s0, s0 + 0.03 + 0.09 * h2);
          x = l.impact.x + Math.cos(th) * r; z = l.impact.z + Math.sin(th) * r;
          if (Math.hypot(x, z) > SLAB_RADIUS - 0.05) { const k = (SLAB_RADIUS - 0.05) / Math.hypot(x, z); x *= k; z *= k; }
          const ground = heightAt(x, z, t);
          y = ground + 0.03 + h3 * 0.12 + 0.04 * Math.sin(ambient * 4 + i);
          b = 0.6 * pulse(t, s0 - 0.001, s0 + 0.01 + 0.05 * h2, s0 + 0.14 + 0.1 * h3) * (ground > 0.01 ? 1 : 0.15);
          c.copy(fireHot).lerp(fireMid, h2).lerp(fireCold, ramp(t, s0 + 0.04, s0 + 0.16));
        } else {
          // Sparks thrown up by the blow.
          const u = clamp01((t - s0) / (0.05 + 0.05 * h1));
          const th = h2 * Math.PI * 2, out = u * (0.4 + h3 * 1.6);
          x = l.impact.x + Math.cos(th) * out; z = l.impact.z + Math.sin(th) * out;
          y = heightBefore(l.impact.x, l.impact.z) + 0.2 + u * (1.2 + 2.2 * h1) - u * u * 1.4;
          b = t >= s0 ? (1 - u) : 0;
          c.copy(fireHot).lerp(fireMid, u);
        }
        fPos[i * 3] = x; fPos[i * 3 + 1] = y; fPos[i * 3 + 2] = z;
        fCol[i * 3] = c.r * b; fCol[i * 3 + 1] = c.g * b; fCol[i * 3 + 2] = c.b * b;
      }
      fireGeo.attributes.position.needsUpdate = true;
      fireGeo.attributes.color.needsUpdate = true;
      fire.visible = t > LAMPS[0].fall[1] - 0.002;

      // --- Almaren ---
      const built = ramp(t, T.almaren[0], T.almaren[1]);
      const drowned = ramp(t, 0.72, 0.8);
      almaren.position.set(0, heightBefore(0, 0) - 0.02 - drowned * 0.6, 0);
      almaren.scale.set(1, Math.max(0.001, built), 1);
      almaren.visible = built > 0 && drowned < 1;
      const mingleOn = ramp(t, T.mingle[0], T.mingle[1]) * (1 - ramp(t, 0.6, 0.7));
      hallMat.emissiveIntensity = 0.35 * mingleOn;
      roofMat.emissiveIntensity = 0.5 * mingleOn;
      mingle.position.set(0, heightBefore(0, 0) + 0.35, 0);
      mingle.scale.setScalar(1.6 + 0.2 * Math.sin(ambient * 1.3));
      mingleMat.opacity = mingleOn * 0.6;
      mingle.visible = mingleOn > 0.001;
      showLabel(almarenLabel, ramp(t, T.mingle[0], T.mingle[0] + 0.03) * (1 - ramp(t, 0.6, 0.63)));

      // --- Utumno ---
      const rising = ramp(t, T.utumno[0], T.utumno[1]);
      utumno.position.copy(utumnoAt).setY(heightAt(utumnoAt.x, utumnoAt.z, t) - 1.1 * (1 - rising));
      utumno.visible = rising > 0;
      const uGlow = utumno.visible ? rising * (0.5 + 0.15 * Math.sin(ambient * 2.5)) : 0;
      const ug = utumnoGlow.material as THREE.MeshBasicMaterial;
      ug.opacity = uGlow * (1 - dark * 0.5);
      utumnoGlow.position.copy(utumnoAt).setY(0.5);
      utumnoGlow.scale.setScalar(2.2);
      utumnoGlow.visible = ug.opacity > 0.001;
      for (let i = 0; i < SMOKE; i++) {
        const h1 = hash(i, 1, 99), h2 = hash(i, 2, 99), h3 = hash(i, 3, 99);
        // Each puff loops on ambient time, but how far the cloud has spread is set by t.
        const life = (ambient * 0.05 + h1) % 1;
        const reach = 0.3 + 1.6 * shadowOn;
        const p = utumnoAt.clone().addScaledVector(N, -life * reach).addScaledVector(E, (h2 - 0.5) * (1.2 + life));
        sPos.set([p.x, 0.9 + life * 0.9 + h3 * 0.4, p.z], i * 3);
      }
      smokeGeo.attributes.position.needsUpdate = true;
      smokeMat.opacity = 0.55 * rising * (1 - dark * 0.6);
      smoke.visible = smokeMat.opacity > 0.001;
      showLabel(utumnoLabel, ramp(t, T.utumno[0] + 0.02, T.utumno[1]) * (1 - ramp(t, 0.95, 0.99)));

      // --- the Valar withdraw into the West ---
      const go = ramp(t, T.west[0], T.west[1]);
      const westPos = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0.6, 0), W.clone().multiplyScalar(SLAB_RADIUS + 0.6).setY(1.0), go);
      westGlow.position.copy(westPos);
      westGlow.scale.setScalar(1.2);
      westMat.opacity = pulse(t, T.west[0] - 0.01, T.west[0] + 0.03, T.west[1] + 0.02) * 0.8;
      westGlow.visible = westMat.opacity > 0.001;
      amanGlow.position.copy(W).multiplyScalar(SLAB_RADIUS + 0.9).setY(0.7);
      amanGlow.scale.setScalar(4.2);
      amanMat.opacity = ramp(t, T.west[1] - 0.04, T.west[1] + 0.02) * (0.4 + 0.05 * Math.sin(ambient));
      amanGlow.visible = amanMat.opacity > 0.001;

      // --- light and sky ---
      hemi.intensity = 0.5 + 0.45 * lit * (1 - dark) + 0.25 * dark;
      hemi.color.set('#aab8dc').lerp(new THREE.Color('#fff2da'), lit * (1 - dark));
      sun.intensity = 0.2 + 0.45 * lit * (1 - dark) + 0.1 * dark;
      sun.color.set('#fff4e0').lerp(new THREE.Color('#9fb2e0'), dark);
      sun.position.set(-3, 10, 5);
      starMat.opacity = (0.6 - 0.45 * lit * (1 - dark) + 0.3 * ramp(t, T.stars[0], T.stars[1])) * (0.8 + 0.2 * Math.sin(ambient * 2));
      shells.forEach((sh, i) => {
        // The inner air glows while the Lamps burn.
        const boost = i === 0 ? 0.5 * lit * (1 - dark) : 0;
        sh.mat.uniforms.uOpacity.value = sh.strength * (0.75 + boost);
        sh.mesh.visible = true;
      });
      for (const g of glows) g.quaternion.copy(camera.quaternion);
    },

    flash(t) {
      return 0.18 * Math.max(...LAMPS.map((l) => pulse(t, l.fall[1] - 0.002, l.fall[1] + 0.002, l.fall[1] + 0.025)));
    },

    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // On narrow screens step back so the whole slab and its Lamps stay in view.
      if (Math.abs(camera.aspect - aspect) > 0.02) {
        aspect = camera.aspect;
        const d = Math.max(18, 5.2 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect));
        camera.position.sub(target).setLength(d).add(target);
      }
    },

    dispose() {
      for (const l of world.labels) l.element.remove();
      disposeTree(scene);
      tex.dispose();
    },
  };
}
