import { describe, expect, it } from 'vitest';
import { GROUND_ACROSS, GROUND_UP, HALF_HEIGHT, HEADROOM, framingAt, zoomFor } from '../src/scene/framing';

describe('framingAt', () => {
  const keys = [
    { t: 0.2, x: 0, z: 0, width: 12 },
    { t: 0.6, x: -2, z: -4, width: 3 },
  ];

  it('is undefined without keys, so an event that stages no framing is left alone', () => {
    expect(framingAt(undefined, 0.5)).toBeUndefined();
    expect(framingAt([], 0.5)).toBeUndefined();
  });

  it('holds the first shot before its key and the last after its key', () => {
    expect(framingAt(keys, 0)).toEqual({ x: 0, z: 0, width: 12 });
    expect(framingAt(keys, 0.2)).toEqual({ x: 0, z: 0, width: 12 });
    expect(framingAt(keys, 0.6)).toEqual({ x: -2, z: -4, width: 3 });
    expect(framingAt(keys, 1)).toEqual({ x: -2, z: -4, width: 3 });
  });

  it('eases between keys: halfway in t is halfway across the ground', () => {
    const mid = framingAt(keys, 0.4)!;
    expect(mid.x).toBeCloseTo(-1, 6);
    expect(mid.z).toBeCloseTo(-2, 6);
  });

  it('eases width through its ratio, so halving the frame feels the same from any distance', () => {
    // Geometric, not arithmetic: the midpoint of 12 → 3 is 6, not 7.5.
    expect(framingAt(keys, 0.4)!.width).toBeCloseTo(6, 6);
  });

  it('starts and ends a move gently (smoothstep), like the light', () => {
    const early = framingAt(keys, 0.25)!, late = framingAt(keys, 0.55)!;
    // An eighth of the way through t has moved less than an eighth of the way across.
    expect(Math.abs(early.x)).toBeLessThan(0.25);
    expect(Math.abs(late.x)).toBeGreaterThan(1.75);
  });

  it('takes a key at its own t even when two share one', () => {
    const cut = [{ t: 0, x: 0, z: 0, width: 10 }, { t: 0.5, x: 0, z: 0, width: 10 }, { t: 0.5, x: 3, z: 3, width: 4 }];
    expect(framingAt(cut, 0.5)).toEqual({ x: 3, z: 3, width: 4 });
  });
});

describe('zoomFor', () => {
  const fits = (width: number, aspect: number) => {
    const zoom = zoomFor(width, aspect);
    return {
      across: (2 * HALF_HEIGHT * aspect) / zoom - width * GROUND_ACROSS,
      up: (2 * HALF_HEIGHT) / zoom - (width * GROUND_UP + HEADROOM),
    };
  };

  it('holds the asked-for square of ground, both ways, on a wide viewport', () => {
    const { across, up } = fits(6, 16 / 9);
    expect(across).toBeGreaterThanOrEqual(-1e-9);
    expect(up).toBeGreaterThanOrEqual(-1e-9);
  });

  it('holds it on a phone held upright too, by showing more ground rather than cropping', () => {
    const { across, up } = fits(6, 390 / 740);
    expect(across).toBeGreaterThanOrEqual(-1e-9);
    expect(up).toBeGreaterThanOrEqual(-1e-9);
    // A tall window is limited by its width, so it ends up looser than a wide one.
    expect(zoomFor(6, 390 / 740)).toBeLessThan(zoomFor(6, 16 / 9));
  });

  it('comes in closer for a smaller frame', () => {
    expect(zoomFor(3, 1.6)).toBeGreaterThan(zoomFor(6, 1.6));
    expect(zoomFor(6, 1.6)).toBeGreaterThan(zoomFor(14, 1.6));
  });

  it('leaves headroom for what stands on the ground', () => {
    // Without it, a frame tight on a room would cut off a wizard's hat.
    expect(fits(3, 1.6).up).toBeGreaterThanOrEqual(-1e-9);
    expect(HEADROOM).toBeGreaterThan(0);
  });

  it('survives a nonsense width or aspect rather than dividing by zero', () => {
    expect(zoomFor(0, 1.6)).toBeGreaterThan(0);
    expect(Number.isFinite(zoomFor(6, 0))).toBe(true);
  });
});
