// Best guesses explained in words (src/placement.ts) and "likely" vs "possibly" on the site
// (src/related.ts), against the real content: the example from issue #2.

import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildContent } from '../scripts/content/build.ts';
import { index, loadIndex } from '../src/chronicle.ts';
import { inSentence, likelyParts, partsText, placementParts } from '../src/placement.ts';
import { sameTime } from '../src/related.ts';

const content = path.resolve(import.meta.dirname, '..', 'content');

beforeAll(async () => {
  const ix = buildContent(content).index;
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ix }));
  await loadIndex();
  vi.unstubAllGlobals();
});

const ev = (id: string) => index.events.find((e) => e.id === id)!;

describe('how a best guess is explained', () => {
  it('the secret door: its honest range, then the anchor it is placed after and whose story that is', () => {
    expect(partsText(placementParts(ev('the-secret-door'), 'en'), 'en')).toBe(
      'The sources say only autumn, T.A. 2941. We place it after A Welcome at Lake-town (22 September, T.A. 2941), ' +
      "because that is the order of Bilbo Baggins's story. It shares that stretch with 5 other events, spaced out in story order.");
    expect(partsText(placementParts(ev('the-secret-door'), 'es'), 'es')).toBe(
      'Las fuentes solo dicen otoño, T.E. 2941. Lo situamos después de La bienvenida en la Ciudad del Lago (22 de septiembre, T.E. 2941), ' +
      'porque ese es el orden de la historia de Bilbo Bolsón. Comparte ese tramo con otros 5 eventos, repartidos en el orden de la historia.');
  });

  it('contracts "de El" in Spanish names', () => {
    expect(partsText(placementParts(ev('death-of-smaug'), 'es'), 'es')).toContain('la historia del Gobernador');
  });

  it('an exact date is stated, never a guess', () => {
    expect(partsText(placementParts(ev('welcome-at-lake-town'), 'en'), 'en')).toBe('The sources give 22 September, T.A. 2941.');
  });

  it('an event moved after what caused it says so', () => {
    expect(partsText(placementParts(ev('thorin-is-laid-to-rest'), 'en'), 'en')).toMatch(/We place it just after Thorin's Farewell \(autumn, T\.A\. 2941\), which led to it\.$/);
  });

  it('keeps months and abbreviations as they are inside a sentence, lowercases seasons and "around"', () => {
    expect(inSentence('Autumn, T.A. 2941', 'en')).toBe('autumn, T.A. 2941');
    expect(inSentence('Around T.A. 2463', 'en')).toBe('around T.A. 2463');
    expect(inSentence('September, T.A. 2941', 'en')).toBe('September, T.A. 2941');
    expect(inSentence('Septiembre, T.E. 2941', 'es')).toBe('septiembre, T.E. 2941');
    expect(inSentence('T.E. 2941', 'es')).toBe('T.E. 2941');
  });
});

describe('around the same time, on the site', () => {
  it('during A Welcome at Lake-town, the secret door is only "possibly", never "likely" (#2)', () => {
    const same = sameTime(ev('welcome-at-lake-town'), 50);
    expect(same.likely.map((e) => e.id)).not.toContain('the-secret-door');
    expect(same.possibly.find((x) => x.event.id === 'the-secret-door')?.why).toBe('same-character');
  });

  it('"likely" says how close our guesses put them, then how the other is placed', () => {
    const lake = ev('welcome-at-lake-town');
    const likely = sameTime(lake, 50).likely;
    for (const e of likely) {
      const text = partsText(likelyParts(lake, e, 'en'), 'en');
      expect(text, e.id).toMatch(/^By our best guess, the two fall within (three days|half a month|a month and a half) of each other\. The sources (give|say only) /);
    }
  });
});
