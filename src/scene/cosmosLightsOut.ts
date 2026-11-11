import * as THREE from 'three';
import type { Stage } from './stage';
import { clamp01, disposeTree, hash, pulse, ramp } from './util';
import { createCosmosWorld, fitCamera, Glows, nameLabel, shellMaterial, showLabel, type CosmosLabels } from './cosmosWorld';
import { E, N, S, shipGeo, W } from './cosmosLands';
import { dreamWorld, farStars, fillTrail, Globe, pale, ROUND_WORLD } from './cosmosForetold';

/**
 * Foretold: the Sun and the Moon are destroyed. Back in the world, Morgoth comes down from the
 * north as a churning shadow shot with embers and reaches out to the lights of heaven; the Sun
 * and then the Moon gutter and go out, and the round world lies dark under the stars, as
 * before the first sunrise. One light is left: Eärendil's star. It falls on the shadow as a
 * white flame, breaks it, and drives it out past the Walls of the World.
 *
 * Shown in the dream register of what is foretold (cosmosForetold.ts). Everything is a pure
 * function of `t`; `ambient` only drives churning, flicker and twinkle.
 */

// Timeline (normalised event time), tuned against the passages in staging.yaml.
const T = {
  come: [0.02, 0.13], reach: [0.07, 0.19],
  sunOut: [0.13, 0.22], moonOut: [0.18, 0.28],
  star: [0.45, 0.5], dive: [0.55, 0.66], strike: 0.66,
  flee: [0.72, 0.95], chase: [0.66, 0.84], back: [0.84, 0.98],
} as const;

const CAM_D = 17;
const R = 2.1;
const CENTRE = new THREE.Vector3(0, 0.3, 0);

export function createLightsOutStage(labels: CosmosLabels): Stage {
  const globe = new Globe(ROUND_WORLD, R, 22, 11, 5);
  globe.group.position.copy(CENTRE);

  const up = new THREE.Vector3(0, 1, 0);
  const SUN_AT = CENTRE.clone().addScaledVector(W, 3.1).addScaledVector(S, 0.8).addScaledVector(up, 2.2);
  const MOON_AT = CENTRE.clone().addScaledVector(E, 3.3).addScaledVector(S, 0.4).addScaledVector(up, 1.7);
  const FAR = CENTRE.clone().addScaledVector(N, 13).addScaledVector(up, 6);
  const HOVER = CENTRE.clone().addScaledVector(N, 1.8).addScaledVector(up, 3.2);
  const OUT = CENTRE.clone().addScaledVector(N, 15).addScaledVector(up, 9).addScaledVector(W, 3);
  const STAR = CENTRE.clone().addScaledVector(up, 4.9).addScaledVector(S, 1.5).addScaledVector(E, 2.6);

  const sunMat = new THREE.MeshBasicMaterial({ color: '#ffd77a' });
  const sunBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), sunMat);
  sunBall.position.copy(SUN_AT);
  const moonMat = new THREE.MeshBasicMaterial({ color: '#e8eeff' });
  const moonBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), moonMat);
  moonBall.position.copy(MOON_AT);

  // Vingilot, Eärendil's ship, seen only as it dives.
  const ship = new THREE.Mesh(shipGeo('#f4f1ea', '#ffffff'), new THREE.MeshBasicMaterial({ vertexColors: true }));

  // The shadow: dark smoke (drawn over the lights it covers), embers, and two reaching arms.
  const SMOKE = 760, ARM = 170, EMBER = 300;
  const sPos = new Float32Array((SMOKE + ARM * 2) * 3), sCol = new Float32Array((SMOKE + ARM * 2) * 3);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const smokeMat = new THREE.PointsMaterial({ size: 1.0, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false });
  const smoke = new THREE.Points(sGeo, smokeMat);
  smoke.renderOrder = 3;

  // Light: embers, the dying sparks of the Sun and Moon, Eärendil's trail, the burst.
  const TRAIL = 220, SPARK = 260, BURST = 260;
  const nL = EMBER + SPARK + TRAIL + BURST;
  const lPos = new Float32Array(nL * 3), lCol = new Float32Array(nL * 3);
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
  lGeo.setAttribute('color', new THREE.BufferAttribute(lCol, 3));

  const airMat = shellMaterial('#9fd8ff');
  const air = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 48, 32), airMat);
  air.position.copy(CENTRE);
  const moonLight = new THREE.DirectionalLight('#c4d2ff', 0);
  const starLight = new THREE.DirectionalLight('#eef4ff', 0);

  let glows!: Glows;
  const world = createCosmosWorld(labels, (scene, tex) => {
    scene.add(globe.group, sunBall, moonBall, ship, air, moonLight, moonLight.target, starLight, starLight.target);
    glows = new Glows(tex, scene);
    smokeMat.map = tex;
    scene.add(smoke);
    const lights = new THREE.Points(lGeo, new THREE.PointsMaterial({ size: 0.12, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    lights.renderOrder = 4;
    scene.add(lights);
  });
  const { scene, camera, target, hemi, sun, tex, shells, starMat } = world;
  scene.add(sun.target);
  const dream = dreamWorld(world, 10);
  farStars(world);
  const sunGlow = glows.make('#fff0c0'), sunHalo = glows.make('#ffb048');
  const moonGlow = glows.make('#dce8ff'), moonHalo = glows.make('#8fa8e0');
  const starCore = glows.make('#ffffff'), starHalo = glows.make('#cfe0ff'), strikeGlow = glows.make('#ffffff');
  const emberGlow = glows.make('#ff4a1e');
  const burst = new THREE.Mesh(
    new THREE.RingGeometry(0.96, 1, 96),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  scene.add(burst);

  target.set(0, 1.5, 0);
  const view = new THREE.Vector3().copy(S).addScaledVector(E, 0.15).normalize();
  camera.position.copy(target).addScaledVector(view, CAM_D * Math.cos(0.3)).setY(target.y + CAM_D * Math.sin(0.3));
  hemi.groundColor.set('#141a26');

  const sunLabel = nameLabel(world, labels.sun), moonLabel = nameLabel(world, labels.moon);
  // Below the Sun and a little to the west, clear of the event card above it.
  sunLabel.position.copy(SUN_AT).addScaledVector(W, 0.35).setY(SUN_AT.y - 0.62);
  moonLabel.position.copy(MOON_AT).setY(MOON_AT.y + 0.7);
  const morgothLabel = nameLabel(world, 'Morgoth', '');
  const earendilLabel = nameLabel(world, 'Eärendil');

  const c = new THREE.Color(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  const M = new THREE.Vector3(), head = new THREE.Vector3(), ctrl = new THREE.Vector3();
  const smokeDark = new THREE.Color('#020104'), smokeEdge = new THREE.Color('#0d0610');
  const ember = new THREE.Color('#ff5a26'), white = new THREE.Color('#f4f8ff'), gold = new THREE.Color('#ffc860'), silver = new THREE.Color('#dfe8ff');
  const night = new THREE.Color('#5d68a8'), day = new THREE.Color('#fff1da');
  const SUN_LIT = new THREE.Color('#ffd77a'), SUN_DEAD = new THREE.Color('#140b09');
  const MOON_LIT = new THREE.Color('#e8eeff'), MOON_DEAD = new THREE.Color('#121219');
  const DARK_SEA = new THREE.Color('#16243a'), SUN_RAY = new THREE.Color('#ffe6bc');
  const AIR_LIT = new THREE.Color('#9fd8ff'), AIR_DARK = new THREE.Color('#5a5f90');
  const ARMS = [[SUN_AT, 33], [MOON_AT, 34]] as const;
  // Per-frame inputs for the callbacks below, made once so no closure is built per frame.
  let frameT = 0, lit = 0, starGleam = 0;
  const trailAt = (s: number, out: THREE.Vector3) => (frameT < T.strike ? diveAt(s, out) : out.copy(head));
  const paintWorld = (f: number, col: THREE.Color) => {
    pale(col, 0.16);
    col.multiplyScalar(0.62 + 0.38 * lit + 0.2 * starGleam);
    if (globe.water[f]) col.lerp(DARK_SEA, 0.4 * (1 - lit));
  };

  /** Where Morgoth's shadow is at t. */
  const shadowAt = (t: number, out: THREE.Vector3) => {
    out.lerpVectors(FAR, HOVER, ramp(t, T.come[0], T.come[1]));
    const f = ramp(t, T.flee[0], T.flee[1]);
    return out.lerp(OUT, f * f);
  };
  /** Eärendil's dive: from his place in the sky down onto the shadow, sweeping out to the side. */
  const diveAt = (s: number, out: THREE.Vector3) => {
    shadowAt(T.strike, M);
    ctrl.copy(STAR).addScaledVector(E, 3).addScaledVector(up, -0.5);
    const a = (1 - s) * (1 - s), b = 2 * s * (1 - s), d = s * s;
    return out.set(a * STAR.x + b * ctrl.x + d * M.x, a * STAR.y + b * ctrl.y + d * M.y, a * STAR.z + b * ctrl.z + d * M.z);
  };

  return {
    scene, camera, target,

    update(t, ambient) {
      frameT = t;
      // --- the lights of heaven, and their going out ---
      const sunOn = 1 - ramp(t, T.sunOut[0], T.sunOut[1]);
      const moonOn = 1 - ramp(t, T.moonOut[0], T.moonOut[1]);
      const sunDying = pulse(t, T.sunOut[0] - 0.03, T.sunOut[0] + 0.03, T.sunOut[1]);
      const moonDying = pulse(t, T.moonOut[0] - 0.03, T.moonOut[0] + 0.03, T.moonOut[1]);
      const flick = (k: number) => 1 - k * 0.45 * (0.5 + 0.5 * Math.sin(ambient * 23)) * (0.5 + 0.5 * Math.sin(ambient * 37 + 1));
      sunMat.color.copy(SUN_DEAD).lerp(SUN_LIT, sunOn);
      moonMat.color.copy(MOON_DEAD).lerp(MOON_LIT, moonOn);
      Glows.set(sunGlow, SUN_AT, 1.6, sunOn * 0.95 * flick(sunDying));
      Glows.set(sunHalo, SUN_AT, 5.5, sunOn * 0.42 * flick(sunDying));
      Glows.set(moonGlow, MOON_AT, 1.1, moonOn * 0.8 * flick(moonDying));
      Glows.set(moonHalo, MOON_AT, 3.4, moonOn * 0.3 * flick(moonDying));

      // --- the star, the dive, the strike, the flight ---
      const starOn = ramp(t, T.star[0], T.star[1]);
      const dive = clamp01((t - T.dive[0]) / (T.dive[1] - T.dive[0]));
      const diveE = dive * dive * (1.6 - 0.6 * dive);
      shadowAt(t, M);
      if (t < T.dive[0]) head.copy(STAR);
      else if (t < T.strike) diveAt(diveE, head);
      else {
        // Pushing the shadow out, close behind it; then back up to his place in the sky.
        const chase = ramp(t, T.chase[0], T.chase[1]);
        v3.subVectors(M, CENTRE).normalize();
        head.copy(M).addScaledVector(v3, -0.9 - 0.6 * chase);
        diveAt(1, v4);
        head.lerp(v4, 1 - ramp(t, T.strike, T.strike + 0.02));
        head.lerp(STAR, ramp(t, T.back[0], T.back[1]));
      }
      const flame = pulse(t, T.dive[0] - 0.02, T.dive[0] + 0.03, T.back[1]);
      const strike = pulse(t, T.strike - 0.004, T.strike + 0.004, T.strike + 0.07);
      const tw = 0.9 + 0.1 * Math.sin(ambient * 2.7);
      Glows.set(starCore, head, 0.7 + 0.5 * flame, starOn * (0.85 + 0.15 * flame) * tw);
      Glows.set(starHalo, head, 2.2 + 1.8 * flame, starOn * (0.35 + 0.25 * flame) * tw);
      Glows.set(strikeGlow, M, 2 + 3.5 * strike, strike * 0.75);
      const bm = burst.material as THREE.MeshBasicMaterial;
      const bk = ramp(t, T.strike, T.strike + 0.08);
      burst.position.copy(M);
      burst.lookAt(camera.position);
      burst.scale.setScalar(0.3 + bk * 4.5);
      bm.opacity = 0.8 * (1 - bk) * (t > T.strike ? 1 : 0);
      burst.visible = bm.opacity > 0.002;

      // Vingilot under the flame, along the line of flight.
      ship.visible = flame > 0.05 && t < T.back[0] + 0.06;
      if (ship.visible) {
        ship.position.copy(head).addScaledVector(up, -0.12);
        if (t < T.strike) diveAt(Math.min(1, diveE + 0.02), v3); else v3.copy(M);
        ship.lookAt(v3.lengthSq() ? v3 : M);
        ship.scale.setScalar(0.2 * flame);
      }

      // --- the shadow: smoke, arms reaching to the Sun and the Moon, embers ---
      const come = ramp(t, T.come[0] - 0.02, T.come[0] + 0.04);
      const flee = ramp(t, T.flee[0], T.flee[1]);
      const broken = ramp(t, T.strike, T.strike + 0.1);
      const size = (1 - 0.55 * flee) * (1 + 0.35 * broken);
      const reach = ramp(t, T.reach[0], T.reach[1]) * (1 - ramp(t, 0.3, 0.4));
      const looming = pulse(t, 0.25, 0.36, T.strike + 0.02);
      let i = 0;
      for (let s = 0; s < SMOKE; s++, i++) {
        const h1 = hash(s, 1, 31), h2 = hash(s, 2, 31), h3 = hash(s, 3, 31);
        const th = h1 * Math.PI * 2 + ambient * (0.05 + 0.1 * h3), ph = Math.acos(2 * h2 - 1);
        const r = (0.55 + 1.15 * Math.cbrt(h3)) * size * (1 + 0.4 * looming) + broken * h3 * 1.6;
        sPos[i * 3] = M.x + r * Math.sin(ph) * Math.cos(th) * 1.3;
        sPos[i * 3 + 1] = M.y + r * Math.cos(ph) * 0.75 + 0.15 * Math.sin(ambient * 0.4 + s);
        sPos[i * 3 + 2] = M.z + r * Math.sin(ph) * Math.sin(th) * 1.3;
        c.copy(smokeDark).lerp(smokeEdge, h3);
        sCol[i * 3] = c.r; sCol[i * 3 + 1] = c.g; sCol[i * 3 + 2] = c.b;
      }
      smokeMat.opacity = 0.8 * come * (1 - 0.6 * broken) * (1 - ramp(t, 0.9, 0.98));
      smoke.visible = smokeMat.opacity > 0.01;
      // Arms: from the shadow to each light, curling, then drawn back.
      for (const [goal, seed] of ARMS) {
        for (let a = 0; a < ARM; a++, i++) {
          const q = a / ARM;
          const along = q * reach;
          v3.lerpVectors(M, goal, along);
          v3.y += Math.sin(along * Math.PI) * 0.9;
          const w = 0.35 * (1 - q * 0.6);
          v3.x += (hash(a, 1, seed) - 0.5) * w + Math.sin(ambient * 0.9 + a * 0.3) * 0.08;
          v3.y += (hash(a, 2, seed) - 0.5) * w;
          v3.z += (hash(a, 3, seed) - 0.5) * w;
          v3.toArray(sPos, i * 3);
          sCol[i * 3] = smokeDark.r; sCol[i * 3 + 1] = smokeDark.g; sCol[i * 3 + 2] = smokeDark.b;
          // Drawn back in, an arm is just more of the smoke.
          if (reach <= 0.02) sPos.copyWithin(i * 3, (a + (seed - 33) * ARM) * 3, (a + (seed - 33) * ARM) * 3 + 3);
        }
      }
      sGeo.attributes.position.needsUpdate = true;
      sGeo.attributes.color.needsUpdate = true;
      sGeo.computeBoundingSphere();

      let j = 0;
      const emberK = come * (1 - 0.7 * broken) * (1 - ramp(t, 0.88, 0.97));
      for (let e = 0; e < EMBER; e++, j++) {
        const h1 = hash(e, 1, 35), h2 = hash(e, 2, 35), h3 = hash(e, 3, 35);
        const th = h1 * Math.PI * 2 - ambient * 0.12, ph = Math.acos(2 * h2 - 1), r = (0.2 + 1.3 * h3) * size;
        lPos[j * 3] = M.x + r * Math.sin(ph) * Math.cos(th) * 1.3; lPos[j * 3 + 1] = M.y + r * Math.cos(ph) * 0.7; lPos[j * 3 + 2] = M.z + r * Math.sin(ph) * Math.sin(th) * 1.3;
        const b = emberK * (0.15 + 0.85 * Math.max(0, Math.sin(ambient * (1 + h3 * 2) + e))) * 0.45 * (h2 > 0.55 ? 1 : 0.3);
        lCol[j * 3] = ember.r * b; lCol[j * 3 + 1] = ember.g * b; lCol[j * 3 + 2] = ember.b * b;
      }
      Glows.set(emberGlow, M, 3 * size, 0.05 * emberK);
      // Sparks shed by the dying Sun and Moon, falling away.
      for (let s = 0; s < SPARK; s++, j++) {
        const sunSide = s < SPARK / 2;
        const h1 = hash(s, 1, 36), h2 = hash(s, 2, 36), h3 = hash(s, 3, 36);
        const dying = sunSide ? ramp(t, T.sunOut[0], T.sunOut[1] + 0.05) : ramp(t, T.moonOut[0], T.moonOut[1] + 0.05);
        const from = sunSide ? SUN_AT : MOON_AT;
        const life = clamp01(dying * 1.4 - h3 * 0.4);
        const ang = h1 * Math.PI * 2, rr = 0.2 + life * (0.6 + h2 * 1.2);
        lPos[j * 3] = from.x + Math.cos(ang) * rr; lPos[j * 3 + 1] = from.y - life * life * 1.6 + Math.sin(ang) * rr * 0.6; lPos[j * 3 + 2] = from.z + Math.sin(ang) * rr * 0.6;
        const b = Math.sin(life * Math.PI) * 0.8;
        c.copy(sunSide ? gold : silver).multiplyScalar(b);
        lCol[j * 3] = c.r; lCol[j * 3 + 1] = c.g; lCol[j * 3 + 2] = c.b;
      }
      fillTrail(lPos, lCol, j, TRAIL, Math.min(1, diveE), 0.45, trailAt, white, flame * (t < T.strike ? 1.1 : 0.35), ambient, t < T.strike ? 0.12 : 0.6, 37);
      j += TRAIL;
      const bt = ramp(t, T.strike, T.strike + 0.12);
      for (let b = 0; b < BURST; b++, j++) {
        const h1 = hash(b, 1, 38), h2 = hash(b, 2, 38), h3 = hash(b, 3, 38);
        const th = h1 * Math.PI * 2, ph = Math.acos(2 * h2 - 1), r = bt * (1 + 2.6 * h3);
        lPos[j * 3] = M.x + r * Math.sin(ph) * Math.cos(th); lPos[j * 3 + 1] = M.y + r * Math.cos(ph); lPos[j * 3 + 2] = M.z + r * Math.sin(ph) * Math.sin(th);
        const k = (t > T.strike ? 1 : 0) * (1 - bt) * 0.9;
        lCol[j * 3] = white.r * k; lCol[j * 3 + 1] = white.g * k; lCol[j * 3 + 2] = white.b * k;
      }
      lGeo.attributes.position.needsUpdate = true;
      lGeo.attributes.color.needsUpdate = true;
      lGeo.computeBoundingSphere();

      // --- the world below: lit, then dark as before the first sunrise, then a white gleam ---
      lit = Math.max(sunOn, 0.45 * moonOn);
      starGleam = starOn * (0.25 + 0.75 * flame) * (1 - 0.5 * ramp(t, T.back[0], T.back[1]));
      globe.update(0, paintWorld);
      sun.position.copy(SUN_AT);
      sun.target.position.copy(CENTRE);
      sun.color.copy(SUN_RAY);
      sun.intensity = 1.5 * sunOn;
      moonLight.position.copy(MOON_AT);
      moonLight.target.position.copy(CENTRE);
      moonLight.intensity = 0.5 * moonOn;
      starLight.position.copy(head);
      starLight.target.position.copy(CENTRE);
      starLight.intensity = 0.9 * starGleam;
      hemi.intensity = 0.34 + 0.5 * lit + 0.2 * starGleam;
      hemi.color.copy(night).lerp(day, sunOn * 0.8);

      // --- names ---
      showLabel(sunLabel, ramp(t, 0.01, 0.05) * (1 - ramp(t, T.sunOut[1] - 0.03, T.sunOut[1] + 0.02)));
      showLabel(moonLabel, ramp(t, 0.02, 0.06) * (1 - ramp(t, T.moonOut[1] - 0.03, T.moonOut[1] + 0.02)));
      morgothLabel.position.copy(M).setY(M.y + 1.5 * size + 0.2);
      showLabel(morgothLabel, ramp(t, 0.08, 0.12) * (1 - ramp(t, 0.4, 0.44)) + pulse(t, T.strike, T.strike + 0.04, T.flee[0] + 0.08));
      earendilLabel.position.copy(head).setY(head.y + 0.7);
      showLabel(earendilLabel, ramp(t, T.star[0] + 0.01, T.star[1] + 0.01) * (1 - ramp(t, T.dive[0], T.dive[0] + 0.03)) + ramp(t, T.back[1] - 0.06, T.back[1]));

      // --- sky ---
      starMat.opacity = (0.35 + 0.5 * (1 - lit)) * (0.85 + 0.15 * Math.sin(ambient * 2));
      for (let si = 0; si < shells.length; si++) {
        const sh = shells[si];
        sh.mat.uniforms.uOpacity.value = si < 2 ? 0 : sh.strength * (0.35 + 0.35 * lit);
        sh.mesh.visible = si >= 2;
      }
      airMat.uniforms.uOpacity.value = 0.12 + 0.3 * lit + 0.12 * starGleam;
      (airMat.uniforms.uColor.value as THREE.Color).copy(AIR_LIT).lerp(AIR_DARK, 1 - lit);
      dream.update(ambient);
      glows.face(camera);
    },

    flash(t) {
      return 0.28 * pulse(t, T.strike - 0.004, T.strike + 0.002, T.strike + 0.035);
    },

    resize(w, h) { fitCamera(camera, target, w, h, CAM_D, 6); },

    dispose() {
      for (const l of world.labels) l.element.remove();
      disposeTree(scene);
      tex.dispose();
    },
  };
}
