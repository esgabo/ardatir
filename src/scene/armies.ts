import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Army, ArmyAction, ArmyKind, ArmySize, Faction } from '../data/types';
import { TILE_LIMIT } from '../timeline';
import { sampleGround } from './diorama';
import { hash } from './util';

/**
 * A battle's armies (staging.yaml `armies`, docs/DESIGN.md §2): each a block of small figures
 * in its faction's colour, drawn with instancing (two or three draw calls per army, one more
 * for a banner), moving
 * along its keyframes. Where every figure stands is a pure function of the event time `t`;
 * the formation's jitter is seeded by the army, and `ambient` only adds the bob of marching,
 * the jostle of fighting and the beat of wings. A figure off the tile is offstage: not drawn.
 */

type Body = 'foot' | 'wolf' | 'eagle';

interface Look {
  body: Body;
  /** Height of one figure (a hobbit-sized named figure is about 0.82). */
  height: number;
  /** Width of the body; dwarves are broad. */
  girth: number;
  /** Head or helm colour. */
  head: string;
  /** Holds a spear (drawn as a thin shaft). */
  spear: boolean;
  /** Distance between neighbours in the block. */
  spacing: number;
}

const LOOKS: Record<ArmyKind, Look> = {
  elf: { body: 'foot', height: 0.78, girth: 0.085, head: '#e6d6ad', spear: true, spacing: 0.36 },
  man: { body: 'foot', height: 0.74, girth: 0.09, head: '#b9c0c6', spear: true, spacing: 0.36 },
  dwarf: { body: 'foot', height: 0.52, girth: 0.11, head: '#c3c8cc', spear: false, spacing: 0.34 },
  goblin: { body: 'foot', height: 0.56, girth: 0.085, head: '#7d8a52', spear: true, spacing: 0.3 },
  orc: { body: 'foot', height: 0.6, girth: 0.09, head: '#6f7a4c', spear: true, spacing: 0.32 },
  hobbit: { body: 'foot', height: 0.45, girth: 0.08, head: '#e0b48f', spear: false, spacing: 0.3 },
  wolf: { body: 'wolf', height: 0.34, girth: 0.1, head: '#4a4440', spear: false, spacing: 0.52 },
  warg: { body: 'wolf', height: 0.34, girth: 0.1, head: '#4a4440', spear: false, spacing: 0.52 },
  eagle: { body: 'eagle', height: 0.2, girth: 0.1, head: '#e9e1cf', spear: false, spacing: 0.9 },
};
const DEFAULT_LOOK = LOOKS.man;

/** Figures per army, by size and body: enough to read as a host, few enough for a phone. */
const COUNT: Record<Body, Record<ArmySize, number>> = {
  foot: { small: 12, medium: 24, large: 40 },
  wolf: { small: 7, medium: 12, large: 18 },
  eagle: { small: 4, medium: 7, large: 11 },
};
/** All the armies of one event together never draw more than this many figures. */
const MAX_FIGURES = 240;
/** How long (in t) a formation takes to wheel round when its heading changes. */
const WHEEL = 0.025;
const EAGLE_HEIGHT = 2.6;

export interface Armies {
  group: THREE.Group;
  update(t: number, ambient: number): void;
}

/** Each segment's heading (its direction of travel; a pause keeps the last one), and the first. Pure. */
export interface ArmyHeadings { heads: number[]; first: number }
export function armyHeadings(a: Army): ArmyHeadings {
  const ks = a.keyframes;
  const segs: (number | undefined)[] = [];
  for (let n = 0; n < ks.length - 1; n++) {
    const dx = ks[n + 1].x - ks[n].x, dz = ks[n + 1].z - ks[n].z;
    segs.push(Math.hypot(dx, dz) > 1e-3 ? Math.atan2(dx, dz) : undefined);
  }
  // Never moves: face the tile's centre. A pause before the first march takes that march's heading.
  const first = segs.find((x) => x !== undefined) ?? Math.atan2(-ks[0].x, -ks[0].z);
  let last = first;
  const heads = segs.map((x) => (last = x ?? last));
  return { heads, first };
}

/**
 * Where an army's centre is at `t`, what it is doing, and which way it faces. Pure. Unlike a
 * character's keyframe, an army's `action` says what it does on the way to that keyframe.
 * Before its first keyframe it stands there, idle. `h` is `armyHeadings(a)`, passed in by the
 * frame loop so nothing is rebuilt every frame.
 */
export function sampleArmy(a: Army, t: number, h: ArmyHeadings = armyHeadings(a)): { x: number; z: number; action: ArmyAction; moving: boolean; heading: number } {
  const ks = a.keyframes;
  let i = 0;
  while (i < ks.length - 1 && ks[i + 1].t <= t) i++;
  const k0 = ks[i], k1 = ks[Math.min(i + 1, ks.length - 1)];
  const span = k1.t - k0.t;
  const before = t < k0.t;
  const u = span > 0 ? Math.min(Math.max((t - k0.t) / span, 0), 1) : 0;
  const moving = !before && span > 0 && u < 1 && Math.hypot(k1.x - k0.x, k1.z - k0.z) > 1e-3;
  const x = k0.x + (k1.x - k0.x) * u, z = k0.z + (k1.z - k0.z) * u;

  const { heads, first } = h;
  const seg = Math.min(i, heads.length - 1);
  let heading = heads[seg] ?? first;
  // Wheel smoothly into a new heading at the start of the segment that turns.
  if (seg > 0 && heads[seg - 1] !== heading) {
    const from = heads[seg - 1], w = Math.min(WHEEL, span * 0.5 || WHEEL);
    const p = Math.min(Math.max((t - k0.t) / w, 0), 1);
    let d = heading - from;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    heading = from + d * (p * p * (3 - 2 * p));
  }
  // A keyframe's action is what the army does on the way to it: walk or run there, or wait (idle)
  // or fight where it stands. After the last keyframe, it keeps doing what that one says.
  const action: ArmyAction = moving ? (k1.action === 'run' ? 'run' : 'walk')
    : !before && k1.action === 'fight' ? 'fight' : 'idle';
  return { x, z, action, moving, heading };
}

/** Slots of a block, centred, in the army's own frame (x across the front, z towards the front). Pure. */
function formation(n: number, look: Look, seed: number): { x: number; z: number; phase: number }[] {
  const out: { x: number; z: number; phase: number }[] = [];
  const s = look.spacing;
  if (look.body === 'foot') {
    // Ranks wider than deep, a little ragged.
    const cols = Math.ceil(Math.sqrt(n * 2.2));
    const rows = Math.ceil(n / cols);
    for (let k = 0; k < n; k++) {
      const r = Math.floor(k / cols), c = k % cols;
      const inRow = r === rows - 1 ? n - r * cols : cols;
      out.push({
        x: (c - (inRow - 1) / 2) * s + (hash(k, 1, seed) - 0.5) * s * 0.35,
        z: ((rows - 1) / 2 - r) * s * 0.95 + (hash(k, 2, seed) - 0.5) * s * 0.35,
        phase: hash(k, 3, seed) * Math.PI * 2,
      });
    }
  } else {
    // Packs and flights: a loose cloud, denser at the heart (sunflower spiral, jittered).
    for (let k = 0; k < n; k++) {
      const r = s * 0.62 * Math.sqrt(k + 0.5), a = k * 2.39996 + hash(k, 4, seed);
      out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r * 0.8, phase: hash(k, 5, seed) * Math.PI * 2 });
    }
  }
  return out;
}

function footGeometry(look: Look): { body: THREE.BufferGeometry; head: THREE.BufferGeometry; spear?: THREE.BufferGeometry } {
  const h = look.height, g = look.girth;
  const bodyH = h * 0.78;
  const body = new THREE.CylinderGeometry(g * 0.75, g, bodyH, 6);
  body.translate(0, bodyH / 2, 0);
  const head = new THREE.IcosahedronGeometry(h * 0.12, 0);
  head.translate(0, bodyH + h * 0.1, 0);
  let spear: THREE.BufferGeometry | undefined;
  if (look.spear) {
    spear = new THREE.CylinderGeometry(0.012, 0.012, h * 1.45, 3);
    spear.translate(g * 1.3, h * 0.62, 0.02);
  }
  return { body, head, spear };
}

function wolfGeometry(look: Look): { body: THREE.BufferGeometry; head: THREE.BufferGeometry } {
  const h = look.height;
  const torso = new THREE.CylinderGeometry(0.09, 0.115, 0.5, 5);
  torso.rotateX(Math.PI / 2);
  torso.translate(0, h * 0.7, 0);
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => {
    const l = new THREE.CylinderGeometry(0.022, 0.018, h * 0.6, 3);
    l.translate(sx * 0.05, h * 0.3, sz * 0.15);
    return l;
  }));
  const tail = new THREE.ConeGeometry(0.03, 0.2, 3);
  tail.rotateX(-Math.PI / 2.6);
  tail.translate(0, h * 0.78, -0.3);
  const body = mergeGeometries([torso.toNonIndexed(), ...legs.map((l) => l.toNonIndexed()), tail.toNonIndexed()])!;
  // Head: a snout cone with two ears, held up and forward.
  const snout = new THREE.ConeGeometry(0.075, 0.22, 4);
  snout.rotateX(Math.PI / 2);
  snout.translate(0, h * 0.95, 0.33);
  const ears = [-1, 1].map((sx) => {
    const e = new THREE.ConeGeometry(0.026, 0.08, 3);
    e.translate(sx * 0.04, h * 0.95 + 0.08, 0.27);
    return e.toNonIndexed();
  });
  const head = mergeGeometries([snout.toNonIndexed(), ...ears])!;
  return { body, head };
}

function eagleGeometry(): { body: THREE.BufferGeometry; head: THREE.BufferGeometry } {
  const body = new THREE.ConeGeometry(0.09, 0.5, 5);
  body.rotateX(-Math.PI / 2); // tip forward
  // Wings: two flat triangles, tips raised so scaling y beats them up and down.
  const w = new THREE.BufferGeometry();
  const span = 0.62;
  w.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0.14, -span, 0.16, -0.06, 0, 0, -0.16,
    0, 0, 0.14, 0, 0, -0.16, span, 0.16, -0.06,
  ], 3));
  w.computeVertexNormals();
  const b = body.toNonIndexed();
  b.deleteAttribute('uv'); // the wings have none, and merged geometries must match
  const merged = mergeGeometries([b, w])!;
  const head = new THREE.IcosahedronGeometry(0.06, 0);
  head.translate(0, 0.03, 0.26);
  return { body: merged, head };
}

export function createArmies(armies: Army[], factions: Map<string, Faction>, diorama: THREE.Object3D, eventSeed: number): Armies {
  const group = new THREE.Group();
  group.name = 'armies';
  // One material for every banner of the event: the colours are in the vertices.
  const bannerMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.85, metalness: 0.1 });

  interface Built {
    army: Army;
    look: Look;
    seed: number;
    /** Precomputed once: the army's headings, and how far its front rank stands ahead of its centre. */
    headings: ArmyHeadings;
    front: number;
    slots: { x: number; z: number; phase: number }[];
    meshes: THREE.InstancedMesh[];
    banner?: THREE.Mesh;
  }

  // Counts by size and body, scaled down together if the event would draw too many.
  const looks = armies.map((a) => LOOKS[(factions.get(a.faction)?.kind ?? '') as ArmyKind] ?? DEFAULT_LOOK);
  const wanted = armies.map((a, n) => COUNT[looks[n].body][a.size]);
  const total = wanted.reduce((s, x) => s + x, 0);
  const scale = total > MAX_FIGURES ? MAX_FIGURES / total : 1;

  const built: Built[] = armies.map((army, n) => {
    const f = factions.get(army.faction);
    const look = looks[n];
    const count = Math.max(3, Math.round(wanted[n] * scale));
    const seed = eventSeed * 31 + [...army.faction].reduce((s, ch) => s + ch.charCodeAt(0), 0) + n * 101;
    const slots = formation(count, look, seed);
    const color = new THREE.Color(f?.color ?? '#888888');
    const geo: { body: THREE.BufferGeometry; head: THREE.BufferGeometry; spear?: THREE.BufferGeometry } =
      look.body === 'wolf' ? wolfGeometry(look) : look.body === 'eagle' ? eagleGeometry() : footGeometry(look);
    // The body takes the faction's colour per instance (a little varied); heads and helms their own.
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.85, side: look.body === 'eagle' ? THREE.DoubleSide : THREE.FrontSide });
    const headMat = new THREE.MeshStandardMaterial({ color: look.head, flatShading: true, roughness: 0.7 });
    const meshes = [new THREE.InstancedMesh(geo.body, bodyMat, count), new THREE.InstancedMesh(geo.head, headMat, count)];
    if (geo.spear) meshes.push(new THREE.InstancedMesh(geo.spear, new THREE.MeshStandardMaterial({ color: '#4a3a2a', flatShading: true }), count));
    const tmp = new THREE.Color();
    for (let k = 0; k < count; k++) meshes[0].setColorAt(k, tmp.copy(color).offsetHSL(0, 0, (hash(k, 7, seed) - 0.5) * 0.08));
    for (const m of meshes) {
      m.castShadow = true;
      m.frustumCulled = false; // instances move far from the geometry's own bounds
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(m);
    }

    // A banner in the faction's colour at the front of every army that marches on foot:
    // pole, cloth and finial merged into one vertex-coloured mesh (one draw call).
    let banner: THREE.Mesh | undefined;
    if (look.body === 'foot') {
      banner = new THREE.Mesh(bannerGeometry(color), bannerMat);
      banner.castShadow = true;
      group.add(banner);
    }
    let front = -Infinity;
    for (const sl of slots) front = Math.max(front, sl.z);
    return { army, look, seed, headings: armyHeadings(army), front, slots, meshes, banner };
  });

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const onTile = (x: number, z: number) => Math.abs(x) <= TILE_LIMIT && Math.abs(z) <= TILE_LIMIT;

  return {
    group,
    update(t, ambient) {
      for (const b of built) {
        const s = sampleArmy(b.army, t, b.headings);
        const cos = Math.cos(s.heading), sin = Math.sin(s.heading);
        const fighting = s.action === 'fight' && !s.moving;
        const spread = fighting ? 1.18 : 1;
        const pace = s.action === 'run' ? 13 : 8;
        const eagle = b.look.body === 'eagle';
        for (let k = 0; k < b.slots.length; k++) {
          const slot = b.slots[k];
          // The slot in the world: across the front (x) and towards the front (z), turned to the heading.
          const lx = slot.x * spread, lz = slot.z * spread;
          let x = s.x + lx * cos + lz * sin;
          let z = s.z - lx * sin + lz * cos;
          // On the tile or offstage by the slot itself, before any idle motion: what is shown
          // depends on t alone, never on `ambient`.
          if (!onTile(x, z)) { for (const m of b.meshes) m.setMatrixAt(k, hidden); continue; }
          let y = 0, yaw = s.heading, flap = 1;
          if (eagle) {
            // Wheeling over the field: each eagle circles its place, lower when they stoop to strike.
            const r = fighting ? 0.55 : 0.25, a = ambient * (fighting ? 1.3 : 0.8) + slot.phase;
            x += Math.cos(a) * r; z += Math.sin(a) * r;
            if (fighting) yaw = Math.atan2(-Math.sin(a), Math.cos(a));
            y = (fighting ? EAGLE_HEIGHT - 0.9 : EAGLE_HEIGHT) + Math.sin(ambient * 1.7 + slot.phase) * 0.18 + hash(k, 9, b.seed) * 0.5;
            flap = Math.sin(ambient * (s.moving ? 9 : 5) + slot.phase);
          } else if (s.moving) {
            y = Math.abs(Math.sin(ambient * pace + slot.phase)) * (b.look.body === 'wolf' ? 0.06 : 0.04);
          } else if (fighting) {
            // The jostle of a fight: a lunge forward and back, out of step.
            const l = Math.sin(ambient * 5.5 + slot.phase) * 0.07;
            x += l * sin; z += l * cos;
            yaw += Math.sin(ambient * 2.1 + slot.phase) * 0.35;
          }
          const ground = sampleGround(diorama, x, z);
          pos.set(x, ground + y, z);
          q.setFromEuler(e.set(0, yaw, 0));
          scl.set(1, 1, 1);
          m4.compose(pos, q, scl);
          b.meshes[1].setMatrixAt(k, m4);
          if (b.meshes[2]) b.meshes[2].setMatrixAt(k, m4);
          if (eagle) { scl.set(1, flap, 1); m4.compose(pos, q, scl); }
          b.meshes[0].setMatrixAt(k, m4);
        }
        for (const m of b.meshes) m.instanceMatrix.needsUpdate = true;

        if (b.banner) {
          // At the front of the block, a step ahead of the first rank.
          const front = b.front * spread + 0.25;
          const bx = s.x + front * sin, bz = s.z + front * cos;
          b.banner.visible = onTile(bx, bz);
          b.banner.position.set(bx, sampleGround(diorama, bx, bz) + (s.moving ? Math.abs(Math.sin(ambient * pace)) * 0.03 : 0), bz);
          // The cloth streams behind the pole, stirring in the wind.
          b.banner.rotation.y = s.heading + Math.PI / 2 + Math.sin(ambient * 1.3) * 0.25;
        }
      }
    },
  };
}

/** A banner as one geometry: a dark pole, the cloth in the faction's colour streaming along +x, a gold finial. */
function bannerGeometry(color: THREE.Color): THREE.BufferGeometry {
  const pole = new THREE.CylinderGeometry(0.018, 0.018, 1.5, 4).toNonIndexed();
  pole.translate(0, 0.75, 0);
  const cloth = new THREE.PlaneGeometry(0.42, 0.3, 3, 1).toNonIndexed();
  cloth.translate(0.21 + 0.018, 1.33, 0);
  const finial = new THREE.OctahedronGeometry(0.045, 0).toNonIndexed();
  finial.translate(0, 1.53, 0);
  const parts: [THREE.BufferGeometry, THREE.Color][] = [[pole, new THREE.Color('#3a2e22')], [cloth, color], [finial, new THREE.Color('#e8c77a')]];
  for (const [g, c] of parts) {
    for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const merged = mergeGeometries(parts.map(([g]) => g))!;
  for (const [g] of parts) g.dispose();
  return merged;
}
