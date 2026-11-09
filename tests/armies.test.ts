// An army's place on the diorama is a pure function of t: position along its keyframes,
// heading from its travel (kept through pauses), and a smooth wheel when it turns.

import { describe, expect, it } from 'vitest';
import type { Army } from '../src/data/types';
import { sampleArmy } from '../src/scene/armies';

const army: Army = {
  faction: 'goblins', size: 'large', keyframes: [
    { t: 0, x: -13, z: -13, action: 'idle' },
    { t: 0.2, x: -13, z: -13, action: 'idle' },
    { t: 0.4, x: -3, z: -3, action: 'run' },
    { t: 0.6, x: -3, z: -3, action: 'fight' },
    { t: 0.8, x: -13, z: -13, action: 'run' },
  ],
};

describe('sampleArmy', () => {
  it('moves between keyframes and runs when the next keyframe says so', () => {
    expect(sampleArmy(army, 0.3)).toMatchObject({ x: -8, z: -8, action: 'run', moving: true });
    expect(sampleArmy(army, 0.5)).toMatchObject({ x: -3, z: -3, action: 'fight', moving: false });
  });

  it('faces its first march while it waits offstage, and keeps facing that way when it stops', () => {
    const ahead = Math.atan2(1, 1);
    expect(sampleArmy(army, 0).heading).toBeCloseTo(ahead);
    expect(sampleArmy(army, 0.5).heading).toBeCloseTo(ahead);
  });

  it('wheels round smoothly when it turns back, then faces the way it flees', () => {
    const back = Math.atan2(-1, -1);
    const start = sampleArmy(army, 0.6).heading, mid = sampleArmy(army, 0.6125).heading, end = sampleArmy(army, 0.7).heading;
    expect(start).toBeCloseTo(Math.atan2(1, 1));
    expect(Math.abs(Math.atan2(Math.sin(mid - start), Math.cos(mid - start)))).toBeGreaterThan(0.1);
    expect(Math.atan2(Math.sin(end - back), Math.cos(end - back))).toBeCloseTo(0);
  });

  it('gives the same answer every time (scrubbing and deep links)', () => {
    expect(sampleArmy(army, 0.37)).toEqual(sampleArmy(army, 0.37));
  });
});
