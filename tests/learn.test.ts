// Wonder and learning (#29, docs/DESIGN.md §3.5): how to say a name, pointers to the books,
// and the first visit's opening steps. All pure.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { pronounceProblem, syllables } from '../src/data/pronounce.ts';
import { CHAPTERS_ES, chapterPhrase, readItInText } from '../src/books.ts';
import { INVITE_AT, nextFrom, OPENING_STEPS, openingSeen, stepAt } from '../src/opening.ts';

describe('pronunciation respellings', () => {
  it('accepts AR-da style: hyphenated syllables, one stressed in capitals per word', () => {
    for (const s of ['AR-da', 'ee-LOO-va-tar', 'i-LÚ-va-tar', 'MEE-nas TEE-rith', 'SMOWG', 'É-o-uin', "o'-NEIL"]) expect(pronounceProblem(s), s).toBeUndefined();
  });
  it('refuses respellings a reader could not follow', () => {
    expect(pronounceProblem('arda')).toMatch(/exactly one stressed syllable/);
    expect(pronounceProblem('AR-DA')).toMatch(/exactly one stressed syllable in CAPITALS, got 2/);
    expect(pronounceProblem('Ar-da')).toMatch(/all capitals .* or all small letters/);
    expect(pronounceProblem('AR--da')).toMatch(/empty syllable/);
    expect(pronounceProblem('AR-da!')).toMatch(/only letters/);
    expect(pronounceProblem(' ')).toBe('empty');
  });
  it('splits into words and syllables, marking the stress', () => {
    expect(syllables('KIR-ith OON-gol')).toEqual([
      [{ text: 'KIR', stressed: true }, { text: 'ith', stressed: false }],
      [{ text: 'OON', stressed: true }, { text: 'gol', stressed: false }],
    ]);
  });
});

describe('pointers to the books', () => {
  it('names The Hobbit\'s chapters by number and title, in each language', () => {
    expect(readItInText({ book: 'the-hobbit', chapter: 5 }, 'en')).toBe('Read this in The Hobbit, chapter 5, “Riddles in the Dark”.');
    expect(readItInText({ book: 'the-hobbit', chapter: 5 }, 'es')).toBe('Léelo en El Hobbit, capítulo 5, «Acertijos en las tinieblas».');
  });
  it('gives named chapters in the reader\'s language, appendices unquoted, and a book alone', () => {
    expect(readItInText({ book: 'the-silmarillion', chapter: 'Of Beren and Lúthien' }, 'en')).toBe('Read this in The Silmarillion, “Of Beren and Lúthien”.');
    expect(readItInText({ book: 'the-silmarillion', chapter: 'Of Beren and Lúthien' }, 'es')).toBe('Léelo en El Silmarillion, «De Beren y Lúthien».');
    expect(chapterPhrase({ book: 'the-lord-of-the-rings', chapter: 'Appendix B' }, 'es')).toBe('Apéndice B');
    expect(readItInText({ book: 'the-hobbit' }, 'en')).toBe('Read this in The Hobbit.');
  });
  it('has a Spanish title for every chapter cited by name in content/', () => {
    const events = path.join(import.meta.dirname, '..', 'content', 'events');
    const missing = new Set<string>();
    for (const f of fs.readdirSync(events, { recursive: true }) as string[]) {
      if (!f.endsWith('event.yaml')) continue;
      const ch = (YAML.parse(fs.readFileSync(path.join(events, f), 'utf8')) as { source?: { chapter?: unknown } }).source?.chapter;
      if (typeof ch === 'string' && !(ch in CHAPTERS_ES)) missing.add(ch);
    }
    expect([...missing]).toEqual([]);
  });
});

describe('the opening', () => {
  it('follows the Ainulindalë: one line per stretch, then the invitation', () => {
    expect(stepAt(0)).toBe(0);
    expect(stepAt(0.2)).toBe(1);
    expect(stepAt(0.4)).toBe(2);
    expect(stepAt(0.7)).toBe(3);
    expect(stepAt(0.9)).toBe(4);
    expect(stepAt(INVITE_AT)).toBe(OPENING_STEPS.length);
    expect(stepAt(1)).toBe(OPENING_STEPS.length);
  });
  it('"Next" goes to the next line\'s moment, and from the last to the invitation', () => {
    for (let k = 0; k < OPENING_STEPS.length; k++) expect(stepAt(nextFrom(k))).toBe(k + 1);
  });
  it('counts unreadable storage as seen, so it never shows on every visit', () => {
    expect(openingSeen()).toBe(true); // no localStorage in Node
  });
});
