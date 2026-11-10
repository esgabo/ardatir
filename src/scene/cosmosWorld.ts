import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { hash, glowTexture } from './util';

/**
 * What every cosmos-level event shares: the Void with its faint dust, Arda's shells
 * (Ambarkanta), the stars of Ilmen, the shell labels, the lights and the camera.
 * Each event's "play" (cosmos.ts, cosmosLamps.ts, ...) adds its own things and
 * drives everything from the event time `t`.
 */

/** Radius of Ambar, the slab of land. */
export const SLAB_RADIUS = 4;

export interface CosmosLabels {
  ambar: string; vista: string; ilmen: string; vaiya: string; walls: string; kuma: string;
  /** Glossed names used by later cosmos events (the first Moon and Sun, the Change of the World). */
  moon: string; sun: string; straightRoad: string;
  /** The Children of Ilúvatar, as they join the Second Music. */
  elves: string; men: string;
}

export interface Shell { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; label: CSS2DObject; appear: number; strength: number }

export interface CosmosWorld {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  tex: THREE.Texture;
  shells: Shell[];
  starMat: THREE.PointsMaterial;
  ambarLabel: CSS2DObject;
  kumaLabel: CSS2DObject;
  /** Every label in the world, removed from the page on dispose. */
  labels: CSS2DObject[];
  mkLabel(text: string, cls?: string): CSS2DObject;
}

/** Translucent shell with a glowing rim (fresnel), used for the airs and seas around Arda. */
export function shellMaterial(color: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float rim = pow(1.0 - abs(dot(vN, vV)), 2.5);
        gl_FragColor = vec4(uColor, uOpacity * (0.15 + 0.85 * rim));
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Build the shared world. `middle` adds the event's own objects right after the Void's
 * dust and before the shells, so transparent objects keep a stable draw order.
 */
export function createCosmosWorld(labels: CosmosLabels, middle: (scene: THREE.Scene, tex: THREE.Texture) => void): CosmosWorld {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020308');

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  camera.position.set(21, 10, 21);
  const target = new THREE.Vector3(0, 0.3, 0);

  scene.add(new THREE.AmbientLight('#8899bb', 0.0));
  const hemi = new THREE.HemisphereLight('#fff6e0', '#203040', 0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d6', 0);
  sun.position.set(6, 10, 4);
  scene.add(sun);

  // ----- Kúma: faint dust in the void -----
  const tex = glowTexture();
  {
    const n = 800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 30 + hash(i, 1) * 50, th = hash(i, 2) * Math.PI * 2, ph = Math.acos(2 * hash(i, 3) - 1);
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.25, map: tex, color: '#33384a', transparent: true, depthWrite: false })));
  }

  middle(scene, tex);

  const mkLabel = (text: string, cls = '') => {
    const el = document.createElement('div');
    el.className = `cosmos-label ${cls}`;
    el.textContent = text;
    el.style.opacity = '0';
    return new CSS2DObject(el);
  };

  // ----- Arda's shells (Ambarkanta) -----
  const shells: Shell[] = [];
  const addShell = (geo: THREE.BufferGeometry, color: string, label: string, labelPos: THREE.Vector3, appear: number, strength: number) => {
    const mat = shellMaterial(color);
    const mesh = new THREE.Mesh(geo, mat);
    const lbl = mkLabel(label);
    lbl.position.copy(labelPos);
    scene.add(mesh, lbl);
    shells.push({ mesh, mat, label: lbl, appear, strength });
  };
  // Vista and Ilmen are domes over the land; Vaiya and the Walls enclose everything.
  addShell(new THREE.SphereGeometry(4.7, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), '#8fd0ff', labels.vista, new THREE.Vector3(0, 4.9, 0), 0.88, 0.35);
  addShell(new THREE.SphereGeometry(5.9, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), '#4a6fd0', labels.ilmen, new THREE.Vector3(0, 6.1, 0), 0.9, 0.35);
  addShell(new THREE.SphereGeometry(7.6, 48, 32), '#1f8a8a', labels.vaiya, new THREE.Vector3(0, 7.9, 0), 0.92, 0.5);
  addShell(new THREE.SphereGeometry(8.1, 48, 32), '#9aa6c8', labels.walls, new THREE.Vector3(0, 8.8, 0), 0.94, 0.25);

  // Stars set in Ilmen.
  const starGeo = new THREE.BufferGeometry();
  {
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = hash(i, 11) * Math.PI * 2, ph = Math.acos(hash(i, 12)) * 0.95; // upper hemisphere
      const r = 5.8;
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  }
  const starMat = new THREE.PointsMaterial({ size: 0.14, map: tex, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(starGeo, starMat));

  const ambarLabel = mkLabel(labels.ambar, 'big');
  ambarLabel.position.set(0, -1.6, SLAB_RADIUS + 0.4);
  const kumaLabel = mkLabel(labels.kuma);
  kumaLabel.position.set(0, 10.4, 0);
  scene.add(ambarLabel, kumaLabel);

  return {
    scene, camera, target, hemi, sun, tex, shells, starMat, ambarLabel, kumaLabel,
    labels: [...shells.map((s) => s.label), ambarLabel, kumaLabel],
    mkLabel,
  };
}

/** Set the opacity (and visibility) of every material under `o`. */
export function setOpacity(o: THREE.Object3D, v: number): void {
  o.traverse((x) => {
    const m = (x as THREE.Mesh).material as THREE.Material | undefined;
    if (m) { m.opacity = v; m.visible = v > 0.001; }
  });
}

// ---------------------------------------------------------------------------------------
// Pieces shared by the cosmos events after the Ainulindalë (each in its own module).
// ---------------------------------------------------------------------------------------

/** Soft camera-facing glows: quads with the shared glow texture, turned to the camera in `face`. */
export class Glows {
  readonly list: THREE.Mesh[] = [];
  private readonly quad = new THREE.PlaneGeometry(1, 1);
  constructor(private readonly tex: THREE.Texture, private readonly scene: THREE.Scene) {}

  make(color: THREE.ColorRepresentation): THREE.Mesh {
    const m = new THREE.Mesh(this.quad, new THREE.MeshBasicMaterial({
      color, map: this.tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.visible = false;
    this.list.push(m);
    this.scene.add(m);
    return m;
  }

  /** Place a glow; it hides itself when (nearly) dark. */
  static set(m: THREE.Mesh, pos: THREE.Vector3, scale: number, opacity: number): void {
    m.position.copy(pos);
    m.scale.setScalar(scale);
    (m.material as THREE.MeshBasicMaterial).opacity = opacity;
    m.visible = opacity > 0.002;
  }

  face(camera: THREE.Camera): void {
    for (const g of this.list) g.quaternion.copy(camera.quaternion);
  }
}

/** A name over a place (Quenya and Sindarin names read the same in every language). */
export function nameLabel(world: CosmosWorld, text: string, cls = 'big'): CSS2DObject {
  const l = world.mkLabel(text, cls);
  world.scene.add(l);
  world.labels.push(l);
  return l;
}

export function showLabel(l: CSS2DObject, v: number): void {
  (l.element as HTMLElement).style.opacity = String(Math.min(Math.max(v, 0), 1));
}

/**
 * Keep the camera's direction but step back on narrow screens, so a subject `halfWidth`
 * wide stays in view (never closer than `minDist`). Also sets the camera's aspect to w / h.
 */
export function fitCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3, w: number, h: number, minDist: number, halfWidth: number): void {
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const d = Math.max(minDist, halfWidth / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
  camera.position.sub(target).setLength(d).add(target);
}
