import { describe, expect, it } from 'vitest';
import { collidingShown, currentBeat, layoutBeatLabels } from '../src/beatLabels.ts';

const base = { barWidth: 600, gap: 8, current: -1, focus: 0 };

describe('layoutBeatLabels', () => {
  it('shows every label when there is room', () => {
    const r = layoutBeatLabels({ ...base, positions: [0.2, 0.5, 0.8], widths: [60, 60, 60] });
    expect(r.show).toEqual([true, true, true]);
    expect(r.x).toEqual([120, 300, 480]);
  });

  it('hides the later of two colliding labels, preferring the nearer to the playhead', () => {
    const p = [0.5, 0.52];
    const w = [80, 80];
    expect(layoutBeatLabels({ ...base, positions: p, widths: w, focus: 0.5 }).show).toEqual([true, false]);
    expect(layoutBeatLabels({ ...base, positions: p, widths: w, focus: 0.53 }).show).toEqual([false, true]);
  });

  it('breaks a distance tie in favour of the earlier beat', () => {
    expect(layoutBeatLabels({ ...base, positions: [0.49, 0.51], widths: [80, 80], focus: 0.5 }).show).toEqual([true, false]);
  });

  it('always shows the current beat, even against nearer ones', () => {
    const r = layoutBeatLabels({ ...base, positions: [0.5, 0.52], widths: [80, 80], current: 1, focus: 0.5 });
    expect(r.show).toEqual([false, true]);
  });

  it('respects the gap', () => {
    // 100px centres apart, widths 60: 40px free, enough for 8 but not for 50.
    const p = [0.3, 0.3 + 100 / 600];
    expect(layoutBeatLabels({ ...base, positions: p, widths: [60, 60] }).show).toEqual([true, true]);
    expect(layoutBeatLabels({ ...base, positions: p, widths: [60, 60], gap: 50 }).show).toEqual([true, false]);
  });

  it('keeps labels inside the bar at both ends', () => {
    const r = layoutBeatLabels({ ...base, positions: [0, 1], widths: [80, 100] });
    expect(r.x).toEqual([40, 550]);
    expect(r.show).toEqual([true, true]);
  });

  it('collides on the clamped position, not the marker', () => {
    // Markers 3% apart at the left edge: clamped labels overlap.
    const r = layoutBeatLabels({ ...base, positions: [0, 0.03], widths: [80, 80] });
    expect(r.show).toEqual([true, false]);
  });

  it('does not flicker as the layout is deterministic', () => {
    const a = layoutBeatLabels({ ...base, positions: [0.1, 0.12, 0.5], widths: [70, 70, 70], current: 0, focus: 0.1 });
    expect(layoutBeatLabels({ ...base, positions: [0.1, 0.12, 0.5], widths: [70, 70, 70], current: 0, focus: 0.1 })).toEqual(a);
  });
});

describe('currentBeat', () => {
  it('is the last beat at or before t', () => {
    expect(currentBeat([0.1, 0.5, 0.9], 0.05)).toBe(-1);
    expect(currentBeat([0.1, 0.5, 0.9], 0.5)).toBe(1);
    expect(currentBeat([0.1, 0.5, 0.9], 1)).toBe(2);
  });
});

describe('collidingShown', () => {
  it('lists the shown labels a hidden one would cover', () => {
    const w = [80, 80, 80];
    const layout = layoutBeatLabels({ ...base, positions: [0.1, 0.12, 0.8], widths: w, focus: 0.1 });
    expect(layout.show).toEqual([true, false, true]);
    expect(collidingShown(1, layout, w, 8)).toEqual([0]);
  });

  it('is empty for a label that is already shown', () => {
    const w = [80, 80];
    const layout = layoutBeatLabels({ ...base, positions: [0.1, 0.12], widths: w });
    expect(collidingShown(0, layout, w, 8)).toEqual([]);
  });
});
