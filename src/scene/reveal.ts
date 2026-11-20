// How far each of a set's covers has lifted at a moment (staging.yaml `reveal`, types.ts
// `CoverKey`). A scene played indoors is hidden by whatever keeps the weather off it: the earth
// over Bag End, a shingled roof at Rivendell, the Green Dragon's thatch. A kit names each cover
// (`cover-<name>`), and the author says when it rises out of the way, like the lid off a doll's
// house — never the camera, which would make the reveal a consequence of where the view happens
// to be rather than a thing the scene does. Pure in `t`, like the light and the framing.

import type { CoverKey } from '../data/types';

/** How far each cover has lifted at this moment, by name: 0 closed, 1 lifted clear. */
export type Reveal = Readonly<Record<string, number>>;

/** Nothing lifted: what an event without a `reveal` track gets, and the starting point. */
export const SHUT: Reveal = {};

const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * The lift of every named cover at `t`, eased between that cover's own keys. A cover is closed
 * before its first key and holds its last key afterwards, so an author only writes the moments
 * that matter; a cover the staging never mentions is absent, which the set reads as closed.
 */
export function revealAt(keys: readonly CoverKey[] | undefined, t: number): Reveal {
  if (!keys?.length) return SHUT;
  const out: Record<string, number> = {};
  // Each cover is its own little track, in the order written: a staging may open the Hill and
  // close it again while a roof elsewhere stays shut throughout.
  const byCover = new Map<string, CoverKey[]>();
  for (const k of keys) {
    const list = byCover.get(k.cover);
    if (list) list.push(k);
    else byCover.set(k.cover, [k]);
  }
  for (const [cover, track] of byCover) {
    out[cover] = amountAt(track, t);
  }
  return out;
}

function amountAt(track: readonly CoverKey[], t: number): number {
  if (t <= track[0].t) return track[0].amount;
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i], b = track[i + 1];
    if (t < b.t) {
      const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      return a.amount + (b.amount - a.amount) * smooth(u);
    }
  }
  return track[track.length - 1].amount;
}

/** How far a cover has lifted, for a set that knows its own name. */
export function liftOf(reveal: Reveal, cover: string): number {
  const a = reveal[cover];
  return a === undefined ? 0 : a;
}
