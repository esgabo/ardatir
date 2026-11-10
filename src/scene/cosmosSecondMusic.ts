import * as THREE from 'three';
import type { Stage } from './stage';
import { clamp01, disposeTree, hash, pulse, ramp } from './util';
import { createCosmosWorld, fitCamera, Glows, nameLabel, showLabel, type CosmosLabels } from './cosmosWorld';
import { dreamWorld, Globe, pale, ROUND_WORLD } from './cosmosForetold';

/**
 * Foretold: the Second Music of the Ainur, in the visual language of the Ainulindalë (cosmos.ts).
 * First a faint echo of the first Music, Melkor's red discord still flickering in it, and the
 * world that came out of it, small in the mist. After the end of days that world pales into a
 * point of light; a great light stands over it (Ilúvatar), and the Ainur's themes sing out again
 * as streams of light. The Children of Ilúvatar join them, the Elves in silver, then Men in warm
 * gold. At last every theme is played aright: the streams settle into one even, turning harmony
 * with no discord in it, what they sing takes being as sparks of light, and all ends in light.
 *
 * Shown in the dream register of what is foretold (cosmosForetold.ts). Everything is a pure
 * function of `t`; `ambient` only drives the flowing of the streams, shimmer and twinkle.
 */

// Timeline (normalised event time), tuned against the passages in staging.yaml.
const T = {
  echo: [-0.01, 0.03, 0.17], discord: [-0.01, 0.04, 0.13],
  world: [0.05, 0.12], end: [0.19, 0.27],
  iluvatar: [0.22, 0.3],
  ainur: [0.26, 0.36], elves: [0.35, 0.45], men: [0.5, 0.6],
  aright: [0.68, 0.8], real: [0.8, 0.95], bloom: [0.9, 1],
} as const;

const CAM_D = 19;
const PER = 700, DISCORD = 900, SPARKS = 520;
const AINUR = ['#ffe2a0', '#a8d8ff', '#fff4dc', '#c8b8ff', '#9ff0d8', '#ffd0a8', '#e8f0ff'];

/** One theme of the Music: its colour, when it sings out, and its shape before it is made whole. */
interface Theme {
  color: THREE.Color; on0: number; on1: number;
  tilt: number; k: number; speed: number; r: number; wob: number;
  /** Ainur themes also sound faintly in the echo of the first Music. */
  echo: boolean;
}

export function createSecondMusicStage(labels: CosmosLabels): Stage {
  const themes: Theme[] = [];
  // The seven themes of the first Music (cosmos.ts), the same colours and shapes, singing out in turn.
  for (let s = 0; s < AINUR.length; s++) {
    const on0 = T.ainur[0] + s * 0.012;
    themes.push({ color: new THREE.Color(AINUR[s]), on0, on1: on0 + 0.06, tilt: (s / AINUR.length) * Math.PI + 0.3, k: 2 + (s % 3), speed: 0.12 + s * 0.015, r: 3.2, wob: 1.6, echo: true });
  }
  // The Children of Ilúvatar: the Elves in silver, then Men in warm gold, nearer the heart.
  const ELF = ['#dfe9ff', '#b8d0ff'], MAN = ['#ffc070', '#ffa860'];
  for (let i = 0; i < 2; i++) {
    const on0 = T.elves[0] + i * 0.03;
    themes.push({ color: new THREE.Color(ELF[i]), on0, on1: on0 + 0.07, tilt: 1.1 + i * 1.4, k: 3, speed: 0.1 + i * 0.02, r: 2.6, wob: 1.0, echo: false });
  }
  for (let i = 0; i < 2; i++) {
    const on0 = T.men[0] + i * 0.03;
    themes.push({ color: new THREE.Color(MAN[i]), on0, on1: on0 + 0.07, tilt: 0.6 + i * 1.7, k: 2, speed: 0.09 + i * 0.02, r: 2.9, wob: 1.2, echo: false });
  }
  const N_T = themes.length;

  const total = N_T * PER + DISCORD + SPARKS;
  const pos = new Float32Array(total * 3), col = new Float32Array(total * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // Fixed bounds: the streams never leave this sphere, so no bounds are computed per frame.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 9);

  // The world that came out of the first Music: the round world, small, in the mist.
  const globe = new Globe(ROUND_WORLD, 1.05, 12, 7, 3);
  globe.topMat.transparent = true;
  const globeGlowMat = globe.glow.material as THREE.MeshBasicMaterial;

  // The harmony's rings, rippling out as the themes are made whole.
  const ringGeo = new THREE.RingGeometry(0.97, 1, 128);
  const rings: THREE.Mesh[] = [];
  const ringMats: THREE.MeshBasicMaterial[] = [];
  for (let k = 0; k < 3; k++) {
    const m = new THREE.MeshBasicMaterial({ color: '#fff4dc', transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    ringMats.push(m);
    rings.push(new THREE.Mesh(ringGeo, m));
  }
  // What is sung takes being: a faceted heart of light.
  const coreMat = new THREE.MeshBasicMaterial({ color: '#fff6e6', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), coreMat);

  let glows!: Glows;
  let music!: THREE.Points;
  const world = createCosmosWorld(labels, (scene, tex) => {
    scene.add(globe.group);
    music = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.15, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(music, core, ...rings);
    glows = new Glows(tex, scene);
  });
  const { scene, camera, target, hemi, sun, tex, shells, starMat } = world;
  const dream = dreamWorld(world, 11);
  const heart = glows.make('#fff1d8'), halo = glows.make('#ffe2b0'), silverHalo = glows.make('#cfe0ff');
  const iluvatar = glows.make('#fffaf0'), iluvatarCore = glows.make('#ffffff');

  target.set(0, 0.3, 0);
  camera.position.set(14, 7, 14).setLength(CAM_D);
  hemi.color.set('#e9e3f5');
  hemi.groundColor.set('#1a1830');
  sun.position.set(4, 8, 6);

  // Names, on the right and low on the stage: clear of the event card (top left) and the breadcrumb.
  const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
  const ILU_AT = new THREE.Vector3(0, 5.0, 0);
  const iluvatarLabel = nameLabel(world, 'Ilúvatar');
  iluvatarLabel.position.copy(ILU_AT).addScaledVector(RIGHT, 2.1).setY(4.2);
  const ainurLabel = nameLabel(world, 'Ainur');
  ainurLabel.position.copy(RIGHT).multiplyScalar(4.6).setY(0.9);
  const elvesLabel = nameLabel(world, labels.elves, '');
  elvesLabel.position.copy(RIGHT).multiplyScalar(3.6).setY(-2.0);
  const menLabel = nameLabel(world, labels.men, '');
  menLabel.position.copy(RIGHT).multiplyScalar(-1.2).setY(-3.4);

  // The globe's top (the lands of the old map) turned a little towards the viewer, spinning on its own axis.
  const TILT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 1.1, 1).normalize());
  const SPIN = new THREE.Quaternion(), Y_AXIS = new THREE.Vector3(0, 1, 0);
  const discordColor = new THREE.Color('#ff3a1e');
  const WHITE_GOLD = new THREE.Color('#fff3dc');

  // Per-frame inputs for the globe's paint, set in update so no closure is built per frame.
  let fade = 0, worldOn = 0;
  const paintGlobe = (f: number, col: THREE.Color, glow: THREE.Color) => {
    pale(col, 0.1 + 0.6 * fade);
    col.lerp(WHITE_GOLD, fade);
    glow.copy(WHITE_GOLD).multiplyScalar((0.5 * fade) * worldOn * (globe.water[f] ? 0.6 : 1));
  };

  return {
    scene, camera, target,

    update(t, ambient) {
      const echo = pulse(t, T.echo[0], T.echo[1], T.echo[2]);
      const discord = pulse(t, T.discord[0], T.discord[1], T.discord[2]);
      const aright = ramp(t, T.aright[0], T.aright[1]);
      const real = ramp(t, T.real[0], T.real[1]);
      const bloom = ramp(t, T.bloom[0], T.bloom[1]);
      const swell = ramp(t, T.ainur[0], T.men[1]);
      const spin = ambient * 0.03;
      const cs = Math.cos(spin), sn = Math.sin(spin);

      // --- the themes: an echo of the first Music, then the choirs, then made whole ---
      let i = 0;
      for (let s = 0; s < N_T; s++) {
        const th = themes[s];
        const on = Math.max(ramp(t, th.on0, th.on1), th.echo ? 0.35 * echo : 0);
        // Played aright: every theme settles into one even, slowly turning harmony.
        const tilt = th.tilt + ((s / N_T) * Math.PI - th.tilt) * aright;
        const st = Math.sin(tilt), ct = Math.cos(tilt);
        const k = th.k + (3 - th.k) * aright;
        const rBase = th.r + (3.4 - th.r) * aright - 0.5 * real;
        const wob = th.wob * (1 - aright);
        const cr = th.color.r + (WHITE_GOLD.r - th.color.r) * real * 0.6;
        const cg = th.color.g + (WHITE_GOLD.g - th.color.g) * real * 0.6;
        const cb = th.color.b + (WHITE_GOLD.b - th.color.b) * real * 0.6;
        const level = on * (0.55 + 0.2 * aright) * (1 - 0.3 * bloom);
        for (let p = 0; p < PER; p++, i++) {
          const ph = p / PER;
          const a = ph * Math.PI * 2 * k + ambient * th.speed;
          const r = rBase + wob * Math.sin(ph * Math.PI * 2 * 3 + s + ambient * 0.2);
          // The memory of the discord still shakes the echo (its jitter is idle motion).
          const shake = discord * 0.5 * (hash(p, s, Math.floor(ambient * 12)) - 0.5);
          const y0 = r * Math.sin(a);
          const x = r * Math.cos(a), z = y0 * ct;
          const o = i * 3;
          pos[o] = x * cs - z * sn + shake;
          pos[o + 1] = y0 * st + (1 - aright) * 0.4 * Math.sin(ph * 40 + ambient) + shake;
          pos[o + 2] = x * sn + z * cs + shake;
          const b = level * (0.55 + 0.45 * Math.sin(ph * 90 + ambient * 3 + s));
          col[o] = cr * b; col[o + 1] = cg * b; col[o + 2] = cb * b;
        }
      }
      // Melkor's discord, only as a memory in the echo: a few red flickers, gone before the choirs.
      for (let d = 0; d < DISCORD; d++, i++) {
        const o = i * 3;
        if (discord <= 0) { col[o] = 0; col[o + 1] = 0; col[o + 2] = 0; continue; }
        const jag = Math.floor(ambient * 9 + d * 0.37);
        const th = hash(d, 1) * Math.PI * 2, ph = Math.acos(2 * hash(d, 2) - 1), r = 2.2 * Math.sqrt(hash(d, 3)) * (0.8 + 0.4 * hash(d, jag));
        pos[o] = 2.4 + r * Math.sin(ph) * Math.cos(th);
        pos[o + 1] = 0.6 + r * Math.cos(ph) * 0.7;
        pos[o + 2] = -1.4 + r * Math.sin(ph) * Math.sin(th);
        const b = discord * 0.4 * (0.3 + 0.7 * hash(d, jag, 4));
        col[o] = discordColor.r * b; col[o + 1] = discordColor.g * b; col[o + 2] = discordColor.b * b;
      }
      // What is sung takes being as it is sung: sparks born on the harmony, drifting out and staying.
      for (let q = 0; q < SPARKS; q++, i++) {
        const o = i * 3;
        const born = T.real[0] - 0.02 + hash(q, 1, 61) * 0.15;
        const age = clamp01((t - born) / 0.1);
        if (age <= 0) { col[o] = 0; col[o + 1] = 0; col[o + 2] = 0; continue; }
        const s = q % N_T, tilt = (s / N_T) * Math.PI;
        const a = hash(q, 2, 61) * Math.PI * 2 + ambient * themes[s].speed;
        const r = (3.4 - 0.5 * real) * (1 + 0.55 * age * (0.6 + 0.4 * hash(q, 3, 61)));
        const y0 = r * Math.sin(a), x = r * Math.cos(a), z = y0 * Math.cos(tilt);
        pos[o] = x * cs - z * sn;
        pos[o + 1] = y0 * Math.sin(tilt) + 0.05 * Math.sin(ambient * 1.3 + q);
        pos[o + 2] = x * sn + z * cs;
        const th = themes[s].color;
        const b = (0.5 + 0.5 * (1 - age)) * (0.75 + 0.25 * Math.sin(ambient * 2.1 + q)) * 0.9;
        col[o] = (th.r + WHITE_GOLD.r) * 0.5 * b; col[o + 1] = (th.g + WHITE_GOLD.g) * 0.5 * b; col[o + 2] = (th.b + WHITE_GOLD.b) * 0.5 * b;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

      // --- the world that came out of the first Music, and the end of days ---
      worldOn = ramp(t, T.world[0], T.world[1]) * (1 - ramp(t, T.end[0] + 0.04, T.end[1]));
      fade = ramp(t, T.end[0], T.end[1] - 0.02);
      globe.group.visible = worldOn > 0.005;
      if (globe.group.visible) {
        globe.update(0, paintGlobe);
        globe.group.position.copy(target);
        globe.group.quaternion.multiplyQuaternions(TILT, SPIN.setFromAxisAngle(Y_AXIS, ambient * 0.04));
        globe.group.scale.setScalar(0.5 + 0.5 * ramp(t, T.world[0], T.world[1]) - 0.45 * fade);
        globe.topMat.opacity = worldOn;
        globeGlowMat.opacity = worldOn;
      }
      hemi.intensity = 0.9 * worldOn;
      sun.intensity = 2.0 * worldOn;

      // --- lights: the point the world became, Ilúvatar's light, the heart of the Music ---
      const ilu = ramp(t, T.iluvatar[0], T.iluvatar[1]);
      const iluTw = 0.94 + 0.06 * Math.sin(ambient * 0.6);
      Glows.set(iluvatar, ILU_AT, 7 + 3 * aright + 6 * bloom, (0.22 + 0.12 * aright) * ilu * iluTw);
      Glows.set(iluvatarCore, ILU_AT, 1.4 + 0.6 * aright, 0.7 * ilu * (1 - 0.5 * bloom));
      const seed = pulse(t, T.end[0], T.end[1], T.ainur[1] + 0.04);
      Glows.set(heart, target, 1.0 + 1.5 * seed + 2.5 * real + 10 * bloom, 0.45 * seed + 0.12 * swell * (1 - real) + 0.8 * real);
      Glows.set(halo, target, 6 + 6 * aright + 10 * bloom, 0.08 * swell + 0.2 * aright + 0.3 * bloom);
      Glows.set(silverHalo, target, 9 + 4 * real, 0.12 * aright * (0.9 + 0.1 * Math.sin(ambient * 0.7)));
      core.scale.setScalar(Math.max(0.001, 0.8 * real));
      core.rotation.set(0.3, ambient * 0.05, 0.1);
      coreMat.opacity = 0.85 * real;
      core.visible = real > 0.01;
      for (let k = 0; k < rings.length; k++) {
        const q = clamp01((t - T.aright[0] - k * 0.05) / 0.16);
        rings[k].scale.setScalar(0.5 + q * (6 + k * 2));
        rings[k].lookAt(camera.position);
        ringMats[k].opacity = 0.4 * Math.sin(q * Math.PI);
        rings[k].visible = q > 0 && q < 1;
      }

      // --- names: gone before the themes are made one ---
      const namesOff = 1 - ramp(t, T.aright[0] - 0.02, T.aright[0] + 0.02);
      showLabel(iluvatarLabel, ramp(t, T.iluvatar[0] + 0.03, T.iluvatar[1] + 0.02) * (1 - ramp(t, T.real[0], T.real[0] + 0.04)));
      showLabel(ainurLabel, ramp(t, T.ainur[0] + 0.02, T.ainur[0] + 0.06) * namesOff);
      showLabel(elvesLabel, ramp(t, T.elves[0] + 0.03, T.elves[0] + 0.07) * namesOff);
      showLabel(menLabel, ramp(t, T.men[0] + 0.03, T.men[0] + 0.07) * namesOff);

      // --- no world now: no shells, no stars, only the Void in its dream ---
      starMat.opacity = 0;
      for (let si = 0; si < shells.length; si++) { shells[si].mat.uniforms.uOpacity.value = 0; shells[si].mesh.visible = false; }
      dream.update(ambient, (0.6 + 0.4 * swell) * (1 - 0.6 * bloom));
      glows.face(camera);
    },

    // It ends in light.
    flash: (t) => 0.55 * ramp(t, T.bloom[0] + 0.03, T.bloom[1]),

    resize(w, h) { fitCamera(camera, target, w, h, CAM_D, 6.2); },

    dispose() {
      for (const l of world.labels) l.element.remove();
      disposeTree(scene);
      tex.dispose();
    },
  };
}
