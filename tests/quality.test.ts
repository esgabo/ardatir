import { describe, expect, it } from 'vitest';
import { QUALITIES, QUALITY, chooseQuality, detectQuality, isQuality } from '../src/scene/quality';

describe('QUALITY', () => {
  it('turns everything down together, never up', () => {
    const order = ['low', 'medium', 'high'] as const;
    for (let i = 1; i < order.length; i++) {
      const lower = QUALITY[order[i - 1]], higher = QUALITY[order[i]];
      expect(lower.shadowMap).toBeLessThanOrEqual(higher.shadowMap);
      expect(lower.maxPixelRatio).toBeLessThanOrEqual(higher.maxPixelRatio);
      expect(lower.smokePuffs).toBeLessThanOrEqual(higher.smokePuffs);
      expect(lower.fireflies).toBeLessThanOrEqual(higher.fireflies);
      expect(lower.sprayPoints).toBeLessThanOrEqual(higher.sprayPoints);
    }
  });

  it('keeps contact shadows at every quality, since they are what hold figures on the ground', () => {
    for (const q of QUALITIES) expect(QUALITY[q].contactShadows).toBe(true);
  });

  it('still draws something at low: a figure is never left with no shadow at all', () => {
    expect(QUALITY.low.shadows).toBe(false);
    expect(QUALITY.low.contactShadows).toBe(true);
    expect(QUALITY.low.smokePuffs).toBeGreaterThan(0);
  });
});

describe('detectQuality', () => {
  it('drops to low on a weak device however it is pointed at', () => {
    expect(detectQuality({ cores: 2, memory: 8 })).toBe('low');
    expect(detectQuality({ cores: 8, memory: 2 })).toBe('low');
  });

  it('is cautious with touch devices', () => {
    expect(detectQuality({ cores: 4, memory: 4, coarsePointer: true })).toBe('low');
    expect(detectQuality({ cores: 8, memory: 8, coarsePointer: true })).toBe('medium');
  });

  it('gives a roomy desktop the full look', () => {
    expect(detectQuality({ cores: 8, memory: 8 })).toBe('high');
    expect(detectQuality({ cores: 6, memory: 16 })).toBe('high');
  });

  it('guesses middlingly when the browser says nothing', () => {
    expect(detectQuality()).toBe('medium');
  });
});

describe('chooseQuality', () => {
  const device = { cores: 8, memory: 8 };

  it('does what the URL asks', () => {
    expect(chooseQuality('low', 'high', device)).toBe('low');
    expect(chooseQuality('high', 'low', { cores: 2, memory: 2 })).toBe('high');
  });

  it('measures again when the URL says auto, ignoring what was remembered', () => {
    expect(chooseQuality('auto', 'low', device)).toBe('high');
  });

  it('falls back to what was remembered, then to the guess', () => {
    expect(chooseQuality(null, 'medium', device)).toBe('medium');
    expect(chooseQuality(null, null, device)).toBe('high');
    expect(chooseQuality('nonsense', 'rubbish', device)).toBe('high');
  });
});

describe('isQuality', () => {
  it('accepts only the three names', () => {
    expect(QUALITIES.every(isQuality)).toBe(true);
    expect(isQuality('auto')).toBe(false);
    expect(isQuality(null)).toBe(false);
  });
});
