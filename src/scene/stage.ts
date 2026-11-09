import type * as THREE from 'three';

/** What the side panel shows for a selected thing at the current moment. */
export interface SelectionInfo {
  title: string;
  subtitle?: string;
  body: string;
  thought?: string;
}

/**
 * A zoom level's renderable world. Everything visible must be a function of the
 * event time `t` (0 → 1) so the scrubber can jump anywhere; `ambient` is free-running
 * seconds for idle motion only (shimmer, drift, bobbing).
 */
export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  /** Point the orbit controls circle around. */
  target: THREE.Vector3;
  update(t: number, ambient: number): void;
  /**
   * `insetLeft`: pixels on the left covered by the event card (desktop), so a stage can frame
   * its subject in the space left free. Stages that fill the screen (the cosmos) ignore it.
   */
  resize(width: number, height: number, insetLeft?: number): void;
  /** Return a selectable id under the ray, if any. */
  pick?(ray: THREE.Raycaster): string | null;
  select?(id: string | null): void;
  info?(id: string, t: number): SelectionInfo | null;
  /** Full-screen flash strength 0 → 1 (e.g. the moment of Eä). */
  flash?(t: number): number;
  dispose(): void;
}
