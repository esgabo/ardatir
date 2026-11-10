import * as THREE from 'three';
import { clamp01, hash } from './util';
import { Glows, SLAB_RADIUS, type CosmosWorld } from './cosmosWorld';
import { landColor, landHeight, toU, toV, type LandState } from './cosmosLands';

/**
 * What the foretold cosmos events share (docs/DESIGN.md §4.8): the dream register that keeps
 * prophecy from reading as history, the round world as a globe that can break and be made
 * again, the Silmarils, and Eärendil's light.
 *
 * The register: a violet-tinted Void, a slow pale mist, colours drawn a little towards a pale
 * lavender ivory, and (in style.css, `body.foretold-stage`) soft, hazy edges round the stage.
 */

const PALE = new THREE.Color('#e9e3f5');

/** Draw a colour a little towards the pale dream palette. */
export function pale(c: THREE.Color, k = 0.18): THREE.Color {
  return c.lerp(PALE, k);
}

export interface Dream {
  /** Drift the mist (`ambient` only: idle motion), at a strength 0 → 1. */
  update(ambient: number, strength?: number): void;
}

/** Turn a cosmos world into a foretold one: the Void's tint and a slow pale mist. */
export function dreamWorld(world: CosmosWorld, radius = 9, centre = new THREE.Vector3()): Dream {
  world.scene.background = new THREE.Color('#0a0919');
  const n = 520, base = new Float32Array(n * 3), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = radius * (0.45 + 0.75 * Math.cbrt(hash(i, 1, 91))), th = hash(i, 2, 91) * Math.PI * 2, ph = Math.acos(2 * hash(i, 3, 91) - 1);
    base.set([centre.x + r * Math.sin(ph) * Math.cos(th), centre.y + r * Math.cos(ph) * 0.7, centre.z + r * Math.sin(ph) * Math.sin(th)], i * 3);
    const c = new THREE.Color().setHSL(0.66 + hash(i, 4, 91) * 0.14, 0.45, 0.72);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.1 * radius, map: world.tex, vertexColors: true, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mist = new THREE.Points(geo, mat);
  world.scene.add(mist);
  return {
    update(ambient, strength = 1) {
      for (let i = 0; i < n; i++) {
        const k = i * 3, s = 0.05 + 0.05 * hash(i, 5, 91);
        pos[k] = base[k] + Math.sin(ambient * s + i) * 0.5;
        pos[k + 1] = base[k + 1] + Math.sin(ambient * s * 0.7 + i * 1.3) * 0.25;
        pos[k + 2] = base[k + 2] + Math.cos(ambient * s + i * 0.7) * 0.5;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeBoundingSphere();
      mat.opacity = 0.05 * strength;
      mist.visible = strength > 0.01;
    },
  };
}

/** Set Ilmen's stars further out, beyond the Walls, so they never sit in front of a globe. */
export function farStars(world: CosmosWorld, scale = 2.4): void {
  world.scene.traverse((o) => {
    if ((o as THREE.Points).isPoints && (o as THREE.Points).material === world.starMat) {
      o.scale.set(scale, scale * 0.8, scale);
      o.position.y = -3;
    }
  });
}

// ---------- the round world ----------

/** The world after the Change: no Aman, no Númenor, Beleriand long drowned. */
export const ROUND_WORLD: LandState = { pelori: 0, thangorodrim: 0, beleriand: 0, numenor: 0, aman: 0, ice: 0.5 };

/** The unit direction on the globe for a point of the flat map (the slab's centre at the top). */
export function globeDir(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const r = Math.hypot(x, z), a = Math.atan2(z, x), th = (r / SLAB_RADIUS) * Math.PI;
  return out.set(Math.sin(th) * Math.cos(a), Math.cos(th), Math.sin(th) * Math.sin(a));
}

/**
 * The round world as a faceted globe, coloured from the same map as the slab. It is cut
 * into a few great pieces that can part and come back together (the Earth broken and made
 * again); faces near the cuts know it (`crack`), so they can glow.
 */
export class Globe {
  readonly group = new THREE.Group();
  readonly top: THREE.Mesh;
  readonly glow: THREE.Mesh;
  readonly topMat: THREE.MeshStandardMaterial;
  readonly nf: number;
  /** Per face: its centre direction, the piece it belongs to, how near a cut, water or land. */
  readonly dir: Float32Array; readonly piece: Uint8Array; readonly crack: Float32Array; readonly water: Uint8Array;
  /** Per face: its colour on the map. */
  readonly base: Float32Array;
  private readonly basePos: Float32Array; private readonly pos: Float32Array;
  private readonly col: Float32Array; private readonly glowCol: Float32Array;
  private readonly seeds: THREE.Vector3[] = [];
  private readonly c = new THREE.Color(); private readonly g = new THREE.Color();

  constructor(state: LandState, readonly radius: number, detail = 22, pieces = 11, seed = 5) {
    const ico = new THREE.IcosahedronGeometry(1, detail);
    const unit = ico.attributes.position.array as Float32Array;
    ico.dispose();
    this.nf = unit.length / 9;
    this.basePos = new Float32Array(unit.length);
    this.pos = new Float32Array(unit.length);
    this.col = new Float32Array(unit.length);
    this.glowCol = new Float32Array(unit.length);
    this.dir = new Float32Array(this.nf * 3);
    this.piece = new Uint8Array(this.nf);
    this.crack = new Float32Array(this.nf);
    this.water = new Uint8Array(this.nf);
    this.base = new Float32Array(this.nf * 3);

    // The pieces: points spread over the sphere, a little jittered.
    for (let i = 0; i < pieces; i++) {
      const y = 1 - (2 * (i + 0.5)) / pieces, r = Math.sqrt(1 - y * y), a = i * 2.39996 + hash(i, 1, seed) * 0.6;
      this.seeds.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).normalize());
    }

    const heightAt = (x: number, y: number, z: number) => {
      const th = Math.acos(Math.max(-1, Math.min(1, y))), a = Math.atan2(z, x), r = (th / Math.PI) * SLAB_RADIUS * 0.985;
      const sx = Math.cos(a) * r, sz = Math.sin(a) * r;
      return { h: landHeight(toU(sx, sz), toV(sx, sz), state), u: toU(sx, sz), v: toV(sx, sz) };
    };
    const d = new THREE.Vector3();
    for (let f = 0; f < this.nf; f++) {
      let raw = 0, wet = 0;
      d.set(0, 0, 0);
      for (let q = 0; q < 3; q++) {
        const o = f * 9 + q * 3, x = unit[o], y = unit[o + 1], z = unit[o + 2];
        const { h } = heightAt(x, y, z);
        raw += h / 3;
        if (h <= 0.001) wet++;
        const s = radius * (1 + Math.max(0, h) * 0.075);
        this.basePos[o] = x * s; this.basePos[o + 1] = y * s; this.basePos[o + 2] = z * s;
        d.x += x; d.y += y; d.z += z;
      }
      d.normalize();
      this.dir.set([d.x, d.y, d.z], f * 3);
      const { u, v } = heightAt(d.x, d.y, d.z);
      this.water[f] = wet >= 2 ? 1 : 0;
      landColor(u, v, this.water[f] ? Math.min(raw, 0) : Math.max(raw, 0.01), hash(f, 3, seed + 17), this.c);
      this.base.set([this.c.r, this.c.g, this.c.b], f * 3);
      // Nearest and second-nearest piece: a face between two is on a cut.
      let a1 = 9, a2 = 9, p = 0;
      this.seeds.forEach((s, i) => {
        const ang = Math.acos(Math.min(1, Math.max(-1, s.dot(d))));
        if (ang < a1) { a2 = a1; a1 = ang; p = i; } else if (ang < a2) a2 = ang;
      });
      this.piece[f] = p;
      this.crack[f] = clamp01(1 - (a2 - a1) / 0.07);
    }
    this.pos.set(this.basePos);

    const posAttr = new THREE.BufferAttribute(this.pos, 3);
    const topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute('position', posAttr);
    topGeo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    topGeo.computeBoundingSphere();
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', posAttr);
    glowGeo.setAttribute('color', new THREE.BufferAttribute(this.glowCol, 3));
    glowGeo.boundingSphere = topGeo.boundingSphere;
    this.topMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, side: THREE.DoubleSide });
    this.top = new THREE.Mesh(topGeo, this.topMat);
    this.glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    this.group.add(this.top, this.glow);
  }

  /** The direction of a piece, so a scene can tell how far it has moved. */
  pieceDir(p: number): THREE.Vector3 { return this.seeds[p]; }

  /**
   * Repaint (and part, 0 → together) the globe. `paint` gets each face's map colour in
   * `col` and a black `glow` to change.
   */
  update(part: number, paint: (f: number, col: THREE.Color, glow: THREE.Color) => void): void {
    const { pos, basePos, col, glowCol, c, g } = this;
    for (let f = 0; f < this.nf; f++) {
      const o = f * 9;
      if (part > 1e-4) {
        const s = this.seeds[this.piece[f]], k = part * (0.75 + 0.5 * hash(this.piece[f], 2, 7));
        for (let q = 0; q < 9; q += 3) {
          pos[o + q] = basePos[o + q] + s.x * k; pos[o + q + 1] = basePos[o + q + 1] + s.y * k; pos[o + q + 2] = basePos[o + q + 2] + s.z * k;
        }
      } else for (let q = 0; q < 9; q++) pos[o + q] = basePos[o + q];
      c.setRGB(this.base[f * 3], this.base[f * 3 + 1], this.base[f * 3 + 2]);
      g.setRGB(0, 0, 0);
      paint(f, c, g);
      for (let q = 0; q < 9; q += 3) {
        col[o + q] = c.r; col[o + q + 1] = c.g; col[o + q + 2] = c.b;
        glowCol[o + q] = g.r; glowCol[o + q + 1] = g.g; glowCol[o + q + 2] = g.b;
      }
    }
    const tg = this.top.geometry;
    tg.attributes.position.needsUpdate = true;
    tg.attributes.color.needsUpdate = true;
    this.glow.geometry.attributes.color.needsUpdate = true;
    if (tg.boundingSphere) tg.boundingSphere.radius = this.radius * 1.2 + part * 1.3;
  }
}

// ---------- the Silmarils ----------

/** One Silmaril: a small faceted jewel holding the mingled light of the Two Trees. */
export class Jewel {
  readonly mesh: THREE.Mesh;
  private readonly core: THREE.Mesh;
  private readonly halo: THREE.Mesh;
  private readonly silver: THREE.Mesh;

  constructor(scene: THREE.Scene, glows: Glows) {
    const geo = new THREE.OctahedronGeometry(0.075, 0);
    geo.scale(1, 1.35, 1);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#fffdf4', transparent: true }));
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.halo = glows.make('#ffd98a');
    this.silver = glows.make('#cfe0ff');
    this.core = glows.make('#ffffff');
  }

  /** Place it at `p`, shown by `k` (0 → 1), at a `size`; `ambient` only twinkles it. */
  set(p: THREE.Vector3, k: number, ambient: number, size = 1, seed = 0): void {
    const tw = 0.9 + 0.1 * Math.sin(ambient * 2.3 + seed * 2);
    this.mesh.position.copy(p);
    this.mesh.scale.setScalar(Math.max(0.001, size * (0.4 + 0.6 * k)));
    this.mesh.rotation.set(0.2, ambient * 0.7 + seed, 0.1);
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = clamp01(k * 1.5);
    this.mesh.visible = k > 0.01;
    // The two lights of the Trees, gold and silver, turning slowly about each other.
    const sway = Math.sin(ambient * 0.8 + seed * 3);
    Glows.set(this.halo, p, 1.5 * size * (1 + 0.12 * sway), 0.5 * k * tw);
    Glows.set(this.silver, p, 1.1 * size * (1 - 0.12 * sway), 0.5 * k * tw);
    Glows.set(this.core, p, 0.45 * size, 0.95 * k);
  }
}

/** Fill `count` points of a trail behind a moving light: `at(s)` gives where it was at s ≤ head. */
export function fillTrail(
  pos: Float32Array, col: Float32Array, from: number, count: number, head: number, length: number,
  at: (s: number, out: THREE.Vector3) => THREE.Vector3, color: THREE.Color, b: number, ambient: number, spread = 0.05, seed = 0,
): void {
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const k = from + i, q = i / count;
    at(Math.max(0, head - q * length), v);
    const j = spread * q;
    v.x += (hash(i, 1, seed) - 0.5) * j + Math.sin(ambient * 3 + i) * j * 0.3;
    v.y += (hash(i, 2, seed) - 0.5) * j;
    v.z += (hash(i, 3, seed) - 0.5) * j;
    v.toArray(pos, k * 3);
    const f = b * (1 - q) * (0.6 + 0.4 * hash(i, 4, seed));
    col[k * 3] = color.r * f; col[k * 3 + 1] = color.g * f; col[k * 3 + 2] = color.b * f;
  }
}
