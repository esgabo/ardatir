// Honest dates in words (src/format.ts): ranges keep their end, and name the age once.

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadIndex } from '../src/chronicle.ts';
import { honestDate, shortDate, type Dated } from '../src/format.ts';
import type { ContentIndex, Precision, StoryDate } from '../src/data/types.ts';

const ages = [
  { id: 'years-of-the-trees', order: 3, name: { en: 'Years of the Trees' }, abbr: { en: 'Y.T.', es: 'A.Á.' }, summary: { en: '' } },
  { id: 'first-age', order: 4, name: { en: 'First Age' }, abbr: { en: 'F.A.', es: 'P.E.' }, summary: { en: '' } },
  { id: 'third-age', order: 6, name: { en: 'Third Age' }, abbr: { en: 'T.A.', es: 'T.E.' }, summary: { en: '' } },
];

beforeAll(async () => {
  const ix = { ages, characters: [], places: [], arcs: [], journeys: [], events: [], byCharacter: {}, lanes: {}, byPlace: {}, factions: [], byFaction: {} } as unknown as ContentIndex;
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ix }));
  await loadIndex();
  vi.unstubAllGlobals();
});

const d = (age: string, year: number, x: Partial<StoryDate> = {}): StoryDate => ({ age, year, ...x });
const range = (start: StoryDate, end: StoryDate | undefined, precision: Precision, endPrecision?: Precision): Dated =>
  ({ age: start.age, when: { start, ...(end ? { end } : {}), precision, ...(endPrecision ? { endPrecision } : {}) } });

describe('shortDate', () => {
  it('keeps the end of a range', () => {
    expect(shortDate(range(d('first-age', 52), d('first-age', 116), 'year'), 'en')).toBe('52–116');
    expect(shortDate(range(d('first-age', 545), d('first-age', 587), 'approximate'), 'en')).toBe('c. 545–587');
    expect(shortDate(range(d('years-of-the-trees', 1250), d('years-of-the-trees', 1450), 'decade'), 'en')).toBe('1250–1459');
  });
  it('a stay from a month to a named day, as journey legs have', () => {
    expect(shortDate(range(d('third-age', 2941, { month: 6 }), d('third-age', 2941, { day: '1-lithe' }), 'month', 'day'), 'en')).toBe('Jun – 1 Lithe 2941');
  });
  it('across years', () => {
    expect(shortDate(range(d('third-age', 3018, { month: 9 }), d('third-age', 3019, { month: 3 }), 'month'), 'en')).toBe('Sep 3018 – Mar 3019');
  });
  it('single dates as before', () => {
    expect(shortDate(range(d('third-age', 2463), undefined, 'approximate'), 'en')).toBe('c. 2463');
    expect(shortDate(range(d('third-age', 2850), undefined, 'decade'), 'en')).toBe('2850–59');
    expect(shortDate(range(d('third-age', 2941, { month: 4 }), undefined, 'month'), 'en')).toBe('Apr 2941');
  });
});

describe('honestDate', () => {
  it('names the age once in a range', () => {
    expect(honestDate(range(d('first-age', 545), d('first-age', 587), 'approximate'), 'en')).toBe('Around F.A. 545–587');
    expect(honestDate(range(d('first-age', 545), d('first-age', 587), 'approximate'), 'es')).toBe('Hacia P.E. 545–587');
    expect(honestDate(range(d('years-of-the-trees', 1250), d('years-of-the-trees', 1450), 'decade'), 'en')).toBe('Y.T. 1250–1459');
    expect(honestDate(range(d('first-age', 52), d('first-age', 116), 'year'), 'en')).toBe('F.A. 52–116');
  });
  it('a range inside one year', () => {
    expect(honestDate(range(d('third-age', 2941, { month: 6 }), d('third-age', 2941, { day: '1-lithe' }), 'month', 'day'), 'en')).toBe('June – 1 Lithe, T.A. 2941');
  });
});
