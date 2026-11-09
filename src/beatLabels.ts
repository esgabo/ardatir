// Beat labels on the progress bar: every beat keeps its marker, but a label is shown only when it
// doesn't collide with one already shown. Pure: no DOM, so it can be tested.

export interface BeatLabelInput {
  /** Marker positions along the bar, 0..1, in beat order. */
  positions: number[];
  /** Measured label widths in px, same order. */
  widths: number[];
  barWidth: number;
  /** Minimum space between two shown labels, px. */
  gap: number;
  /** Index of the current beat (always shown), or -1 before the first. */
  current: number;
  /** Where the playhead was when the layout was made, 0..1: nearer beats win collisions. */
  focus: number;
}

export interface BeatLabelLayout {
  /** Whether each label is shown. */
  show: boolean[];
  /** Each label's centre in px from the bar's left edge, kept inside the bar even when hidden. */
  x: number[];
}

/** Greedy layout: the current beat first, then by distance from the playhead, then the earlier. */
export function layoutBeatLabels(i: BeatLabelInput): BeatLabelLayout {
  const n = i.positions.length;
  const x = i.positions.map((p, k) => {
    const half = i.widths[k] / 2;
    // A label wider than the bar is simply centred.
    if (i.widths[k] >= i.barWidth) return i.barWidth / 2;
    return Math.min(Math.max(p * i.barWidth, half), i.barWidth - half);
  });
  const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => {
    if (a === i.current) return -1;
    if (b === i.current) return 1;
    const da = Math.abs(i.positions[a] - i.focus), db = Math.abs(i.positions[b] - i.focus);
    return da - db || a - b;
  });
  const show = new Array<boolean>(n).fill(false);
  const taken: [number, number][] = [];
  for (const k of order) {
    const lo = x[k] - i.widths[k] / 2, hi = x[k] + i.widths[k] / 2;
    if (taken.some(([a, b]) => lo < b + i.gap && hi > a - i.gap)) continue;
    show[k] = true;
    taken.push([lo, hi]);
  }
  return { show, x };
}

/** The beat the playhead is in: the last one at or before `t` (-1 before the first). */
export function currentBeat(positions: number[], t: number): number {
  let c = -1;
  positions.forEach((p, k) => { if (p <= t + 1e-9) c = k; });
  return c;
}

/** The shown labels that label `k` would cover if it were revealed (hover or focus on a hidden one). */
export function collidingShown(k: number, layout: BeatLabelLayout, widths: number[], gap: number): number[] {
  if (layout.show[k]) return [];
  const lo = layout.x[k] - widths[k] / 2, hi = layout.x[k] + widths[k] / 2;
  return layout.show.flatMap((s, j) => {
    if (!s) return [];
    const a = layout.x[j] - widths[j] / 2, b = layout.x[j] + widths[j] / 2;
    return lo < b + gap && hi > a - gap ? [j] : [];
  });
}
