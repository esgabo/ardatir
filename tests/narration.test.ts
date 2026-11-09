// The textHash that ties a recording to the words it reads (scripts/narration/text.ts).

import { describe, expect, it } from 'vitest';
import { narrationHash, TEXT_HASH, type Passage } from '../scripts/narration/text.ts';

const script: Passage[] = [
  { id: 'fire', text: { en: 'Cold and lost, the company spotted a light among the trees.', es: 'Vieron una luz entre los árboles.' } },
  { id: 'trolls', text: { en: 'Three trolls sat around the fire.' } },
];
const hash = narrationHash(script, 'en');

describe('narrationHash', () => {
  it('is sha256: and 16 hex digits', () => {
    expect(hash).toMatch(TEXT_HASH);
  });

  it('ignores re-wrapping and extra whitespace', () => {
    const rewrapped: Passage[] = [
      { id: 'fire', text: { en: '  Cold and lost, the company\n  spotted a light   among the trees.\n' } },
      { id: 'trolls', text: { en: 'Three trolls sat\taround the fire. ' } },
    ];
    expect(narrationHash(rewrapped, 'en')).toBe(hash);
  });

  it('changes when a passage\'s words change', () => {
    expect(narrationHash([script[0], { id: 'trolls', text: { en: 'Three trolls sat by the fire.' } }], 'en')).not.toBe(hash);
  });

  it('changes when an id changes', () => {
    expect(narrationHash([script[0], { ...script[1], id: 'trolls-at-the-fire' }], 'en')).not.toBe(hash);
  });

  it('changes when the order changes', () => {
    expect(narrationHash([script[1], script[0]], 'en')).not.toBe(hash);
  });

  it('hashes each language on its own, falling back to English where a passage has none', () => {
    const es = narrationHash(script, 'es');
    expect(es).not.toBe(hash);
    expect(es).toBe(narrationHash([script[0], { id: 'trolls', text: { en: 'Three trolls sat around the fire.', es: 'Three trolls sat around the fire.' } }], 'es'));
  });
});
