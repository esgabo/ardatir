import { describe, expect, it } from 'vitest';
import { SHUT, liftOf, revealAt } from '../src/scene/reveal';

describe('revealAt', () => {
  const keys = [
    { t: 0.2, cover: 'hill', amount: 0 },
    { t: 0.4, cover: 'hill', amount: 1 },
  ];

  it('leaves everything shut without keys, so a set that stages no reveal stays closed', () => {
    expect(revealAt(undefined, 0.5)).toEqual(SHUT);
    expect(revealAt([], 0.5)).toEqual(SHUT);
    expect(liftOf(revealAt(undefined, 0.5), 'hill')).toBe(0);
  });

  it('holds the first key before it and the last key after it', () => {
    expect(liftOf(revealAt(keys, 0), 'hill')).toBe(0);
    expect(liftOf(revealAt(keys, 0.2), 'hill')).toBe(0);
    expect(liftOf(revealAt(keys, 0.4), 'hill')).toBe(1);
    expect(liftOf(revealAt(keys, 1), 'hill')).toBe(1);
  });

  it('eases the lift, gently at both ends', () => {
    expect(liftOf(revealAt(keys, 0.3), 'hill')).toBeCloseTo(0.5, 6);
    // An eighth of the way through has lifted less than an eighth of the way.
    expect(liftOf(revealAt(keys, 0.225), 'hill')).toBeLessThan(0.125);
    expect(liftOf(revealAt(keys, 0.375), 'hill')).toBeGreaterThan(0.875);
  });

  it('keeps each cover on its own track', () => {
    const two = [
      { t: 0, cover: 'hill', amount: 0 },
      { t: 0.5, cover: 'hill', amount: 1 },
      { t: 0, cover: 'roof', amount: 0 },
      { t: 0.9, cover: 'roof', amount: 1 },
    ];
    const at = revealAt(two, 0.5);
    // The Hill is wide open by its own last key while the roof is still on its way up.
    expect(liftOf(at, 'hill')).toBe(1);
    expect(liftOf(at, 'roof')).toBeGreaterThan(0);
    expect(liftOf(at, 'roof')).toBeLessThan(1);
  });

  it('can shut a cover again, so a scene may close the door behind it', () => {
    const shutAgain = [
      { t: 0.1, cover: 'hill', amount: 0 },
      { t: 0.3, cover: 'hill', amount: 1 },
      { t: 0.8, cover: 'hill', amount: 1 },
      { t: 0.95, cover: 'hill', amount: 0 },
    ];
    expect(liftOf(revealAt(shutAgain, 0.5), 'hill')).toBe(1);
    expect(liftOf(revealAt(shutAgain, 1), 'hill')).toBe(0);
  });

  it('takes a key at its own t even when two share one, so a reveal can be instant', () => {
    const cut = [
      { t: 0, cover: 'hill', amount: 0 },
      { t: 0.5, cover: 'hill', amount: 0 },
      { t: 0.5, cover: 'hill', amount: 1 },
    ];
    expect(liftOf(revealAt(cut, 0.49), 'hill')).toBe(0);
    expect(liftOf(revealAt(cut, 0.5), 'hill')).toBe(1);
  });

  it('reports nothing for a cover the staging never names', () => {
    expect(liftOf(revealAt(keys, 0.5), 'thatch')).toBe(0);
    expect(revealAt(keys, 0.5)).not.toHaveProperty('thatch');
  });
});
