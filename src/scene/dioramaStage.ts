import * as THREE from 'three';
import type { Character, EventDetail, Faction, Lang } from '../data/types';
import { createArmies } from './armies';
import { t as ui, tr, type UiKey } from '../i18n';
import { onTile, samplePose } from '../timeline';
import { createDiorama, groundHeight } from './diorama';
import { createFigure, setSelected } from './figure';
import type { Stage } from './stage';
import { disposeTree } from './util';

/** An event staged on an isometric low-poly diorama tile with animated characters. */
export function createDioramaStage(event: EventDetail, characters: Map<string, Character>, lang: Lang, factions = new Map<string, Faction>()): Stage {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1e26');

  // True isometric: orthographic camera on the (1, 1, 1) diagonal.
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  camera.position.set(20, 20, 20);
  camera.zoom = 1.1;
  const target = new THREE.Vector3(0, 0, 0);

  scene.add(new THREE.HemisphereLight('#fff4e0', '#3a3040', 1.1));
  const sun = new THREE.DirectionalLight('#fff0d0', 2.2);
  sun.position.set(8, 14, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  scene.add(sun);

  const seed = [...event.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 97;
  const diorama = createDiorama({ seed });
  scene.add(diorama);

  // A battle's armies: blocks of small figures in their factions' colours (named characters keep their tracks).
  const armies = event.armies?.length ? createArmies(event.armies, factions, diorama, seed) : undefined;
  if (armies) scene.add(armies.group);

  const figures = new Map<string, THREE.Group>();
  for (const track of event.tracks) {
    const ch = characters.get(track.characterId);
    if (!ch) continue;
    const fig = createFigure(ch);
    figures.set(ch.id, fig);
    scene.add(fig);
  }

  return {
    scene, camera, target,

    update(t, ambient) {
      armies?.update(t, ambient);
      for (const track of event.tracks) {
        const fig = figures.get(track.characterId);
        if (!fig) continue;
        const pose = samplePose(track, t);
        fig.visible = onTile(pose);
        const bob = pose.moving ? Math.abs(Math.sin(ambient * (pose.action === 'run' ? 14 : 8))) * 0.05 : 0;
        fig.position.set(pose.x, groundHeight(diorama, pose.x, pose.z) + bob, pose.z);
        if (pose.moving) fig.rotation.y = pose.heading;
        fig.scale.y = pose.action === 'hide' ? 0.75 : 1;
      }
    },

    pick(ray) {
      const hit = ray.intersectObjects([...figures.values()], true)[0];
      let o: THREE.Object3D | null = hit?.object ?? null;
      while (o && !o.userData.characterId) o = o.parent;
      return (o?.userData.characterId as string | undefined) ?? null;
    },

    select(id) {
      for (const [cid, fig] of figures) setSelected(fig, cid === id);
    },

    info(id, t) {
      const ch = characters.get(id);
      const track = event.tracks.find((k) => k.characterId === id);
      if (!ch || !track) return null;
      return {
        title: tr(ch.name, lang),
        subtitle: ui(`kind_${ch.kind}` as UiKey, lang) || ch.kind,
        body: tr(ch.summary, lang),
        thought: tr(samplePose(track, t).thought, lang) || undefined,
      };
    },

    resize(w, h) {
      const aspect = w / h;
      const view = 9;
      Object.assign(camera, { left: -view * aspect, right: view * aspect, top: view, bottom: -view });
      camera.updateProjectionMatrix();
    },

    dispose() {
      disposeTree(scene);
    },
  };
}
