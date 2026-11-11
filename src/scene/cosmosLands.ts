import * as THREE from 'three';
import { clamp01, hash, ramp, smoothNoise } from './util';
import { SLAB_RADIUS } from './cosmosWorld';

/**
 * The lands on Ambar after the Lamps, shared by the cosmos events that show them (the Two
 * Trees, the first Moon and Sun, Beleriand drowned, the Change of the World): Aman in the
 * far West behind the Pelóri, the Great Sea, Middle-earth with Beleriand in its north-west,
 * the Grinding Ice between them in the north, and the Encircling Sea around it all.
 *
 * An original, simplified map drawn for this project (shapes after the descriptions in
 * *The Silmarillion* and the *Ambarkanta*, not traced from any published map).
 *
 * Coordinates: `u` runs west → east and `v` south → north on the slab, in slab units.
 */

const R2 = Math.SQRT1_2;
/** The compass on the slab (the Spring of Arda uses the same one). */
export const N = new THREE.Vector3(R2, 0, -R2);
export const E = new THREE.Vector3(R2, 0, R2);
export const W = E.clone().negate();
export const S = N.clone().negate();

export const toU = (x: number, z: number) => (x + z) * R2;
export const toV = (x: number, z: number) => (x - z) * R2;
/** A point on the slab from map coordinates. */
export function at(u: number, v: number, y = 0, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set((u + v) * R2, y, (u - v) * R2);
}

const nz = (u: number, v: number, f: number, s: number) => smoothNoise(u * f + 40, v * f + 40, s);
/** Smooth bump: 1 at d = 0, 0 at d ≥ w. */
const bump = (d: number, w: number) => { const k = clamp01(1 - d / w); return k * k * (3 - 2 * k); };

// ---------- places ----------
export const EZELLOHAR = { u: -3.0, v: 0.05 };
export const VALMAR = { u: -3.32, v: 0.32 };
export const CALACIRYA = { u: -2.42, v: 0.05 };
export const ERESSEA = { u: -1.82, v: -0.05 };
export const THANGORODRIM = { u: -0.5, v: 2.74 };
export const NUMENOR = { u: -1.62, v: -0.55 };
export const HILDORIEN = { u: 2.75, v: -0.85 };
export const MITHRIM = { u: -0.95, v: 2.42 };

/** The east coast of Aman. */
export const amanCoast = (v: number) => -2.15 + 0.22 * (nz(0, v, 1.4, 41) - 0.5) - 0.3 * clamp01((Math.abs(v) - 2.2) / 1.2);
/** The west coast of Middle-earth in the Elder Days (Beleriand's shore in the north-west). */
export const meCoast = (v: number) => -1.35 + 0.2 * (nz(0, v, 1.7, 45) - 0.5) + 0.85 * ramp(v, 0.35, -0.9);
/** The new coast after Beleriand is drowned: Lindon, west of the Blue Mountains. */
export const lindonCoast = (v: number) => -0.14 + 0.16 * (nz(0, v, 2.2, 51) - 0.5);
/** The Blue Mountains (Ered Luin), running north–south. */
export const ereLuinU = (v: number) => 0.2 + 0.09 * Math.sin(v * 1.9);

export interface LandState {
  /** The Pelóri raised (0 → 1). */
  pelori: number;
  /** Thangorodrim standing over Angband (0 → 1). */
  thangorodrim: number;
  /** Beleriand above the sea (1) or drowned (0). */
  beleriand: number;
  /** Númenor risen (1) or sunk (0). */
  numenor: number;
  /** Aman part of the world (1) or taken out of it (0). */
  aman: number;
  /** The Grinding Ice in the north (1) or open sea (0). */
  ice: number;
}

export const ELDER: LandState = { pelori: 1, thangorodrim: 0, beleriand: 1, numenor: 0, aman: 1, ice: 1 };
export const FIRST_AGE: LandState = { ...ELDER, thangorodrim: 1 };
export const SECOND_AGE: LandState = { pelori: 1, thangorodrim: 0, beleriand: 0, numenor: 1, aman: 1, ice: 0.6 };

/** Where Beleriand goes under the sea (0 stays, 1 drowned). */
export function drownedMask(u: number, v: number): number {
  const vIn = ramp(v, -0.35, 0.15) * (1 - ramp(v, 3.3, 3.7));
  const west = clamp01((lindonCoast(v) - u) / 0.12) * vIn;
  // The Gulf of Lhûn breaks through the mountains.
  const gulfW = 0.1 * (1 - 0.55 * clamp01(u / 0.8));
  const gulf = bump(Math.abs(v - 1.22 - 0.12 * u), gulfW) * (1 - ramp(u, 0.6, 0.85));
  return Math.max(west, gulf * vIn);
}

/** What is left of Beleriand above the waves: a chain of islands off the new coast. */
export function beleriandIslands(u: number, v: number): number {
  let h = 0;
  const isle = (cu: number, cv: number, r: number, top: number, sx = 1) => {
    const d = Math.hypot((u - cu) * sx, v - cv);
    h = Math.max(h, top * bump(d, r) * (0.8 + 0.4 * nz(u, v, 6, 52)) - 0.04);
  };
  isle(-0.5, 2.36, 0.15, 0.36);      // Himling
  isle(-0.74, 2.1, 0.2, 0.3, 1.5);   // Tol Fuin
  isle(-1.02, 1.32, 0.09, 0.22);     // Tol Morwen
  isle(0.02, 2.78, 0.1, 0.3);        // the broken north of the Blue Mountains
  isle(-0.12, 3.02, 0.08, 0.25);
  isle(-0.3, 3.2, 0.07, 0.2);
  return h;
}

/** Thangorodrim: three peaks over Angband. */
export function thangorodrimPeaks(u: number, v: number): number {
  let h = 0;
  for (const [du, dv, top] of [[0, 0, 1.15], [-0.17, -0.08, 0.8], [0.16, -0.07, 0.85]] as const) {
    h = Math.max(h, top * bump(Math.hypot(u - THANGORODRIM.u - du, v - THANGORODRIM.v - dv), 0.2));
  }
  return h;
}

/** Ice: the Helcaraxë between Araman and the north-west of Middle-earth. */
export function iceMask(u: number, v: number): number {
  return ramp(v, 2.85, 3.05) * (1 - ramp(u, -1.2, -0.95));
}

/**
 * Height of the land (unclamped: below 0 is sea floor) at (u, v) in a given state.
 * Sea level is 0; the Encircling Sea runs round the rim.
 */
export function landHeight(u: number, v: number, s: LandState): number {
  const r = Math.hypot(u, v);
  let h = -0.3;

  // --- Aman: Valinor on its plain, the Pelóri along its east coast ---
  const da = amanCoast(v) - u;
  if (da > -0.1 && s.aman > 0) {
    const shore = clamp01(da / 0.12);
    let a = (0.09 + 0.07 * nz(u, v, 1.6, 43)) * shore - 0.06 * (1 - shore);
    const gap = 1 - 0.9 * bump(Math.abs(v - CALACIRYA.v), 0.3);
    const ridge = bump(Math.abs(da - 0.3), 0.24) * (0.7 + 0.5 * nz(u, v, 4.2, 44)) * gap;
    a += 0.88 * ridge * s.pelori;
    // Ezellohar's plain stays low and level.
    a -= 0.04 * bump(Math.hypot(u - EZELLOHAR.u, v - EZELLOHAR.v), 0.5);
    h = Math.max(h, a);
  }
  // Tol Eressëa, in the Bay of Eldamar.
  if (s.aman > 0) {
    const de = Math.hypot((u - ERESSEA.u) * 1.7, v - ERESSEA.v);
    h = Math.max(h, 0.2 * bump(de, 0.36) * (0.8 + 0.4 * nz(u, v, 5, 49)) - 0.035);
  }

  // --- Middle-earth ---
  const dm = u - meCoast(v);
  if (dm > -0.1) {
    const shore = clamp01(dm / 0.1);
    let m = 0.06 + 0.2 * nz(u, v, 1.1, 46) + 0.07 * nz(u, v, 2.9, 47);
    const jag = 0.7 + 0.5 * nz(u, v, 5, 48);
    // Ered Luin.
    m += 0.5 * bump(Math.abs(u - ereLuinU(v)), 0.17) * bump(Math.max(0, Math.abs(v - 1.2) - 1.35), 0.3) * jag;
    // Ered Wethrin, round Hithlum.
    m += 0.38 * bump(Math.abs(v - 2.25 - 0.25 * (u + 1)), 0.11) * bump(Math.max(0, Math.abs(u + 0.95) - 0.3), 0.2) * jag;
    // The Iron Mountains along the north.
    m += 0.55 * bump(Math.abs(v - 3.02 - 0.08 * Math.sin(u * 2)), 0.2) * bump(Math.max(0, Math.abs(u - 0.2) - 1.3), 0.3) * jag;
    // Dorthonion's highland.
    m += 0.16 * bump(Math.hypot(u + 0.55, (v - 2.12) * 1.6), 0.38);
    // The Misty Mountains.
    m += 0.55 * bump(Math.abs(u - 1.45 - 0.12 * Math.sin(v * 1.4)), 0.15) * bump(Math.max(0, Math.abs(v - 0.35) - 1.8), 0.3) * jag;
    // The Red Mountains of the East (Orocarni).
    m += 0.45 * bump(Math.abs(u - 3.1 - 0.1 * Math.sin(v * 2)), 0.16) * bump(Math.max(0, Math.abs(v - 1) - 1.2), 0.3) * jag;
    // The inland sea of Helcar where Illuin stood (smaller, as the Sea of Rhûn, after the First Age).
    const old = s.beleriand;
    m -= 0.9 * bump(Math.hypot(u - 2.15, v - 1.85), 0.5 + 0.2 * old + 0.1 * nz(u, v, 3, 50));
    m += s.thangorodrim * thangorodrimPeaks(u, v);
    m = m * shore - 0.08 * (1 - shore);
    // Beleriand drowned: the sea in, a few islands out.
    if (s.beleriand < 1) {
      const d = drownedMask(u, v) * (1 - s.beleriand);
      m = Math.max(m * (1 - d) - 0.12 * d, beleriandIslands(u, v) * d);
    }
    h = Math.max(h, m);
  }

  // The Helcaraxë: a bridge of ice between the continents in the north.
  if (s.ice > 0) {
    const m = iceMask(u, v) * (0.75 + 0.5 * nz(u, v, 3.5, 54));
    if (m > 0.35 * (2 - s.ice)) h = Math.max(h, 0.035);
  }

  // Númenor: a five-pointed star with Meneltarma in its middle.
  if (s.numenor > 0) {
    const du = u - NUMENOR.u, dv = v - NUMENOR.v, dn = Math.hypot(du, dv);
    const arms = 0.5 + 0.5 * Math.cos(5 * (Math.atan2(dv, du) - 0.35));
    const reach = 0.16 + 0.24 * arms * arms;
    const isl = (0.12 + 0.05 * nz(u, v, 6, 53)) * bump(dn, reach) + 0.5 * bump(dn, 0.1) - 0.02;
    h = Math.max(h, isl - (1 - s.numenor) * 0.75);
  }

  // The Encircling Sea round the rim.
  const rim = clamp01((3.82 - r) / 0.14);
  return h * rim - 0.25 * (1 - rim);
}

const C = (h: string) => new THREE.Color(h);
const PAL = {
  sea: C('#2f6a86'), shallow: C('#4f93ad'), ice: C('#dfe9f2'),
  low: C('#6f9a52'), low2: C('#8fb062'), upland: C('#8e8a5e'), stone: C('#8a7d6c'), snow: C('#ebe8e3'),
  amanLow: C('#7fc25a'), amanLow2: C('#a3d36a'), pelori: C('#d8d0bf'),
  dark: C('#33403a'),
};

/** The colour of the land or sea at (u, v) (`raw` = unclamped height, `seed` a per-face random). */
export function landColor(u: number, v: number, raw: number, seed: number, c: THREE.Color): THREE.Color {
  if (raw <= 0.001) {
    c.copy(PAL.sea).lerp(PAL.shallow, clamp01(1 + raw / 0.12) * 0.7);
    return c.offsetHSL(0, 0, (seed - 0.5) * 0.03);
  }
  if (iceMask(u, v) > 0.5 && raw < 0.06) return c.copy(PAL.ice).offsetHSL(0, 0, (seed - 0.5) * 0.04);
  const aman = u < amanCoast(v) + 0.05 || Math.hypot((u - ERESSEA.u) * 1.7, v - ERESSEA.v) < 0.4;
  if (aman) {
    c.copy(PAL.amanLow).lerp(PAL.amanLow2, seed);
    c.lerp(PAL.pelori, clamp01((raw - 0.25) / 0.25));
    c.lerp(PAL.snow, clamp01((raw - 0.7) / 0.2));
  } else {
    c.copy(PAL.low).lerp(PAL.low2, seed * 0.8);
    c.lerp(PAL.upland, clamp01((raw - 0.24) / 0.14));
    c.lerp(PAL.stone, clamp01((raw - 0.42) / 0.12));
    c.lerp(PAL.snow, clamp01((raw - 0.78) / 0.2));
  }
  return c.offsetHSL(0, 0, (seed - 0.5) * 0.05);
}

/** Fill a height array for every grid point of a slab (by its x, z) in a given state. */
export function heightsFor(gx: Float32Array, gz: Float32Array, s: LandState): Float32Array {
  const out = new Float32Array(gx.length);
  for (let k = 0; k < gx.length; k++) out[k] = landHeight(toU(gx[k], gz[k]), toV(gx[k], gz[k]), s);
  return out;
}

// ---------- small things on the land ----------

/** Concatenate non-indexed geometries (positions only, plus an optional colour per part). */
export function mergeFlat(parts: { geo: THREE.BufferGeometry; color?: THREE.Color }[]): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  for (const { geo, color } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    if (color) for (let i = 0; i < p.length / 3; i++) col.push(color.r, color.g, color.b);
    if (g !== geo) g.dispose();
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (col.length) out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/** A small ship (hull and one sail), pointing along +z: Númenor's fleet, the Elves' ships, Vingilot. */
export function shipGeo(hull: string, sail: string): THREE.BufferGeometry {
  const h = new THREE.ConeGeometry(0.35, 1.6, 4);
  h.rotateX(Math.PI / 2); h.scale(1, 0.45, 1); h.translate(0, 0.12, 0);
  const s = new THREE.ConeGeometry(0.42, 1.0, 3);
  s.scale(0.25, 1, 1); s.translate(0, 0.62, -0.05);
  return mergeFlat([{ geo: h, color: new THREE.Color(hull) }, { geo: s, color: new THREE.Color(sail) }]);
}

/**
 * Forests of small two-tiered conifers, merged into one mesh. Each frame the event says
 * how high the ground is under each tree and how big the tree is (0 hides it).
 */
export class Forest {
  readonly mesh: THREE.Mesh;
  readonly at: { x: number; z: number; s: number; d: number }[] = [];
  private readonly pos: Float32Array;
  private static readonly TREE: number[] = (() => {
    const t: number[] = [];
    for (const [r, y0, y1] of [[0.07, 0.03, 0.17], [0.05, 0.11, 0.26]]) {
      for (let s = 0; s < 6; s++) {
        const a0 = (s / 6) * Math.PI * 2, a1 = ((s + 1) / 6) * Math.PI * 2;
        t.push(Math.cos(a0) * r, y0, Math.sin(a0) * r, 0, y1, 0, Math.cos(a1) * r, y0, Math.sin(a1) * r);
      }
    }
    return t;
  })();

  /** `where(u, v)` gives the chance of a tree there (0 → none). */
  constructor(count: number, where: (u: number, v: number) => number, seed = 51, hue = 0.28) {
    const TV = Forest.TREE.length / 3;
    const col: number[] = [];
    for (let k = 0; this.at.length < count && k < count * 30; k++) {
      const r = Math.sqrt(hash(k, 1, seed)) * 3.75, a = hash(k, 2, seed) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (hash(k, 7, seed) > where(toU(x, z), toV(x, z))) continue;
      const c = new THREE.Color().setHSL(hue + hash(k, 5, seed) * 0.07, 0.4, 0.22 + hash(k, 6, seed) * 0.1);
      for (let v = 0; v < TV; v++) col.push(c.r, c.g, c.b);
      this.at.push({ x, z, s: 0.65 + hash(k, 3, seed) * 0.6, d: hash(k, 4, seed) });
    }
    this.pos = new Float32Array(this.at.length * TV * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
  }

  update(ground: (i: number) => number, size: (i: number) => number): void {
    const T = Forest.TREE, TV = T.length / 3;
    for (let i = 0; i < this.at.length; i++) {
      const tr = this.at[i], s = size(i) * tr.s, y = ground(i);
      for (let v = 0, o = i * TV * 3; v < TV; v++, o += 3) {
        this.pos[o] = tr.x + T[v * 3] * s;
        this.pos[o + 1] = y - 0.01 + T[v * 3 + 1] * s;
        this.pos[o + 2] = tr.z + T[v * 3 + 2] * s;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
  }
}

// ---------- the Two Trees ----------

export interface TreeParts {
  group: THREE.Group;
  /** Additive light of the bright leaves (silver undersides, golden rims): opacity = its light. */
  glowMat: THREE.MeshBasicMaterial;
  /** Laurelin's hanging flame-blossoms (Telperion has none). */
  blossomMat?: THREE.MeshBasicMaterial;
  bark: THREE.MeshStandardMaterial;
  leaves: THREE.MeshStandardMaterial;
  /** Where its light hangs, in the tree's own space. */
  crown: THREE.Vector3;
  color: THREE.Color;
}

/**
 * One of the Two Trees: a slender trunk and a faceted crown. Telperion's leaves are dark
 * above and silver below; Laurelin's are fresh green rimmed with gold, with flame-like
 * blossoms hanging under the crown.
 */
export function buildTree(kind: 'telperion' | 'laurelin'): TreeParts {
  const silver = kind === 'telperion';
  const group = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: silver ? '#9aa1a8' : '#8a6a3c', flatShading: true, roughness: 0.7 });
  const trunkParts: { geo: THREE.BufferGeometry }[] = [];
  const trunk = new THREE.CylinderGeometry(0.03, 0.065, 0.62, 6);
  trunk.translate(0, 0.31, 0);
  trunkParts.push({ geo: trunk });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.CylinderGeometry(0.012, 0.022, 0.26, 5);
    b.translate(0, 0.13, 0);
    b.rotateZ(0.75);
    b.rotateY((i / 3) * Math.PI * 2 + (silver ? 0.4 : 1.1));
    b.translate(0, 0.42 + i * 0.05, 0);
    trunkParts.push({ geo: b });
  }
  group.add(new THREE.Mesh(mergeFlat(trunkParts), bark));

  // The crown: a cluster of faceted blobs, coloured face by face.
  const top = C(silver ? '#3b6656' : '#93d052'), under = C(silver ? '#dfe8f2' : '#b8dc62'), rim = C(silver ? '#b8c6d4' : '#f2c24a');
  const crownPos: number[] = [], crownCol: number[] = [], glowCol: number[] = [];
  const blobs = silver
    ? [[0, 0.78, 0, 0.27], [0.2, 0.68, 0.06, 0.18], [-0.18, 0.7, -0.08, 0.19], [0.04, 0.66, -0.2, 0.17], [-0.06, 0.68, 0.2, 0.17], [0.02, 0.95, 0.02, 0.16]]
    : [[0, 0.8, 0, 0.26], [0.19, 0.7, -0.08, 0.18], [-0.2, 0.69, 0.05, 0.18], [0.06, 0.68, 0.21, 0.17], [-0.05, 0.7, -0.2, 0.16], [0, 0.98, 0, 0.15]];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const col = new THREE.Color(), glow = new THREE.Color();
  blobs.forEach(([x, y, z, r], bi) => {
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(1, 0.78, 1);
    g.translate(x, y, z);
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 9) {
      a.fromArray(p, i); b.fromArray(p, i + 3); c.fromArray(p, i + 6);
      n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      const s = hash(i, bi, silver ? 3 : 4);
      if (silver) {
        // Dark above, pale silver below.
        const k = clamp01((-n.y + 0.15) * 1.6);
        col.copy(top).lerp(under, k).offsetHSL(0, 0, (s - 0.5) * 0.05);
        // The silver shows at the edges of the leaves even from above.
        glow.copy(under).multiplyScalar(0.16 + k * 0.7 + 0.25 * clamp01(0.6 - Math.abs(n.y)));
      } else {
        // Fresh green, rimmed with gold where the facets turn away.
        const k = clamp01((0.55 - Math.abs(n.y)) * 2.2) * (0.6 + 0.4 * s);
        col.copy(top).lerp(under, s * 0.5).lerp(rim, k);
        glow.copy(rim).multiplyScalar(k * 0.9 + 0.18);
      }
      for (let q = 0; q < 3; q++) {
        crownPos.push(p[i + q * 3], p[i + q * 3 + 1], p[i + q * 3 + 2]);
        crownCol.push(col.r, col.g, col.b);
        glowCol.push(glow.r, glow.g, glow.b);
      }
    }
    g.dispose();
  });
  const crownGeo = new THREE.BufferGeometry();
  crownGeo.setAttribute('position', new THREE.Float32BufferAttribute(crownPos, 3));
  crownGeo.setAttribute('color', new THREE.Float32BufferAttribute(crownCol, 3));
  const leaves = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 });
  group.add(new THREE.Mesh(crownGeo, leaves));
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(crownPos.map((v) => v), 3));
  glowGeo.setAttribute('color', new THREE.Float32BufferAttribute(glowCol, 3));
  const glowMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  let blossomMat: THREE.MeshBasicMaterial | undefined;
  if (!silver) {
    const parts: { geo: THREE.BufferGeometry }[] = [];
    for (let i = 0; i < 16; i++) {
      const g = new THREE.ConeGeometry(0.034, 0.11, 5);
      g.rotateX(Math.PI); // hanging, point down
      const ang = hash(i, 1, 7) * Math.PI * 2, rr = 0.16 + hash(i, 2, 7) * 0.16;
      g.translate(Math.cos(ang) * rr, 0.55 + hash(i, 3, 7) * 0.06, Math.sin(ang) * rr);
      parts.push({ geo: g });
    }
    blossomMat = new THREE.MeshBasicMaterial({ color: '#5a4a2a' });
    group.add(new THREE.Mesh(mergeFlat(parts), blossomMat));
  }
  return { group, glowMat, blossomMat, bark, leaves, crown: new THREE.Vector3(0, 0.62, 0), color: C(silver ? '#dfeaff' : '#ffcf66') };
}

/** Light falling from a tree as drops: positions loop on `ambient`, brightness set by the event. */
export function fillDrops(pos: Float32Array, col: Float32Array, from: number, count: number, base: THREE.Vector3, scale: number, ambient: number, color: THREE.Color, b: number, seed: number): void {
  for (let i = 0; i < count; i++) {
    const k = from + i;
    const h1 = hash(i, 1, seed), h2 = hash(i, 2, seed), h3 = hash(i, 3, seed);
    const life = (ambient * (0.18 + 0.12 * h3) + h1) % 1;
    const ang = h2 * Math.PI * 2, rr = (0.05 + 0.26 * Math.sqrt(h3)) * scale;
    pos[k * 3] = base.x + Math.cos(ang) * rr;
    pos[k * 3 + 1] = base.y + (0.6 - life * 0.62) * scale;
    pos[k * 3 + 2] = base.z + Math.sin(ang) * rr;
    const fade = b * Math.sin(life * Math.PI) * (0.5 + 0.5 * h1);
    col[k * 3] = color.r * fade; col[k * 3 + 1] = color.g * fade; col[k * 3 + 2] = color.b * fade;
  }
}

// ---------- the slab ----------

/** Paint one face of a slab: set its colour `c` and glow `g`; return false to leave it out. */
export type SlabPaint = (f: number, water: boolean, yMax: number, c: THREE.Color, g: THREE.Color) => boolean;
/** Move a point of the flat slab (x, y, z) somewhere else (the world bending round). */
export type SlabWarp = (x: number, y: number, z: number, out: THREE.Vector3) => void;

/**
 * Ambar as a faceted disc of rings and segments with cut earth sides and a rough crag
 * below, the same diorama language as the Spring of Arda. Fill `gy` (the height of every
 * grid point) and call `update` each frame; colours come from `paint`.
 */
export class Slab {
  readonly nv: number;
  readonly nt: number;
  /** Grid point positions on the disc, and their heights (set by the event). */
  readonly gx: Float32Array; readonly gz: Float32Array; readonly gy: Float32Array;
  /** Triangles as grid-point triples; face centres and a stable random per face. */
  readonly tris: Uint32Array; readonly fx: Float32Array; readonly fz: Float32Array; readonly seed: Float32Array;
  readonly top: THREE.Mesh; readonly glow: THREE.Mesh; readonly under: THREE.Mesh;
  readonly topMat: THREE.MeshStandardMaterial; readonly rockMat: THREE.MeshStandardMaterial;
  private readonly wx: Float32Array; private readonly wy: Float32Array; private readonly wz: Float32Array;
  private readonly topPos: Float32Array; private readonly topCol: Float32Array; private readonly glowCol: Float32Array;
  private readonly underPos: Float32Array;
  private readonly v = new THREE.Vector3();
  private readonly c = new THREE.Color();
  private readonly g = new THREE.Color();

  constructor(readonly rings = 24, readonly segs = 96, seed = 3) {
    this.nv = (rings + 1) * (segs + 1);
    this.gx = new Float32Array(this.nv); this.gz = new Float32Array(this.nv); this.gy = new Float32Array(this.nv);
    this.wx = new Float32Array(this.nv); this.wy = new Float32Array(this.nv); this.wz = new Float32Array(this.nv);
    for (let ri = 0; ri <= rings; ri++) {
      for (let si = 0; si <= segs; si++) {
        const r = (ri / rings) * SLAB_RADIUS, a = (si / segs) * Math.PI * 2;
        const j = ri > 0 && ri < rings ? 0.05 : 0;
        const k = ri * (segs + 1) + si;
        this.gx[k] = Math.cos(a) * r + (hash(ri, si % segs, seed) - 0.5) * j;
        this.gz[k] = Math.sin(a) * r + (hash(ri, si % segs, seed + 1) - 0.5) * j;
      }
    }
    const tris: number[] = [];
    for (let ri = 0; ri < rings; ri++) {
      for (let si = 0; si < segs; si++) {
        const a = this.gi(ri, si), b = this.gi(ri, si + 1), c = this.gi(ri + 1, si), d = this.gi(ri + 1, si + 1);
        if (ri === 0) tris.push(a, d, c);
        else tris.push(a, b, c, b, d, c);
      }
    }
    this.tris = Uint32Array.from(tris);
    this.nt = tris.length / 3;
    this.fx = new Float32Array(this.nt); this.fz = new Float32Array(this.nt); this.seed = new Float32Array(this.nt);
    for (let f = 0; f < this.nt; f++) {
      const [a, b, c] = [tris[f * 3], tris[f * 3 + 1], tris[f * 3 + 2]];
      this.fx[f] = (this.gx[a] + this.gx[b] + this.gx[c]) / 3;
      this.fz[f] = (this.gz[a] + this.gz[b] + this.gz[c]) / 3;
      this.seed[f] = hash(f, 3, seed + 17);
    }

    this.topPos = new Float32Array(this.nt * 9);
    this.topCol = new Float32Array(this.nt * 9);
    this.glowCol = new Float32Array(this.nt * 9);
    const posAttr = new THREE.BufferAttribute(this.topPos, 3);
    const topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute('position', posAttr);
    topGeo.setAttribute('color', new THREE.BufferAttribute(this.topCol, 3));
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', posAttr);
    glowGeo.setAttribute('color', new THREE.BufferAttribute(this.glowCol, 3));
    this.underPos = new Float32Array(segs * 27);
    const underGeo = new THREE.BufferGeometry();
    underGeo.setAttribute('position', new THREE.BufferAttribute(this.underPos, 3));

    this.topMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
    this.rockMat = new THREE.MeshStandardMaterial({ color: '#7d6a55', flatShading: true, roughness: 1, side: THREE.DoubleSide });
    this.top = new THREE.Mesh(topGeo, this.topMat);
    this.glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    this.under = new THREE.Mesh(underGeo, this.rockMat);
  }

  gi(ri: number, si: number): number { return ri * (this.segs + 1) + (si % this.segs); }

  /** Rebuild the surface from `gy`, painting every face, optionally bending it with `warp`. */
  update(paint: SlabPaint, warp?: SlabWarp): void {
    const { gx, gy, gz, wx, wy, wz, tris, topPos, topCol, glowCol, c, g, v } = this;
    for (let k = 0; k < this.nv; k++) {
      if (warp) { warp(gx[k], gy[k], gz[k], v); wx[k] = v.x; wy[k] = v.y; wz[k] = v.z; }
      else { wx[k] = gx[k]; wy[k] = gy[k]; wz[k] = gz[k]; }
    }
    for (let f = 0; f < this.nt; f++) {
      const a = tris[f * 3], b = tris[f * 3 + 1], d = tris[f * 3 + 2];
      const water = (gy[a] <= 0.001 ? 1 : 0) + (gy[b] <= 0.001 ? 1 : 0) + (gy[d] <= 0.001 ? 1 : 0) >= 2;
      g.setRGB(0, 0, 0);
      const o = f * 9;
      if (!paint(f, water, Math.max(gy[a], gy[b], gy[d]), c, g)) {
        topPos.fill(0, o, o + 9);
        continue;
      }
      topPos[o] = wx[a]; topPos[o + 1] = wy[a]; topPos[o + 2] = wz[a];
      topPos[o + 3] = wx[b]; topPos[o + 4] = wy[b]; topPos[o + 5] = wz[b];
      topPos[o + 6] = wx[d]; topPos[o + 7] = wy[d]; topPos[o + 8] = wz[d];
      for (let q = 0; q < 9; q += 3) {
        topCol[o + q] = c.r; topCol[o + q + 1] = c.g; topCol[o + q + 2] = c.b;
        glowCol[o + q] = g.r; glowCol[o + q + 1] = g.g; glowCol[o + q + 2] = g.b;
      }
    }
    const topGeo = this.top.geometry, glowGeo = this.glow.geometry;
    topGeo.attributes.position.needsUpdate = true;
    topGeo.attributes.color.needsUpdate = true;
    glowGeo.attributes.color.needsUpdate = true;
    topGeo.computeBoundingSphere();
    glowGeo.boundingSphere = topGeo.boundingSphere;

    // The cut earth sides: rim → jagged ring → a rough point below.
    const p = (x: number, y: number, z: number, i: number) => {
      if (warp) { warp(x, y, z, v); x = v.x; y = v.y; z = v.z; }
      this.underPos[i] = x; this.underPos[i + 1] = y; this.underPos[i + 2] = z;
    };
    const R = this.rings, segs = this.segs;
    for (let si = 0; si < segs; si++) {
      const k0 = this.gi(R, si), k1 = this.gi(R, si + 1);
      const s0 = 0.82 - hash(si % segs, 6, 9) * 0.12, s1 = 0.82 - hash((si + 1) % segs, 6, 9) * 0.12;
      const d0 = -0.9 - hash(si % segs, 5, 9) * 0.9, d1 = -0.9 - hash((si + 1) % segs, 5, 9) * 0.9;
      const o = si * 27;
      // rim0, in0, rim1 | rim1, in0, in1 | in0, tip, in1, written straight into underPos.
      const r0x = gx[k0], r0y = gy[k0], r0z = gz[k0], r1x = gx[k1], r1y = gy[k1], r1z = gz[k1];
      const i0x = r0x * s0, i0z = r0z * s0, i1x = r1x * s1, i1z = r1z * s1;
      p(r0x, r0y, r0z, o); p(i0x, d0, i0z, o + 3); p(r1x, r1y, r1z, o + 6);
      p(r1x, r1y, r1z, o + 9); p(i0x, d0, i0z, o + 12); p(i1x, d1, i1z, o + 15);
      p(i0x, d0, i0z, o + 18); p(0, -3.2, 0, o + 21); p(i1x, d1, i1z, o + 24);
    }
    this.under.geometry.attributes.position.needsUpdate = true;
    this.under.geometry.computeBoundingSphere();
  }
}
