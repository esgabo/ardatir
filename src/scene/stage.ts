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
  /** `eventSeconds`: the event clock's length (the recording's, when there is one), for motion keyed to seconds. */
  update(t: number, ambient: number, eventSeconds?: number): void;
  resize(width: number, height: number): void;
  /** Return a selectable id under the ray, if any. */
  pick?(ray: THREE.Raycaster): string | null;
  select?(id: string | null): void;
  info?(id: string, t: number): SelectionInfo | null;
  /** Where a selected thing stands now (world space), so the camera can keep it framed; null when it is offstage. */
  focus?(id: string): THREE.Vector3 | null;
  /** Full-screen flash strength 0 → 1 (e.g. the moment of Eä). */
  flash?(t: number): number;
  dispose(): void;
}
