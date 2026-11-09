import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Stage } from './stage';
import { clamp01, disposeTree, glowTexture, hash, pulse, ramp, smoothNoise } from './util';

// Timeline of the Ainulindalë (normalised event time). Kept in one place so the
// narration and beats in cosmos.json can be tuned against it.
const T = {
  musicStart: 0.08,
  discordStart: 0.35,
  newTheme1: 0.43,
  newTheme2: 0.5,
  chord: 0.555,
  visionStart: 0.62,
  ea: 0.845,
  ardaSolid: 0.88,
  shellsDone: 0.96,
} as const;

const SLAB_RADIUS = 4;

/** Ambar: a round, faceted slab of land with an inner sea and a jagged rocky underside. */
function buildAmbar(seed = 7): { solid: THREE.Group; ghost: THREE.LineSegments } {
  const rings = 10, segs = 44;
  const top: number[] = [];
  const colors: number[] = [];
  const land = new THREE.Color('#cdbb98');
  const grass = new THREE.Color('#7f9d5c');
  const sea = new THREE.Color('#5d8fa8');
  const c = new THREE.Color();

  const height = (r: number, a: number): { y: number; water: boolean } => {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const n = smoothNoise(x * 0.9 + 10, z * 0.9 + 10, seed) * 0.65 + smoothNoise(x * 2.2, z * 2.2, seed + 1) * 0.35;
    // An inland sea a little off-centre, like the great sea in the middle of the early world.
    const seaMask = clamp01(1.3 - Math.hypot(x + 0.6, z - 0.3) / 1.5);
    // Continuous height (no cliffs at the shore), then clamp to sea level.
    const land = 0.05 + n * 0.55 + Math.max(0, r - 3.2) * 0.12;
    const y = Math.max(0, land - seaMask * 0.7);
    return { y, water: y <= 0.001 };
  };
  const vert = (ri: number, si: number) => {
    const r = (ri / rings) * SLAB_RADIUS;
    const a = (si / segs) * Math.PI * 2;
    const { y, water } = height(r, a);
    return { p: [Math.cos(a) * r, y, Math.sin(a) * r], water };
  };

  const pushTri = (vs: { p: number[]; water: boolean }[], faceSeed: number) => {
    const water = vs.filter((v) => v.water).length >= 2;
    if (water) c.copy(sea);
    else c.copy(land).lerp(grass, 0.25 + hash(faceSeed, 3, seed) * 0.6);
    c.offsetHSL(0, 0, (hash(faceSeed, 9, seed) - 0.5) * 0.06);
    for (const v of vs) {
      top.push(v.p[0], v.p[1], v.p[2]);
      colors.push(c.r, c.g, c.b);
    }
  };

  let f = 0;
  for (let ri = 0; ri < rings; ri++) {
    for (let si = 0; si < segs; si++) {
      const a = vert(ri, si), b = vert(ri, si + 1), cc = vert(ri + 1, si), d = vert(ri + 1, si + 1);
      if (ri === 0) pushTri([a, d, cc], f++);
      else { pushTri([a, b, cc], f++); pushTri([b, d, cc], f++); }
    }
  }

  // Underside: rim → jagged ring → a rough point far below, like a torn-out crag.
  const under: number[] = [];
  const tip = [0, -3.4, 0];
  for (let si = 0; si < segs; si++) {
    const r0 = vert(rings, si).p, r1 = vert(rings, si + 1).p;
    const drop = (s: number) => -0.9 - hash(s % segs, 5, seed) * 0.9;
    const inset = (p: number[], s: number) => {
      const k = 0.82 - hash(s % segs, 6, seed) * 0.12;
      return [p[0] * k, drop(s), p[2] * k];
    };
    const b0 = inset(r0, si), b1 = inset(r1, si + 1);
    under.push(...r0, ...b0, ...r1, ...r1, ...b0, ...b1); // cliff wall
    under.push(...b0, ...tip, ...b1);                      // crag
  }

  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
  topGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  topGeo.computeVertexNormals();
  const underGeo = new THREE.BufferGeometry();
  underGeo.setAttribute('position', new THREE.Float32BufferAttribute(under, 3));
  underGeo.computeVertexNormals();

  const solid = new THREE.Group();
  const topMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, transparent: true });
  const rockMat = new THREE.MeshStandardMaterial({ color: '#7d6a55', flatShading: true, roughness: 1, side: THREE.DoubleSide, transparent: true });
  solid.add(new THREE.Mesh(topGeo, topMat), new THREE.Mesh(underGeo, rockMat));

  const ghostGeo = new THREE.EdgesGeometry(topGeo, 1);
  const ghost = new THREE.LineSegments(ghostGeo, new THREE.LineBasicMaterial({
    color: '#9fd8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  return { solid, ghost };
}

/** Translucent shell with a glowing rim (fresnel), used for the airs and seas around Arda. */
function shellMaterial(color: string): THREE.ShaderMaterial {
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

interface Shell { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; label: CSS2DObject; appear: number; strength: number }

export function createCosmosStage(labels: Record<string, string>): Stage {
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

  // ----- The Music: woven streams of light, plus Melkor's discord -----
  const STREAMS = 7, PER = 900, DISCORD = 1600;
  const total = STREAMS * PER + DISCORD;
  const mPos = new Float32Array(total * 3);
  const mCol = new Float32Array(total * 3);
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  mGeo.setAttribute('color', new THREE.BufferAttribute(mCol, 3));
  const music = new THREE.Points(mGeo, new THREE.PointsMaterial({
    size: 0.16, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(music);
  const streamColors = ['#ffe2a0', '#a8d8ff', '#fff4dc', '#c8b8ff', '#9ff0d8', '#ffd0a8', '#e8f0ff'].map((h) => new THREE.Color(h));
  const discordColor = new THREE.Color('#ff3a1e');

  // A white ring for the single chord that ends the Music.
  const chordRing = new THREE.Mesh(
    new THREE.RingGeometry(0.96, 1, 96),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  scene.add(chordRing);

  // ----- Arda: the slab and its shells (Ambarkanta) -----
  const { solid: ambar, ghost } = buildAmbar();
  scene.add(ambar, ghost);

  const mkLabel = (text: string, cls = '') => {
    const el = document.createElement('div');
    el.className = `cosmos-label ${cls}`;
    el.textContent = text;
    el.style.opacity = '0';
    return new CSS2DObject(el);
  };

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
  const labelObjs = [...shells.map((s) => s.label), ambarLabel, kumaLabel];

  const setOpacity = (o: THREE.Object3D, v: number) => {
    o.traverse((x) => {
      const m = (x as THREE.Mesh).material as THREE.Material | undefined;
      if (m) { m.opacity = v; m.visible = v > 0.001; }
    });
  };

  return {
    scene, camera, target,

    update(t, ambient) {
      // --- Music ---
      const fadeAll = 1 - ramp(t, T.chord, T.chord + 0.012);
      const discord = ramp(t, T.discordStart, T.discordStart + 0.06) * fadeAll;
      const themes = 1 + 0.8 * (pulse(t, T.newTheme1 - 0.02, T.newTheme1, T.newTheme1 + 0.05) + pulse(t, T.newTheme2 - 0.02, T.newTheme2, T.newTheme2 + 0.05));
      let i = 0;
      for (let s = 0; s < STREAMS; s++) {
        const on = ramp(t, T.musicStart + s * 0.025, T.musicStart + s * 0.025 + 0.05) * fadeAll;
        const tilt = (s / STREAMS) * Math.PI + 0.3;
        const k = 2 + (s % 3);
        const speed = 0.12 + s * 0.015;
        for (let p = 0; p < PER; p++, i++) {
          const ph = p / PER;
          const a = ph * Math.PI * 2 * k + ambient * speed;
          const r = 3.2 + 1.6 * Math.sin(ph * Math.PI * 2 * 3 + s + ambient * 0.2);
          // Discord shakes the harmony nearest to it.
          const shake = discord * 0.6 * (hash(p, s, Math.floor(ambient * 12)) - 0.5);
          const x = r * Math.cos(a) + shake;
          const y0 = r * Math.sin(a);
          const y = y0 * Math.sin(tilt) + 0.4 * Math.sin(ph * 40 + ambient) + shake;
          const z = y0 * Math.cos(tilt) + shake;
          mPos[i * 3] = x; mPos[i * 3 + 1] = y; mPos[i * 3 + 2] = z;
          const sparkle = 0.55 + 0.45 * Math.sin(ph * 90 + ambient * 3 + s);
          const b = on * sparkle * 0.55 * themes;
          const col = streamColors[s];
          mCol[i * 3] = col.r * b; mCol[i * 3 + 1] = col.g * b; mCol[i * 3 + 2] = col.b * b;
        }
      }
      // Melkor's discord: jagged, loud, spreading from one side.
      const spread = 0.6 + 4.5 * ramp(t, T.discordStart, T.chord);
      for (let d = 0; d < DISCORD; d++, i++) {
        const jag = Math.floor(ambient * 9 + d * 0.37);
        const th = hash(d, 1) * Math.PI * 2;
        const ph = Math.acos(2 * hash(d, 2) - 1);
        const r = spread * Math.pow(hash(d, 3), 0.5) * (0.8 + 0.4 * hash(d, jag));
        mPos[i * 3] = 2.6 + r * Math.sin(ph) * Math.cos(th);
        mPos[i * 3 + 1] = 0.8 + r * Math.cos(ph) * 0.7;
        mPos[i * 3 + 2] = -1.5 + r * Math.sin(ph) * Math.sin(th);
        const b = discord * (0.35 + 0.65 * hash(d, jag, 4));
        mCol[i * 3] = discordColor.r * b; mCol[i * 3 + 1] = discordColor.g * b; mCol[i * 3 + 2] = discordColor.b * b;
      }
      mGeo.attributes.position.needsUpdate = true;
      mGeo.attributes.color.needsUpdate = true;
      music.visible = t < T.chord + 0.02;

      // --- The single chord ---
      const chord = ramp(t, T.chord, T.chord + 0.05);
      const chordMat = chordRing.material as THREE.MeshBasicMaterial;
      chordRing.visible = t > T.chord && t < T.chord + 0.05;
      chordRing.scale.setScalar(1 + chord * 14);
      chordRing.lookAt(camera.position);
      chordMat.opacity = 1 - chord;

      // --- Vision: a ghostly world, then Eä makes it real ---
      const vision = ramp(t, T.visionStart, T.visionStart + 0.08) * (1 - ramp(t, T.ea, T.ardaSolid));
      (ghost.material as THREE.LineBasicMaterial).opacity = vision * 0.8;
      ghost.visible = vision > 0.001;
      const spin = ambient * 0.05;
      ghost.rotation.y = spin;

      const real = ramp(t, T.ea, T.ardaSolid);
      setOpacity(ambar, real);
      ambar.rotation.y = spin;
      hemi.intensity = real * 1.4;
      sun.intensity = real * 1.8;

      for (const sh of shells) {
        const a = ramp(t, sh.appear, sh.appear + 0.04);
        // The shells also shimmer faintly during the Vision, as a preview.
        sh.mat.uniforms.uOpacity.value = Math.max(a * sh.strength, vision * sh.strength * 0.35);
        sh.mesh.visible = sh.mat.uniforms.uOpacity.value > 0.001;
      }
      starMat.opacity = ramp(t, 0.9, 0.95) * (0.7 + 0.3 * Math.sin(ambient * 2));

      const labelsOn = ramp(t, 0.93, T.shellsDone + 0.02);
      for (const l of labelObjs) (l.element as HTMLElement).style.opacity = String(labelsOn);
    },

    flash(t) {
      return pulse(t, T.ea - 0.004, T.ea + 0.002, T.ea + 0.03);
    },

    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },

    dispose() {
      for (const l of labelObjs) l.element.remove();
      disposeTree(scene);
      tex.dispose();
    },
  };
}
