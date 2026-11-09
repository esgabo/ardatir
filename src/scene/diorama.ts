import * as THREE from 'three';

/** Tiny deterministic value-noise so every diorama looks the same on every load. */
function hash(x: number, z: number, seed: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi, seed), b = hash(xi + 1, zi, seed);
  const c = hash(xi, zi + 1, seed), d = hash(xi + 1, zi + 1, seed);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, u), THREE.MathUtils.lerp(c, d, u), v);
}

export interface DioramaOptions {
  /** Edge length of the square tile. */
  size?: number;
  /** Grid cells per edge; lower = chunkier facets. */
  segments?: number;
  /** Max terrain bump height. */
  relief?: number;
  /** Depth of the cut earth sides below the lowest point. */
  depth?: number;
  seed?: number;
  grass?: string;
  earth?: string;
}

/**
 * A low-poly, faceted terrain tile with cut-away earth sides:
 * the "diorama" look every event is staged on.
 */
export function createDiorama(opts: DioramaOptions = {}): THREE.Group {
  const {
    size = 14, segments = 14, relief = 0.9, depth = 1.6, seed = 1,
    grass = '#7fa65a', earth = '#8a6a4a',
  } = opts;

  const group = new THREE.Group();
  const half = size / 2;
  const step = size / segments;

  // Heights on the grid; edges kept a little lower so the tile reads as a plinth.
  const heights: number[][] = [];
  for (let i = 0; i <= segments; i++) {
    heights[i] = [];
    for (let j = 0; j <= segments; j++) {
      const n = smoothNoise(i * 0.35, j * 0.35, seed) * 0.7 + smoothNoise(i * 0.9, j * 0.9, seed + 3) * 0.3;
      heights[i][j] = n * relief;
    }
  }
  const h = (i: number, j: number) => heights[i][j];
  const px = (i: number) => -half + i * step;

  // Top surface: two triangles per cell, flat-shaded for the faceted look.
  const top: number[] = [];
  const topColors: number[] = [];
  const base = new THREE.Color(grass);
  const tmp = new THREE.Color();
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = [px(i), h(i, j), px(j)];
      const b = [px(i + 1), h(i + 1, j), px(j)];
      const c = [px(i), h(i, j + 1), px(j + 1)];
      const d = [px(i + 1), h(i + 1, j + 1), px(j + 1)];
      const tris = [[a, c, b], [b, c, d]];
      for (const tri of tris) {
        // Slight per-face colour jitter adds the hand-painted low-poly feel.
        tmp.copy(base).offsetHSL(0, 0, (hash(i, j, seed + tri.length) - 0.5) * 0.06);
        for (const v of tri) {
          top.push(v[0], v[1], v[2]);
          topColors.push(tmp.r, tmp.g, tmp.b);
        }
      }
    }
  }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
  topGeo.setAttribute('color', new THREE.Float32BufferAttribute(topColors, 3));
  topGeo.computeVertexNormals();
  const topMesh = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  topMesh.receiveShadow = true;
  topMesh.name = 'terrain';
  group.add(topMesh);

  // Cut sides: a wall from the terrain edge down to the base on all four edges.
  const bottom = -depth;
  const sides: number[] = [];
  const wall = (x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, flip: boolean) => {
    const q = [[x0, y0, z0], [x1, y1, z1], [x0, bottom, z0], [x1, bottom, z1]];
    const tris = flip ? [[q[0], q[1], q[2]], [q[1], q[3], q[2]]] : [[q[0], q[2], q[1]], [q[1], q[2], q[3]]];
    for (const t of tris) for (const v of t) sides.push(v[0], v[1], v[2]);
  };
  for (let k = 0; k < segments; k++) {
    wall(px(k), -half, h(k, 0), px(k + 1), -half, h(k + 1, 0), true);                 // north
    wall(px(k), half, h(k, segments), px(k + 1), half, h(k + 1, segments), false);   // south
    wall(-half, px(k), h(0, k), -half, px(k + 1), h(0, k + 1), false);               // west
    wall(half, px(k), h(segments, k), half, px(k + 1), h(segments, k + 1), true);    // east
  }
  const sideGeo = new THREE.BufferGeometry();
  sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(sides, 3));
  sideGeo.computeVertexNormals();
  const sideMesh = new THREE.Mesh(sideGeo, new THREE.MeshStandardMaterial({ color: earth, flatShading: true, side: THREE.DoubleSide, roughness: 1 }));
  group.add(sideMesh);

  // A few faceted trees for scale.
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5b4632', flatShading: true });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4f7a3a', flatShading: true });
  for (let n = 0; n < 9; n++) {
    const x = (hash(n, 1, seed + 9) - 0.5) * (size - 2);
    const z = (hash(n, 2, seed + 9) - 0.5) * (size - 2);
    if (Math.hypot(x, z) < 3.5) continue; // keep the stage clear
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.6, 5), trunkMat);
    trunk.position.y = 0.3;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), leafMat);
    crown.position.y = 0.95;
    crown.scale.y = 1.25;
    tree.add(trunk, crown);
    tree.position.set(x, groundHeight(group, x, z), z);
    tree.traverse((o) => { o.castShadow = true; });
    group.add(tree);
  }

  return group;
}

const ray = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);

/** Height of the terrain under (x, z), for placing characters and props on the ground. */
export function groundHeight(diorama: THREE.Object3D, x: number, z: number): number {
  const terrain = diorama.getObjectByName('terrain');
  if (!terrain) return 0;
  ray.set(new THREE.Vector3(x, 50, z), down);
  const hit = ray.intersectObject(terrain, false)[0];
  return hit ? hit.point.y : 0;
}
