import * as THREE from 'three';
import type { Character, EventDetail, Faction, Lang } from '../data/types';
import { createArmies } from './armies';
import { t as ui, tr, type UiKey } from '../i18n';
import { actionMix, headingAt, onTile, samplePose, strideSeconds } from '../timeline';
import { clipLayers, GAIT_PACE } from './modelClips';
import { createDiorama, groundHeight } from './diorama';
import { lightAt } from './lighting';
import { createFigure, FIGURE_HEIGHT, setSelected, useModel } from './figure';
import type { ModelInstance } from './models';
import type { SetInstance } from './sets';
import type { Stage } from './stage';
import { disposeTree } from './util';

/**
 * How much wider the view gets per share of the viewport the event card covers. Tuned so the
 * whole tile clears the card, right corner uncropped, at 1280×720, 1440×900 and 1920×1080 with
 * the sidebar open or collapsed (the tightest: 1280×720 open, a 560 px wide free space).
 */

/** An event staged on an isometric low-poly diorama tile with animated characters. */
export function createDioramaStage(event: EventDetail, characters: Map<string, Character>, lang: Lang, factions = new Map<string, Faction>()): Stage {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1e26');

  // True isometric: orthographic camera on the (1, 1, 1) diagonal.
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  camera.position.set(20, 20, 20);
  camera.zoom = 1.1;
  const target = new THREE.Vector3(0, 0, 0);

  // The light follows t (staging.yaml `light`; a fixed day without it): set each frame in update.
  const hemi = new THREE.HemisphereLight('#fff4e0', '#3a3040', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d0', 2.2);
  sun.position.set(8, 14, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  scene.add(sun);

  const seed = [...event.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 97;
  // The place: its own set when the event has one (built for it, docs/MODELS.md), else the
  // generic tile. Characters stand on whichever `terrain` the ground group holds.
  const diorama = event.set ? new THREE.Group() : createDiorama({ seed });
  if (event.set) { target.y = 0.9; camera.position.y += 0.9; camera.zoom = 1.0; }
  scene.add(diorama);
  let set: SetInstance | undefined;

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

  // glTF models (docs/MODELS.md): the placeholder stands until a character's model has loaded,
  // and stays if it can't load. The loader is its own chunk, fetched only when a model is used.
  // Keyed by character, and by `<id>#becomes` for a track's second model (the trolls' stone).
  const models = new Map<string, ModelInstance>();
  let disposed = false;
  const wanted = event.tracks
    .flatMap((tr) => [
      { ch: characters.get(tr.characterId), key: tr.characterId, url: tr.model ?? characters.get(tr.characterId)?.model },
      ...tr.becomes ? [{ ch: characters.get(tr.characterId), key: `${tr.characterId}#becomes`, url: tr.becomes.model }] : [],
    ])
    .filter((w): w is { ch: Character; key: string; url: string } => !!w.ch && !!w.url);
  if (event.set) {
    const url = import.meta.env.BASE_URL + event.set;
    void import('./sets').then((S) => S.loadSet(url)).then((inst) => {
      if (disposed) { inst.dispose(); return; }
      set = inst;
      diorama.add(inst.object);
    }).catch((e) => {
      console.warn(`set ${url} did not load; using the generic tile`, e);
      if (!disposed) diorama.add(createDiorama({ seed }));
    });
  }
  if (wanted.length) {
    void import('./models').then((M) => Promise.all(wanted.map(async ({ ch, key, url }) => {
      try {
        const model = await M.loadModel(import.meta.env.BASE_URL + url);
        const fig = figures.get(ch.id);
        if (disposed || !fig || models.has(key)) return;
        const inst = M.instantiate(model, FIGURE_HEIGHT * (ch.scale ?? 1));
        // Both models hang on the figure; update shows whichever t calls for.
        if (key.endsWith('#becomes')) inst.object.visible = false;
        useModel(fig, inst.object);
        models.set(key, inst);
      } catch (e) {
        console.warn(`model for ${ch.id} (${url}) did not load; keeping the placeholder`, e);
      }
    })));
  }

  return {
    scene, camera, target,

    update(t, ambient, eventSeconds = event.durationSeconds) {
      const light = lightAt(event.light, t);
      sun.color.set(light.sun);
      sun.intensity = light.sunIntensity;
      sun.position.set(...light.sunFrom);
      hemi.color.set(light.sky);
      hemi.groundColor.set(light.ground);
      hemi.intensity = light.hemiIntensity;
      (scene.background as THREE.Color).set(light.background);
      armies?.update(t, ambient);
      for (const track of event.tracks) {
        const fig = figures.get(track.characterId);
        if (!fig) continue;
        const pose = samplePose(track, t);
        fig.visible = onTile(pose);
        // From `becomes.t` the character stands as their second model (a troll caught by the dawn).
        const turned = !!track.becomes && t >= track.becomes.t;
        // If the second model didn't load, the first one stays on rather than nothing showing.
        const shown = (turned ? models.get(`${track.characterId}#becomes`) : undefined) ?? models.get(track.characterId);
        if (track.becomes) {
          for (const key of [track.characterId, `${track.characterId}#becomes`]) {
            const m = models.get(key);
            if (m) m.object.visible = m === shown;
          }
        }
        // A model with clips plays them from t (cross-faded at changes, feet paced by the ground
        // covered); without, the placeholder's bob and crouch stand in.
        const model = fig.visible ? shown : undefined;
        let clip: string | undefined;
        if (model) {
          const height = FIGURE_HEIGHT * (characters.get(track.characterId)?.scale ?? 1);
          const strides = strideSeconds(track, t, eventSeconds, (a) => (GAIT_PACE[a] ?? 0) * height);
          clip = model.play(clipLayers(actionMix(track, t, eventSeconds), eventSeconds, t, strides));
        }
        const bob = pose.moving && !clip ? Math.abs(Math.sin(ambient * (pose.action === 'run' ? 14 : 8))) * 0.05 : 0;
        fig.position.set(pose.x, groundHeight(diorama, pose.x, pose.z) + bob, pose.z);
        fig.rotation.y = headingAt(track, t, eventSeconds);
        fig.scale.y = pose.action === 'hide' && clip !== 'hide' ? 0.75 : 1;
      }
      set?.update(light, ambient, [...figures.values()].filter((f) => f.visible).map((f) => f.position));
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

    focus(id) {
      const fig = figures.get(id);
      return fig?.visible ? fig.position.clone().setY(fig.position.y + FIGURE_HEIGHT * 0.5) : null;
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
      Object.assign(camera, { left: -9 * aspect, right: 9 * aspect, top: 9, bottom: -9 });
      camera.updateProjectionMatrix();
    },

    dispose() {
      disposed = true;
      set?.dispose(); // shares geometry with the loader's cache: out before the scene is freed
      // Models share geometry with the loader's cache: take them out so the next visit reuses it.
      for (const m of models.values()) { m.dispose(); m.object.removeFromParent(); }
      disposeTree(scene);
    },
  };
}
