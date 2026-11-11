import { describe, expect, it, vi } from 'vitest';
import { EventClock } from '../src/eventClock.ts';
import type { EventDetail, NarrationAudio } from '../src/data/types.ts';

/** A playable event with passages at the given `t`s and, optionally, an English recording. */
function event(ts: number[], audio?: NarrationAudio, durationSeconds = 24): EventDetail {
  return {
    id: 'test', age: 'third-age', characters: [], arcs: [], journeys: [], tags: [], status: 'staged',
    title: { en: 'Test' }, summary: { en: 'Test' }, links: [], audio: audio ? ['en'] : [],
    stage: 'diorama', durationSeconds, beats: [], tracks: [],
    narration: ts.map((t, i) => ({ id: `p${i}`, t, text: { en: `Passage ${i}` } })),
    audioFiles: audio ? { en: audio } : {},
  };
}

/** Play from 0 to the end in small steps, as the app's loop does, returning each t. */
function play(clock: EventClock, step = 0.05): number[] {
  const ts: number[] = [];
  for (let s = 0; s <= clock.duration + 1e-9; s += step) ts.push(clock.tAt(s));
  return ts;
}

describe('EventClock', () => {
  it('without audio (null) lasts the staging duration, even when a recording exists', () => {
    const e = event([0, 0.5], { src: 'x', duration: 40 }, 24);
    expect(new EventClock(e, null).duration).toBe(24);
    expect(new EventClock(e, 'en').duration).toBe(40);
  });

  const ts = [0, 0.2, 0.7, 0.85];
  const uneven = event(ts, { src: 'x', duration: 40, starts: [0, 3, 25, 26.5] });

  it('lands each passage on its t, even with uneven starts', () => {
    const c = new EventClock(uneven, 'en');
    ts.forEach((t, i) => {
      const s = uneven.audioFiles.en!.starts![i];
      expect(c.tAt(s)).toBeCloseTo(t);
      expect(c.secondsAt(t)).toBeCloseTo(s);
      expect(c.segmentAt(s + 1e-6)?.index).toBe(i);
    });
  });

  it('reaches t = 1 exactly at the recording duration', () => {
    const c = new EventClock(uneven, 'en');
    expect(c.duration).toBe(40);
    expect(c.tAt(40)).toBe(1);
    expect(c.tAt(41)).toBe(1);
    expect(c.secondsAt(1)).toBe(40);
  });

  it('never runs t backwards while playing', () => {
    const t = play(new EventClock(uneven, 'en'));
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
    expect(t.at(-1)).toBeCloseTo(1);
  });

  it('a passage shows from its start to the next one, with progress 0 → 1', () => {
    const c = new EventClock(uneven, 'en');
    expect(c.segmentAt(3)?.progress).toBe(0);
    expect(c.segmentAt(14)?.progress).toBeCloseTo(0.5);
    expect(c.segmentAt(39)?.index).toBe(3);
  });

  it('silence before the first passage does not stall playback', () => {
    // The animation's first passage is at t = 0.25 but the reader starts at 4 s;
    // and a second recording has 2 s of silence before a passage placed at t = 0.
    const late = event([0.25, 0.6], { src: 'x', duration: 20, starts: [4, 10] });
    const c = new EventClock(late, 'en');
    expect(c.segmentAt(2)).toBeNull();
    expect(c.tAt(2)).toBeGreaterThan(0);
    expect(c.tAt(2)).toBeLessThan(0.25);
    expect(c.tAt(4)).toBeCloseTo(0.25);

    const silent = event([0, 0.5], { src: 'x', duration: 10, starts: [2, 6] });
    const s = new EventClock(silent, 'en');
    expect(s.segmentAt(1)).toBeNull();
    expect(s.segmentAt(2)?.index).toBe(0);
    const t = play(s);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
    expect(s.tAt(4)).toBeGreaterThan(0); // moving again once the reading starts
    expect(s.tAt(10)).toBe(1);
  });

  it('without a recording, runs the authored duration linearly', () => {
    const c = new EventClock(event([0, 0.5], undefined, 24), 'en');
    expect(c.duration).toBe(24);
    expect(c.tAt(12)).toBeCloseTo(0.5);
    expect(c.secondsAt(0.25)).toBeCloseTo(6);
    expect(c.segmentAt(12)?.index).toBe(1);
  });

  it('falls back to linear timing when starts do not match the passages', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c = new EventClock(event([0, 0.5], { src: 'x', duration: 30, starts: [0] }), 'en');
    expect(warn).toHaveBeenCalled();
    expect(c.tAt(15)).toBeCloseTo(0.5);
    expect(c.tAt(30)).toBe(1);
    warn.mockRestore();
  });

  it('a language without a recording uses the authored duration', () => {
    const c = new EventClock(uneven, 'es');
    expect(c.duration).toBe(24);
    expect(c.tAt(24)).toBe(1);
  });
});
