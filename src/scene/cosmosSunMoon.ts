import * as THREE from 'three';
import type { Stage } from './stage';
import { clamp01, disposeTree, hash, pulse, ramp } from './util';
import { createCosmosWorld, fitCamera, Glows, nameLabel, showLabel, type CosmosLabels } from './cosmosWorld';
import {
  at, buildTree, E, EZELLOHAR, fillDrops, FIRST_AGE, Forest, heightsFor, HILDORIEN, landColor, meCoast, N, S, Slab, toU, toV,
  amanCoast, type TreeParts,
} from './cosmosLands';

/**
 * The first Moon and Sun: Valinor dark around the poisoned Trees, Yavanna singing and Nienna
 * weeping over them; the last silver flower of Telperion and the last golden fruit of
 * Laurelin; the vessels that hold them and the paths Varda gives them across the sky; the
 * Moon rising first over a Middle-earth that had known only stars, then the Sun, whose
 * first light falls on Fingolfin's host in the north-west and wakes Men in the far east.
 *
 * Everything is a pure function of `t`; `ambient` only drives twinkle, drops and shimmer.
 */

// Timeline (normalised event time), tuned against the passages in staging.yaml.
const T = {
  grief: [0, 0.17], griefFade: [0.14, 0.2],
  flower: [0.2, 0.27], fruit: [0.24, 0.31],
  lift: [0.34, 0.43], vessel: [0.36, 0.42], paths: [0.4, 0.51],
  moon: [0.54, 1.0], moonlight: [0.55, 0.64],
  sun: [0.72, 1.0], sunlight: [0.725, 0.84],
  host: 0.745, men: [0.8, 0.86],
} as const;

const TREE_S = 0.95;
const CAM_D = 19;
/** How far along its path each vessel has sailed by the end. */
const MOON_END = 0.86, SUN_END = 0.48;

/** A point on a vessel's path across the sky: rising from Valinor, setting in the east. */
function pathAt(p: number, side: number, out: THREE.Vector3): THREE.Vector3 {
  const a = Math.PI * p;
  return at(-3.3 * Math.cos(a), side, 1.5 + 3.1 * Math.sin(a), out);
}

export function createSunMoonStage(labels: CosmosLabels): Stage {
  const slab = new Slab(26, 104, 7);
  const raw = heightsFor(slab.gx, slab.gz, FIRST_AGE);
  for (let k = 0; k < slab.nv; k++) slab.gy[k] = Math.max(0, raw[k]);
  const fu = Array.from(slab.fx, (x, f) => toU(x, slab.fz[f])), fv = Array.from(slab.fx, (x, f) => toV(x, slab.fz[f]));
  const faceRaw = Array.from(fu, (_u, f) => (raw[slab.tris[f * 3]] + raw[slab.tris[f * 3 + 1]] + raw[slab.tris[f * 3 + 2]]) / 3);
  const inMiddleEarth = fu.map((u, f) => u > meCoast(fv[f]) - 0.1);

  const forest = new Forest(190, (u, v) => (u > meCoast(v) + 0.15 ? 0.3 : u < amanCoast(v) - 0.6 ? 0.04 : 0), 63);
  const forestY = forest.at.map((p) => Math.max(0, heightsFor(Float32Array.of(p.x), Float32Array.of(p.z), FIRST_AGE)[0]));

  // ---------- Ezellohar and the dying Trees ----------
  const moundAt = at(EZELLOHAR.u, EZELLOHAR.v, 0.06);
  const moundGeo = new THREE.CylinderGeometry(0.14, 0.42, 0.15, 9);
  moundGeo.translate(0, 0.075, 0);
  const mound = new THREE.Mesh(moundGeo, new THREE.MeshStandardMaterial({ color: '#4f7a45', flatShading: true, roughness: 0.85 }));
  mound.position.copy(moundAt);
  const side = new THREE.Vector3().copy(N).multiplyScalar(0.17);
  const telAt = moundAt.clone().add(side).setY(moundAt.y + 0.14);
  const lauAt = moundAt.clone().sub(side).setY(moundAt.y + 0.14);
  const dead = (p: TreeParts, at: THREE.Vector3) => {
    p.bark.color.set('#4a423c');
    p.leaves.vertexColors = false;
    p.leaves.color.set('#3a3d3a');
    p.group.position.copy(at);
    p.group.scale.setScalar(TREE_S);
    return p;
  };
  const tel = dead(buildTree('telperion'), telAt), lau = dead(buildTree('laurelin'), lauAt);
  tel.group.rotation.y = 0.5; lau.group.rotation.y = 2.1;
  const telTop = telAt.clone().setY(telAt.y + 1.12 * TREE_S), lauTop = lauAt.clone().setY(lauAt.y + 0.5 * TREE_S);
  lauTop.addScaledVector(E, 0.12);

  // The flower and the fruit, and the vessels Aulë makes for them.
  const flowerGeo = new THREE.OctahedronGeometry(0.07, 0);
  flowerGeo.scale(1, 0.55, 1);
  const flowerMat = new THREE.MeshBasicMaterial({ color: '#eef4ff' });
  const flower = new THREE.Mesh(flowerGeo, flowerMat);
  const fruitMat = new THREE.MeshBasicMaterial({ color: '#ffc44a' });
  const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), fruitMat);
  const vesselGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.24, 0));
  const moonVesselMat = new THREE.LineBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const sunVesselMat = new THREE.LineBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const moonVessel = new THREE.LineSegments(vesselGeo, moonVesselMat);
  const sunVessel = new THREE.LineSegments(vesselGeo, sunVesselMat);

  // Varda's paths across the sky: dotted arcs, drawn out from the West.
  const PATH = 140;
  const pathPos = new Float32Array(PATH * 2 * 3), pathCol = new Float32Array(PATH * 2 * 3);
  const v3 = new THREE.Vector3();
  for (let i = 0; i < PATH; i++) {
    pathAt(i / (PATH - 1), 0.55, v3).toArray(pathPos, i * 3);
    pathAt(i / (PATH - 1), -0.55, v3).toArray(pathPos, (PATH + i) * 3);
  }
  const pathGeo = new THREE.BufferGeometry();
  pathGeo.setAttribute('position', new THREE.BufferAttribute(pathPos, 3));
  pathGeo.setAttribute('color', new THREE.BufferAttribute(pathCol, 3));
  const moonPathCol = new THREE.Color('#9fb8f0'), sunPathCol = new THREE.Color('#f0b860');

  // Grief over the Trees: Yavanna's song (green motes) and Nienna's tears.
  const MOTES = 120, TEARS = 100, DROPS = 90;
  const nP = MOTES + TEARS + DROPS * 2;
  const pPos = new Float32Array(nP * 3), pCol = new Float32Array(nP * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));

  // Fingolfin's host coming off the ice, and the first Men waking in the east.
  const HOST = 46, MEN = 14;
  const hostPos = new Float32Array((HOST + MEN) * 3), hostCol = new Float32Array((HOST + MEN) * 3);
  for (let i = 0; i < HOST; i++) {
    const k = i / HOST;
    // A long column marching south-east from the Grinding Ice.
    at(-1.32 + k * 0.62 + (hash(i, 1, 81) - 0.5) * 0.06, 2.95 - k * 0.42 + (hash(i, 2, 81) - 0.5) * 0.06, 0, v3);
    v3.y = Math.max(0, heightsFor(Float32Array.of(v3.x), Float32Array.of(v3.z), FIRST_AGE)[0]) + 0.05;
    v3.toArray(hostPos, i * 3);
  }
  for (let i = 0; i < MEN; i++) {
    const a = hash(i, 1, 82) * Math.PI * 2, r = 0.05 + hash(i, 2, 82) * 0.18;
    at(HILDORIEN.u + Math.cos(a) * r, HILDORIEN.v + Math.sin(a) * r, 0, v3);
    v3.y = Math.max(0, heightsFor(Float32Array.of(v3.x), Float32Array.of(v3.z), FIRST_AGE)[0]) + 0.05;
    v3.toArray(hostPos, (HOST + i) * 3);
  }
  const hostGeo = new THREE.BufferGeometry();
  hostGeo.setAttribute('position', new THREE.BufferAttribute(hostPos, 3));
  hostGeo.setAttribute('color', new THREE.BufferAttribute(hostCol, 3));

  const moonLight = new THREE.DirectionalLight('#bcd0ff', 0);
  let glows!: Glows;
  const world = createCosmosWorld(labels, (scene, tex) => {
    scene.add(slab.top, slab.glow, slab.under, forest.mesh, mound, tel.group, lau.group, flower, fruit, moonVessel, sunVessel, moonLight, moonLight.target);
    const pm = (size: number, geo: THREE.BufferGeometry) => new THREE.Points(geo, new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(pm(0.13, pathGeo), pm(0.07, pGeo), pm(0.11, hostGeo));
    glows = new Glows(tex, scene);
  });
  const { scene, camera, target, hemi, sun, tex, shells, starMat } = world;
  scene.add(sun.target);
  const flowerGlow = glows.make('#e4eeff'), fruitGlow = glows.make('#ffc860');
  const moonGlow = glows.make('#dce8ff'), moonHalo = glows.make('#8fa8e0');
  const sunGlow = glows.make('#fff0c0'), sunHalo = glows.make('#ffb048');
  const yavanna = glows.make('#b8f07a'), hostGlow = glows.make('#cfe0ff'), menGlow = glows.make('#ffd9a0');
  const valinorGlow = glows.make('#ffe2a8');

  target.set(0, 1.1, 0);
  const view = new THREE.Vector3().copy(S).addScaledVector(E, 0.18).normalize();
  camera.position.copy(target).addScaledVector(view, CAM_D * Math.cos(0.42)).setY(target.y + CAM_D * Math.sin(0.42));
  hemi.groundColor.set('#141a26');

  const telLabel = nameLabel(world, 'Telperion', ''), lauLabel = nameLabel(world, 'Laurelin', '');
  telLabel.position.copy(telAt).addScaledVector(N, 0.5).setY(1.9);
  lauLabel.position.copy(lauAt).addScaledVector(S, 0.5).setY(1.9);
  const tilionLabel = nameLabel(world, 'Tilion', ''), arienLabel = nameLabel(world, 'Arien', '');
  const moonLabel = nameLabel(world, labels.moon), sunLabel = nameLabel(world, labels.sun);
  const hostLabel = nameLabel(world, 'Fingolfin', ''), menLabel = nameLabel(world, 'Hildórien', '');
  hostLabel.position.copy(at(-1.0, 2.75, 0.75));
  menLabel.position.copy(at(HILDORIEN.u, HILDORIEN.v - 0.35, 0.55));

  const c = new THREE.Color(), dayHemi = new THREE.Color('#fff1da'), nightHemi = new THREE.Color('#7d8cb8'), moonHemi = new THREE.Color('#aebde6');
  const seaNight = new THREE.Color('#1d3a52');
  const moonPos = new THREE.Vector3(), sunPos = new THREE.Vector3(), tmp = new THREE.Vector3();
  const vistaColor = (shells[0].mat.uniforms.uColor.value as THREE.Color).clone();

  return {
    scene, camera, target,

    update(t, ambient) {
      // --- light over the world: stars, then the Moon, then the Sun ---
      const moonUp = ramp(t, T.moonlight[0], T.moonlight[1]);
      const day = ramp(t, T.sunlight[0], T.sunlight[1]);
      const night = 1 - day;
      const lightLevel = 0.26 + 0.3 * moonUp * night + 0.7 * day;

      slab.update((f, water, _y, col) => {
        landColor(fu[f], fv[f], faceRaw[f], slab.seed[f], col);
        if (water) col.lerp(seaNight, 0.45 * night);
        // Middle-earth, before the Moon, has known only starlight.
        if (inMiddleEarth[f]) col.multiplyScalar(0.78 + 0.22 * Math.max(moonUp, day));
        return true;
      });
      forest.update((i) => forestY[i], (i) => (forestY[i] > 0.03 ? 1 : 0));

      // --- the vessels: their places on their paths ---
      const pm = MOON_END * clamp01((t - T.moon[0]) / (T.moon[1] - T.moon[0]));
      const ps = SUN_END * clamp01((t - T.sun[0]) / (T.sun[1] - T.sun[0]));
      const lift = ramp(t, T.lift[0], T.lift[1]);
      pathAt(pm, 0.55, moonPos);
      if (t < T.moon[0]) moonPos.lerpVectors(telTop, pathAt(0, 0.55, tmp), lift);
      pathAt(ps, -0.55, sunPos);
      if (t < T.sun[0]) sunPos.lerpVectors(lauTop, pathAt(0, -0.55, tmp), lift);

      // --- grief, then the last flower and fruit ---
      const grief = ramp(t, 0, 0.04) * (1 - ramp(t, T.griefFade[0], T.griefFade[1]));
      const fl = ramp(t, T.flower[0], T.flower[1]), fr = ramp(t, T.fruit[0], T.fruit[1]);
      const flicker = 0.93 + 0.07 * Math.sin(ambient * 2.1);
      flower.position.copy(moonPos); flower.scale.setScalar(Math.max(0.001, fl * (1 + 0.6 * lift)));
      flower.visible = fl > 0;
      flowerMat.color.set('#8a94a8').lerp(c.set('#f4f8ff'), fl);
      fruit.position.copy(sunPos); fruit.scale.setScalar(Math.max(0.001, fr * (1 + 0.6 * lift)));
      fruit.visible = fr > 0;
      fruitMat.color.set('#7a6030').lerp(c.set('#ffd060'), fr);

      const vessel = ramp(t, T.vessel[0], T.vessel[1]);
      moonVessel.position.copy(moonPos); sunVessel.position.copy(sunPos);
      moonVessel.rotation.set(0.3, ambient * 0.25, 0.2);
      sunVessel.rotation.set(-0.2, -ambient * 0.2, 0.3);
      moonVesselMat.opacity = vessel * 0.85 * (1 - 0.5 * moonUp);
      sunVesselMat.opacity = vessel * 0.85 * (1 - 0.5 * day);
      moonVessel.visible = vessel > 0; sunVessel.visible = vessel > 0;

      const moonK = Math.max(fl * 0.55, moonUp);
      Glows.set(flowerGlow, moonPos, 0.5 + 0.4 * fl, fl * 0.75 * flicker);
      Glows.set(fruitGlow, sunPos, 0.5 + 0.4 * fr, fr * 0.75 * flicker);
      Glows.set(moonGlow, moonPos, 0.7 + 0.5 * moonUp, moonUp * 0.85 * flicker);
      Glows.set(moonHalo, moonPos, 2.6 + 1.2 * moonUp, moonK * 0.28 * (1 - 0.5 * day));
      Glows.set(sunGlow, sunPos, 1.0 + 1.0 * day, day * flicker);
      Glows.set(sunHalo, sunPos, 3.5 + 4 * day, (fr * 0.25 + day * 0.55) * flicker);
      Glows.set(valinorGlow, v3.copy(moundAt).setY(0.6), 2.2, 0.18 * (fl + fr) * (1 - lift));
      Glows.set(yavanna, v3.copy(moundAt).setY(moundAt.y + 0.3), 0.8, grief * 0.6);

      // --- the paths, drawn out from the West ---
      const drawn = ramp(t, T.paths[0], T.paths[1]);
      const pathsOn = drawn * (1 - 0.6 * day);
      for (let i = 0; i < PATH; i++) {
        const k = i / (PATH - 1);
        const b = clamp01((drawn * 1.15 - k) * 8) * pathsOn * (0.7 + 0.3 * Math.sin(k * 80 - ambient * 2));
        pathCol.set([moonPathCol.r * b, moonPathCol.g * b, moonPathCol.b * b], i * 3);
        pathCol.set([sunPathCol.r * b, sunPathCol.g * b, sunPathCol.b * b], (PATH + i) * 3);
      }
      pathGeo.attributes.color.needsUpdate = true;

      // --- Yavanna's song and Nienna's tears over the Trees, then the drops of their last light ---
      let i = 0;
      for (let m = 0; m < MOTES; m++, i++) {
        const h1 = hash(m, 1, 5), h2 = hash(m, 2, 5);
        const life = (ambient * 0.1 + h1) % 1;
        const ang = h2 * Math.PI * 2 + life * 5, rr = 0.08 + life * 0.45;
        pPos.set([moundAt.x + Math.cos(ang) * rr, moundAt.y + 0.2 + life * 1.2, moundAt.z + Math.sin(ang) * rr], i * 3);
        const b = grief * Math.sin(life * Math.PI) * 0.7;
        pCol.set([0.75 * b, 0.95 * b, 0.5 * b], i * 3);
      }
      for (let m = 0; m < TEARS; m++, i++) {
        const h1 = hash(m, 1, 6), h2 = hash(m, 2, 6), h3 = hash(m, 3, 6);
        const life = (ambient * (0.22 + 0.1 * h3) + h1) % 1;
        const ang = h2 * Math.PI * 2, rr = 0.06 + Math.sqrt(h3) * 0.3;
        pPos.set([moundAt.x + Math.cos(ang) * rr, moundAt.y + 0.2 + 1.7 * (1 - life), moundAt.z + Math.sin(ang) * rr], i * 3);
        const b = grief * (0.3 + 0.7 * life) * 0.6;
        pCol.set([0.62 * b, 0.82 * b, 1.0 * b], i * 3);
      }
      fillDrops(pPos, pCol, i, DROPS, telAt, TREE_S, ambient, tel.color, fl * (1 - lift) * 0.8, 8);
      fillDrops(pPos, pCol, i + DROPS, DROPS, lauAt, TREE_S, ambient, lau.color, fr * (1 - lift) * 0.8, 9);
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      pGeo.computeBoundingSphere();

      // --- the first sunrise falls on Fingolfin's banners; Men wake in the east ---
      const hostOn = ramp(t, 0.6, 0.66);
      const struck = pulse(t, T.host - 0.005, T.host + 0.02, T.host + 0.12);
      for (let h = 0; h < HOST; h++) {
        const glint = 0.55 + 0.45 * Math.sin(ambient * 3 + h * 1.7);
        const b = hostOn * (0.25 + 0.35 * day + 0.9 * struck) * glint;
        const silver = h % 3 === 0;
        hostCol.set(silver ? [0.9 * b, 0.94 * b, 1.0 * b] : [0.35 * b, 0.55 * b, 1.0 * b], h * 3);
      }
      const men = ramp(t, T.men[0], T.men[1]);
      for (let m = 0; m < MEN; m++) {
        const b = clamp01(men * 1.4 - hash(m, 3, 82) * 0.4) * (0.75 + 0.25 * Math.sin(ambient * 1.3 + m));
        hostCol.set([1.0 * b, 0.82 * b, 0.55 * b], (HOST + m) * 3);
      }
      hostGeo.attributes.color.needsUpdate = true;
      Glows.set(hostGlow, at(-1.0, 2.72, 0.25, v3), 1.4, struck * 0.6);
      Glows.set(menGlow, at(HILDORIEN.u, HILDORIEN.v, 0.2, v3), 1.1, men * 0.4 * (1 - ramp(t, 0.95, 1)));

      // --- names ---
      showLabel(telLabel, ramp(t, 0.03, 0.07) * (1 - ramp(t, 0.33, 0.37)));
      showLabel(lauLabel, ramp(t, 0.03, 0.07) * (1 - ramp(t, 0.33, 0.37)));
      // The two vessels start close together: Tilion's name above his, Arien's below hers.
      tilionLabel.position.copy(moonPos).addScaledVector(N, 0.25).setY(moonPos.y + 0.6);
      arienLabel.position.copy(sunPos).addScaledVector(S, 0.25).setY(sunPos.y - 0.5);
      showLabel(tilionLabel, ramp(t, 0.41, 0.45) * (1 - ramp(t, 0.53, 0.56)));
      showLabel(arienLabel, ramp(t, 0.43, 0.47) * (1 - ramp(t, 0.53, 0.56)));
      moonLabel.position.copy(moonPos).setY(moonPos.y + 0.75);
      // Beside the Sun, towards the middle of the stage (above it, it sat under the event card).
      sunLabel.position.copy(sunPos).addScaledVector(E, 2.5).setY(sunPos.y + 0.2);
      showLabel(moonLabel, ramp(t, 0.58, 0.62) * (1 - ramp(t, 0.86, 0.9)));
      showLabel(sunLabel, ramp(t, 0.76, 0.8));
      showLabel(hostLabel, ramp(t, T.host, T.host + 0.03) * (1 - ramp(t, 0.9, 0.93)));
      showLabel(menLabel, ramp(t, T.men[0] + 0.01, T.men[1]) * (1 - ramp(t, 0.95, 0.98)));

      // --- lights and sky ---
      moonLight.position.copy(moonPos);
      moonLight.target.position.set(0, 0, 0);
      moonLight.intensity = 0.55 * moonUp * (1 - 0.6 * day);
      sun.position.copy(sunPos);
      sun.target.position.set(0, 0, 0);
      sun.color.set('#ffe2b0').lerp(c.set('#fff4e4'), ramp(t, 0.8, 1));
      sun.intensity = 1.7 * day;
      hemi.intensity = lightLevel;
      hemi.color.copy(nightHemi).lerp(moonHemi, moonUp).lerp(dayHemi, day);
      starMat.opacity = (0.8 - 0.6 * day) * (0.85 + 0.15 * Math.sin(ambient * 2));
      (shells[0].mat.uniforms.uColor.value as THREE.Color).copy(vistaColor).lerp(c.set('#ffd8a0'), day * 0.6);
      shells.forEach((sh, si) => {
        sh.mat.uniforms.uOpacity.value = sh.strength * (0.7 + (si === 0 ? 0.5 * day : 0));
        sh.mesh.visible = true;
      });
      glows.face(camera);
    },

    flash(t) {
      return 0.12 * pulse(t, T.sunlight[0] - 0.004, T.sunlight[0] + 0.004, T.sunlight[0] + 0.04);
    },

    resize(w, h) { fitCamera(camera, target, w, h, CAM_D, 5.2); },

    dispose() {
      for (const l of world.labels) l.element.remove();
      disposeTree(scene);
      tex.dispose();
    },
  };
}
