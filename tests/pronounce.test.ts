// Respelling names before they are sent to the Voice Studio (scripts/narration/pronounce.ts).

import { describe, expect, it } from 'vitest';
import { respell } from '../scripts/narration/pronounce.ts';

const lex = { en: { 'Eä': 'EH-ah' } };

describe('respell', () => {
  it('respells a whole word', () => {
    expect(respell('one word, Eä. Let it be.', 'en', lex)).toEqual({ text: 'one word, EH-ah. Let it be.', used: ['Eä'] });
  });

  it('does not respell inside a longer word', () => {
    expect(respell('Eärendil sailed', 'en', lex)).toEqual({ text: 'Eärendil sailed', used: [] });
  });

  it('is case-sensitive', () => {
    expect(respell('eä', 'en', lex)).toEqual({ text: 'eä', used: [] });
  });

  it('uses only the passage language', () => {
    expect(respell('Eä', 'en', { es: { 'Eä': 'É-a' } })).toEqual({ text: 'Eä', used: [] });
  });

  it('longest name first', () => {
    expect(respell('Thráin II', 'en', { en: { 'Thráin': 'A', 'Thráin II': 'B' } }).text).toBe('B');
  });

  it('lists each name once, sorted', () => {
    expect(respell('Melkor and Eä, Eä', 'en', { en: { 'Eä': 'X', Melkor: 'Y' } }).used).toEqual(['Eä', 'Melkor']);
  });
});
