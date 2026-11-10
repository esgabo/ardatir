import * as THREE from 'three';
import type { Stage } from './stage';
import { clamp01, disposeTree, hash, pulse, ramp } from './util';
import { createCosmosWorld, fitCamera, Glows, nameLabel, shellMaterial, showLabel, type CosmosLabels } from './cosmosWorld';
import { at, shipGeo } from './cosmosLands';
import { dreamWorld, farStars, fillTrail, Globe, globeDir, Jewel, pale, ROUND_WORLD } from './cosmosForetold';

/**
 * Foretold: the Silmarils are recovered. After the Last Battle the round world cracks along
 * glowing seams, its great pieces part over the fire inside it and come back together, made
 * again, greener and brighter. Then the three jewels come home: one rises out of the sea where
 * Maglor cast it, one out of the fire under the earth where Maedhros fell, and the third comes
 * down from the sky, where Eärendil gives up the light he has carried on Vingilot so long.
 *
 * Shown in the dream register of what is foretold (cosmosForetold.ts). Everything is a pure
 * function of `t`; `ambient` only drives twinkle, embers and shimmer.
 */

// Timeline (normalised event time), tuned against the passages in staging.yaml.
const T = {
  crack: [0.02, 0.07], part: [0.05, 0.12], close: [0.14, 0.21], cool: [0.19, 0.34], renew: [0.17, 0.32],
  ripple: [0.24, 0.36], sea: [0.26, 0.37],
  rift: [0.35, 0.42, 0.56], fire: [0.39, 0.5],
  ship: [0.6, 0.73], give: [0.73, 0.8], away: [0.8, 0.95],
  gather: [0.8, 0.93],
} as const;

const CAM_D = 13.5;
const R = 2.1;
const CENTRE = new THREE.Vector3(0, 0.3, 0);
const PART = 0.75;

export function createJewelsStage(labels: CosmosLabels): Stage {
  const globe = new Globe(ROUND_WORLD, R, 22, 11, 9);
  globe.group.position.copy(CENTRE);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.86, 2), new THREE.MeshBasicMaterial({ color: '#ff8a3a' }));
  core.position.copy(CENTRE);

  // Where the two lost jewels lie: the sea over drowned Beleriand, and a fire in the earth east of it.
  const v3 = new THREE.Vector3();
  const seaDir = globeDir(at(-0.8, 1.6, 0, v3).x, v3.z, new THREE.Vector3());
  const fireDir = globeDir(at(0.55, 2.0, 0, v3).x, v3.z, new THREE.Vector3());
  const SEA = CENTRE.clone().addScaledVector(seaDir, R);
  const FIRE = CENTRE.clone().addScaledVector(fireDir, R * 1.02);
  const face = seaDir.clone().add(fireDir).normalize();
  const upish = new THREE.Vector3(0, 1, 0).projectOnPlane(face).normalize();
  const side = new THREE.Vector3().crossVectors(upish, face).normalize();
  // Their places together at the end: a triangle over the world, towards the viewer.
  const home = (i: number, turn: number, out: THREE.Vector3) => {
    const a = turn + (i / 3) * Math.PI * 2 + Math.PI / 2;
    return out.copy(CENTRE).addScaledVector(face, 0.9).addScaledVector(upish, R + 1.45 + Math.sin(a) * 0.62).addScaledVector(side, Math.cos(a) * 0.72);
  };
  const SEA_UP = SEA.clone().addScaledVector(seaDir, 0.7).addScaledVector(upish, 1.1);
  const FIRE_UP = FIRE.clone().addScaledVector(fireDir, 0.7).addScaledVector(upish, 1.2);
  const SKY = CENTRE.clone().addScaledVector(face, 3.5).addScaledVector(upish, 7.5).addScaledVector(side, -3.5);
  const GIVE = CENTRE.clone().addScaledVector(face, 1.2).addScaledVector(upish, R + 2.3).addScaledVector(side, 0.9);

  const ship = new THREE.Mesh(shipGeo('#f4f1ea', '#ffffff'), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true }));

  // The sea's rings where the first jewel surfaces.
  const ringGeo = new THREE.RingGeometry(0.9, 1, 48);
  const rings = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#dff2ff', transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(SEA).addScaledVector(seaDir, 0.01);
    m.lookAt(v3.copy(SEA).add(seaDir));
    return m;
  });

  // Drops off the sea jewel, embers off the fire jewel, the ship's wake, sparks of the seams.
  const DROPS = 120, EMBERS = 160, WAKE = 140, SEAM = 220;
  const nP = DROPS + EMBERS + WAKE + SEAM;
  const pPos = new Float32Array(nP * 3), pCol = new Float32Array(nP * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const seamFaces = Array.from({ length: globe.nf }, (_, f) => f).filter((f) => globe.crack[f] > 0.5);

  const airMat = shellMaterial('#9fd8ff');
  const air = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 48, 32), airMat);
  air.position.copy(CENTRE);
  const key = new THREE.DirectionalLight('#f3eefe', 0);

  let glows!: Glows;
  const world = createCosmosWorld(labels, (scene, tex) => {
    scene.add(core, globe.group, ship, ...rings, air, key, key.target);
    glows = new Glows(tex, scene);
    const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.08, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.renderOrder = 4;
    scene.add(pts);
  });
  const { scene, camera, target, hemi, sun, tex, shells, starMat } = world;
  const dream = dreamWorld(world, 10);
  farStars(world);
  const coreGlow = glows.make('#ff9a4a'), riftGlow = glows.make('#ff7a2a'), seaGlow = glows.make('#bfe6ff');
  const shipGlow = glows.make('#eef4ff'), shipHalo = glows.make('#cfe0ff'), together = glows.make('#fff1d0');
  const jewels = [new Jewel(scene, glows), new Jewel(scene, glows), new Jewel(scene, glows)];

  target.copy(CENTRE).addScaledVector(upish, 0.75);
  camera.position.copy(target).addScaledVector(face, CAM_D * Math.cos(0.32)).addScaledVector(upish, CAM_D * Math.sin(0.32)).addScaledVector(side, -2.5);
  key.position.copy(CENTRE).addScaledVector(face, 6).addScaledVector(upish, 5).addScaledVector(side, -4);
  key.target.position.copy(CENTRE);
  sun.intensity = 0;
  hemi.groundColor.set('#1a1a30');

  const earendilLabel = nameLabel(world, 'Eärendil');
  const vingilotLabel = nameLabel(world, 'Vingilot', '');

  const c = new THREE.Color(), v4 = new THREE.Vector3(), p = new THREE.Vector3(), prow = new THREE.Vector3();
  const pos0 = new THREE.Vector3(), pos1 = new THREE.Vector3(), pos2 = new THREE.Vector3(), ps = [pos0, pos1, pos2];
  const TOGETHER = CENTRE.clone().addScaledVector(face, 0.9).addScaledVector(upish, R + 1.45);
  const GIVEN = GIVE.clone().addScaledVector(upish, -0.5);
  const hot = new THREE.Color('#ff6a1e'), goldSeam = new THREE.Color('#ffd27a'), white = new THREE.Color('#f4f8ff');
  const sea = new THREE.Color('#cfeaff'), ember = new THREE.Color('#ff8a3a'), fresh = new THREE.Color('#7fd05a');

  /** Vingilot's path: down out of the sky to where the jewel is given, then away. */
  const shipAt = (t: number, out: THREE.Vector3) => {
    const s = ramp(t, T.ship[0], T.ship[1]);
    out.lerpVectors(SKY, GIVE, s);
    out.addScaledVector(side, Math.sin(s * Math.PI) * 1.4);
    const a = ramp(t, T.away[0], T.away[1]);
    return out.lerp(SKY, a * a);
  };

  return {
    scene, camera, target,

    update(t, ambient) {
      // --- the Earth broken and made again ---
      const crack = ramp(t, T.crack[0], T.crack[1]) * (1 - ramp(t, T.cool[0], T.cool[1]));
      const part = PART * ramp(t, T.part[0], T.part[1]) * (1 - ramp(t, T.close[0], T.close[1]));
      const renew = ramp(t, T.renew[0], T.renew[1]);
      const goldLeft = 0.25 * pulse(t, T.cool[0], T.cool[1], 0.5);
      const riftK = pulse(t, T.rift[0], T.rift[1], T.rift[2]);
      globe.update(part, (f, col, glow) => {
        pale(col, 0.22 - 0.1 * renew);
        if (!globe.water[f]) col.lerp(fresh, 0.18 * renew);
        col.multiplyScalar(0.7 + 0.3 * renew);
        const k = globe.crack[f];
        if (k > 0) glow.copy(hot).multiplyScalar(k * crack * 0.9).add(c.copy(goldSeam).multiplyScalar(k * goldLeft));
        if (riftK > 0) {
          const d = globe.dir;
          const dot = d[f * 3] * fireDir.x + d[f * 3 + 1] * fireDir.y + d[f * 3 + 2] * fireDir.z;
          const near = clamp01((dot - 0.985) / 0.013);
          if (near > 0) glow.add(c.copy(hot).multiplyScalar(near * riftK * 0.8));
        }
      });
      core.visible = part > 0.002;
      const inner = Math.max(part / PART, 0.4 * crack);
      Glows.set(coreGlow, CENTRE, 7 * (0.6 + 0.4 * inner), 0.55 * inner);

      // --- the jewel from the sea ---
      const rise1 = ramp(t, T.sea[0], T.sea[1]);
      jewels[0].set(pos0.lerpVectors(SEA, SEA_UP, rise1), ramp(t, T.sea[0], T.sea[0] + 0.03), ambient, 1, 0);
      rings.forEach((m, i) => {
        const k = clamp01((t - T.ripple[0] - i * 0.025) / (T.ripple[1] - T.ripple[0] - 0.05));
        m.scale.setScalar(0.05 + k * 0.7);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.6 * Math.sin(k * Math.PI);
        m.visible = k > 0 && k < 1;
      });
      Glows.set(seaGlow, SEA, 1.5, 0.45 * pulse(t, T.ripple[0], T.sea[0] + 0.02, T.sea[1] + 0.05));

      // --- the jewel from the fire under the earth ---
      const rise2 = ramp(t, T.fire[0], T.fire[1]);
      jewels[1].set(pos1.lerpVectors(FIRE, FIRE_UP, rise2), ramp(t, T.fire[0], T.fire[0] + 0.03), ambient, 1, 1);
      Glows.set(riftGlow, FIRE, 1.4, 0.55 * riftK);

      // --- the jewel from the sky: Vingilot comes down, and gives it up ---
      shipAt(t, v4);
      const shipOn = ramp(t, T.ship[0], T.ship[0] + 0.03) * (1 - ramp(t, T.away[1] - 0.05, T.away[1]));
      const give = ramp(t, T.give[0], T.give[1]);
      ship.position.copy(v4);
      shipAt(Math.min(1, t + 0.01), p);
      if (p.distanceToSquared(v4) > 1e-8) ship.lookAt(p);
      ship.scale.setScalar(0.34 * (1 - 0.4 * ramp(t, T.away[0], T.away[1])));
      (ship.material as THREE.MeshBasicMaterial).opacity = shipOn;
      ship.visible = shipOn > 0.01;
      prow.copy(v4).addScaledVector(ship.getWorldDirection(p), 0.2).setY(v4.y + 0.16);
      const carried = 1 - give;
      Glows.set(shipGlow, prow, 0.5, shipOn * (0.3 + 0.4 * carried));
      Glows.set(shipHalo, prow, 1.8, shipOn * 0.2 * carried);
      pos2.lerpVectors(prow, GIVEN, give);
      jewels[2].set(pos2, shipOn > 0.01 || give >= 1 ? ramp(t, T.ship[0], T.ship[0] + 0.04) : 0, ambient, 0.6 + 0.4 * give, 2);

      // --- the three together, over the world made again ---
      const g = ramp(t, T.gather[0], T.gather[1]);
      if (g > 0) {
        const turn = 0.6 * (t - T.gather[0]);
        jewels.forEach((j, i) => j.set(ps[i].lerp(home(i, turn, p), g), 1, ambient, 1 + 0.15 * g, i));
      }
      Glows.set(together, TOGETHER, 5, 0.25 * ramp(t, T.gather[1] - 0.05, 1));

      // --- particles ---
      let i = 0;
      for (let d = 0; d < DROPS; d++, i++) {
        const h1 = hash(d, 1, 61), h2 = hash(d, 2, 61);
        const life = (ambient * 0.5 + h1) % 1;
        p.copy(pos0).addScaledVector(seaDir, -life * 0.9 * rise1).addScaledVector(side, (h2 - 0.5) * 0.2);
        p.toArray(pPos, i * 3);
        const b = pulse(t, T.sea[0], T.sea[0] + 0.04, T.sea[1] + 0.06) * (1 - life) * 0.7;
        pCol.set([sea.r * b, sea.g * b, sea.b * b], i * 3);
      }
      for (let e = 0; e < EMBERS; e++, i++) {
        const h1 = hash(e, 1, 62), h2 = hash(e, 2, 62), h3 = hash(e, 3, 62);
        const life = (ambient * (0.3 + 0.3 * h3) + h1) % 1;
        p.copy(FIRE).addScaledVector(fireDir, life * (0.4 + 1.2 * rise2)).addScaledVector(side, (h2 - 0.5) * 0.35 * (1 - life * 0.5)).addScaledVector(upish, (h3 - 0.5) * 0.3);
        p.toArray(pPos, i * 3);
        const b = riftK * Math.sin(life * Math.PI) * 0.8;
        pCol.set([ember.r * b, ember.g * b, ember.b * b], i * 3);
      }
      fillTrail(pPos, pCol, i, WAKE, t, 0.06, (s, out) => shipAt(s, out), white, shipOn * 0.6 * (t < T.give[0] ? 1 : 0.4), ambient, 0.15, 63);
      i += WAKE;
      for (let s = 0; s < SEAM; s++, i++) {
        const f = seamFaces[Math.floor(hash(s, 1, 64) * seamFaces.length)];
        const d = globe.dir, h2 = hash(s, 2, 64);
        const life = (ambient * 0.35 + h2) % 1;
        const piece = globe.pieceDir(globe.piece[f]);
        p.set(d[f * 3], d[f * 3 + 1], d[f * 3 + 2]).multiplyScalar(R * (1.01 + life * 0.25)).add(CENTRE).addScaledVector(piece, part);
        p.toArray(pPos, i * 3);
        const b = crack * Math.sin(life * Math.PI) * 0.8;
        pCol.set([hot.r * b, hot.g * b, hot.b * b], i * 3);
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      pGeo.computeBoundingSphere();

      // --- names ---
      earendilLabel.position.copy(v4).setY(v4.y + 0.75);
      showLabel(earendilLabel, ramp(t, T.ship[0] + 0.03, T.ship[0] + 0.07) * (1 - ramp(t, T.away[0], T.away[0] + 0.04)));
      vingilotLabel.position.copy(v4).setY(v4.y - 0.45);
      showLabel(vingilotLabel, ramp(t, T.ship[0] + 0.05, T.ship[0] + 0.09) * (1 - ramp(t, T.give[0], T.give[0] + 0.04)));

      // --- light: dim after the battle, then the soft light of the world made new ---
      const light = 0.55 + 0.45 * renew + 0.15 * g;
      hemi.color.set('#9aa2d6').lerp(c.set('#efe9ff'), renew);
      hemi.intensity = 0.4 + 0.45 * light;
      key.intensity = 0.9 * light;
      starMat.opacity = 0.6 * (0.85 + 0.15 * Math.sin(ambient * 2));
      shells.forEach((sh, si) => {
        sh.mat.uniforms.uOpacity.value = si < 2 ? 0 : sh.strength * 0.55;
        sh.mesh.visible = si >= 2;
      });
      airMat.uniforms.uOpacity.value = (0.18 + 0.22 * renew) * (1 - 0.8 * part / PART);
      dream.update(ambient);
      glows.face(camera);
    },

    flash(t) {
      return 0.15 * pulse(t, T.crack[0] + 0.01, T.crack[0] + 0.015, T.crack[0] + 0.05);
    },

    resize(w, h) { fitCamera(camera, target, w, h, CAM_D, 5); },

    dispose() {
      for (const l of world.labels) l.element.remove();
      disposeTree(scene);
      tex.dispose();
    },
  };
}
