import type { Keyframe, LocalizedText, Track } from './data/types';

export interface Pose {
  x: number;
  z: number;
  /** Heading in radians, facing the direction of travel. */
  heading: number;
  action: NonNullable<Keyframe['action']>;
  /** Latest thought at or before this moment. */
  thought?: LocalizedText;
  moving: boolean;
}

/** Sample a character's track at normalised time t (0 → 1). Pure, so the scrubber can jump anywhere. */
export function samplePose(track: Track, t: number): Pose {
  const ks = track.keyframes;
  if (ks.length === 0) return { x: 0, z: 0, heading: 0, action: 'idle', moving: false };

  let i = 0;
  while (i < ks.length - 1 && ks[i + 1].t <= t) i++;
  const a = ks[i];
  const b = ks[Math.min(i + 1, ks.length - 1)];

  const span = b.t - a.t;
  const u = span > 0 ? Math.min(Math.max((t - a.t) / span, 0), 1) : 0;
  const x = a.x + (b.x - a.x) * u;
  const z = a.z + (b.z - a.z) * u;
  const dx = b.x - a.x, dz = b.z - a.z;
  const moving = span > 0 && u < 1 && Math.hypot(dx, dz) > 1e-3;

  let thought: LocalizedText | undefined;
  for (let k = 0; k <= i; k++) if (ks[k].thought) thought = ks[k].thought;

  return {
    x, z,
    heading: Math.atan2(dx, dz),
    action: moving ? (b.action === 'run' ? 'run' : 'walk') : (a.action ?? 'idle'),
    thought,
    moving,
  };
}
