// Automatic checks on one rendered passage (scripts/narration/checks.ts).

import { describe, expect, it } from 'vitest';
import { checkPassage, normalizeWords, wordErrorRate, type CheckInput } from '../scripts/narration/checks.ts';
import type { AudioStats } from '../scripts/narration/wav.ts';

const EA = 'And then he spoke one word, Eä. Let it be. And the world was real.';
// A natural reading: 14 words in about 4.3 s, a little lead-in, clean levels.
const stats = (over: Partial<AudioStats> = {}): AudioStats => ({ duration: 4.3, peakDb: -3, rmsDb: -20, longestInnerSilence: 0.4, leadSilence: 0.1, ...over });
const input = (over: Partial<CheckInput> = {}): CheckInput => ({ text: EA, transcript: EA, names: [], stats: stats(), ...over });
const kinds = (c: CheckInput) => checkPassage(c).map((f) => f.kind).sort();

describe('normalizeWords and wordErrorRate', () => {
  it('lowercases and strips accents and punctuation', () => {
    expect(normalizeWords('Ilúvatar, the One')).toEqual(['iluvatar', 'the', 'one']);
  });
  it('counts substitutions, insertions and deletions per reference word', () => {
    expect(wordErrorRate(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd', 'e'])).toBeCloseTo(0.5);
    expect(wordErrorRate(['a', 'b'], ['a', 'b'])).toBe(0);
  });
});

describe('checkPassage', () => {
  it('passes an exact reading', () => {
    expect(checkPassage(input())).toEqual([]);
  });

  it('flags a missing ending', () => {
    expect(kinds(input({ transcript: 'And then he spoke one word, Eä. Let it be.' }))).toEqual(['edges', 'words']);
  });

  it('flags a name that was not heard (the audition: Eä came out as "E")', () => {
    const c = input({ transcript: 'And then he spoke one word, E, let it be, and the world was real.', names: [{ name: 'Eä', said: 'Eä' }] });
    expect(kinds(c)).toEqual(['name']);
  });

  it('accepts a name heard as its respelling', () => {
    const c = input({ transcript: 'And then he spoke one word, Ay-ah. Let it be. And the world was real.', names: [{ name: 'Eä', said: 'AY-ah' }] });
    expect(checkPassage(c)).toEqual([]);
  });

  it('flags pace against the narrator\'s median', () => {
    // 15 words in 4.2 s of voice ≈ 3.6 wps: within 25% of 3.2, but in 2.9 s (5.2 wps) it is not.
    expect(kinds(input({ medianWps: 3.2 }))).toEqual([]);
    expect(kinds(input({ medianWps: 3.2, stats: stats({ duration: 3.0 }) }))).toEqual(['pace']);
  });

  it('flags clipping, a long silence, and a quiet take', () => {
    expect(kinds(input({ stats: stats({ peakDb: 0 }) }))).toEqual(['clipping']);
    expect(kinds(input({ stats: stats({ longestInnerSilence: 2 }) }))).toEqual(['silence']);
    expect(kinds(input({ stats: stats({ rmsDb: -40 }) }))).toEqual(['quiet']);
  });

  it('flags an implausible length for the text', () => {
    expect(kinds(input({ text: 'Let it be', transcript: 'Let it be', stats: stats({ duration: 5 }) }))).toEqual(['length']);
  });
});
