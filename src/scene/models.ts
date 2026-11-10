// glTF character models for the diorama (docs/MODELS.md). Loaded with a dynamic import() from
// dioramaStage.ts only when an event has a model, so GLTFLoader and the meshopt decoder are
// their own chunk and never part of the first download.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { clipFor, clipTime, type Action } from './modelClips';

/** A loaded model, shared by every figure that uses it. */
export interface Model {
  scene: THREE.Object3D;
  clips: THREE.AnimationClip[];
  /** Bounds in the rest pose, for scaling to a character's height. */
  box: THREE.Box3;
}

let loader: GLTFLoader | undefined;
function gltfLoader(): GLTFLoader {
  return (loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder));
}

function toModel(gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }): Model {
  gltf.scene.updateMatrixWorld(true);
  return { scene: gltf.scene, clips: gltf.animations, box: new THREE.Box3().setFromObject(gltf.scene) };
}

/** Parse a .glb already in memory (tests, and anything that fetched it itself). */
export async function parseModel(data: ArrayBuffer): Promise<Model> {
  return toModel(await gltfLoader().parseAsync(data, ''));
}

const cache = new Map<string, Promise<Model>>();

/** Load a model once per URL; every later call shares the same promise. */
export function loadModel(url: string): Promise<Model> {
  let p = cache.get(url);
  if (!p) {
    p = gltfLoader().loadAsync(url).then(toModel);
    p.catch(() => cache.delete(url)); // a failed load may be retried next time the event opens
    cache.set(url, p);
  }
  return p;
}

/** One figure's copy of a model, scaled to its height, posed from t. */
export interface ModelInstance {
  /** Feet on the origin, facing +Z, `height` tall. */
  object: THREE.Object3D;
  /**
   * Pose the model for `action` at event time t: the clip it plays (see `clipFor`) at the frame
   * `clipTime` gives. Returns the clip used, or undefined when the model has no clip for it.
   */
  pose(action: Action, t: number, eventSeconds: number): Action | undefined;
  /** Free this copy's skeletons and stop its mixer (geometry and materials stay shared with the cache). */
  dispose(): void;
}

/** A figure's own copy (skeletons cloned too), scaled so it stands `height` tall. */
export function instantiate(model: Model, height: number): ModelInstance {
  const inner = clone(model.scene);
  const h = model.box.max.y - model.box.min.y;
  const k = h > 0 ? height / h : 1;
  inner.scale.multiplyScalar(k);
  inner.position.y -= model.box.min.y * k;
  inner.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  const object = new THREE.Group();
  object.name = 'model';
  object.add(inner);

  const mixer = new THREE.AnimationMixer(inner);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of model.clips) {
    const a = mixer.clipAction(clip);
    a.setEffectiveWeight(0).play();
    actions.set(clip.name, a);
  }
  const names = new Set(actions.keys());

  return {
    object,
    pose(action, t, eventSeconds) {
      const name = clipFor(action, names);
      if (!name) {
        // No clip for this action: put the model back in its rest pose (pose depends on t alone).
        for (const a of actions.values()) a.setEffectiveWeight(0);
        mixer.update(0);
        return undefined;
      }
      // The mixer never runs free: each clip's time is SET from t, then applied with a zero step.
      for (const [n, a] of actions) {
        a.setEffectiveWeight(n === name ? 1 : 0);
        a.time = clipTime(t, eventSeconds, a.getClip().duration);
      }
      mixer.update(0);
      return name;
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(inner);
      inner.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.dispose(); });
    },
  };
}
