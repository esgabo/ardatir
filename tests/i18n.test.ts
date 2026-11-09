// Interface strings built from content ids (src/i18n.ts): every character `kind` and kin
// relation (`kin[].as`) used in content/ needs English and Spanish, or raw ids show.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { hasText, kinPhrase } from '../src/i18n.ts';
import { LANGS } from '../src/data/types.ts';

const dir = path.join(__dirname, '..', 'content', 'characters');
const characters = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml'))
  .map((f) => YAML.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { kind?: string; kin?: { as: string }[] });

describe('interface strings for content ids', () => {
  it('every character kind in content/ has en and es', () => {
    const kinds = [...new Set(characters.map((c) => c.kind).filter((k): k is string => !!k))];
    expect(kinds.filter((k) => LANGS.some((L) => !hasText(`kind_${k}`, L)))).toEqual([]);
  });

  it('every kin relation in content/ has an en and es phrase', () => {
    const rels = [...new Set(characters.flatMap((c) => c.kin ?? []).map((k) => k.as))];
    expect(rels.filter((r) => LANGS.some((L) => !hasText(`kin_${r}`, L)))).toEqual([]);
  });

  it('kin phrases: gendered Spanish from the English word, neutral where it has none', () => {
    expect(kinPhrase('betrothed', 'Arwen', 'Aragorn', 'en')).toBe('Arwen, betrothed of Aragorn');
    expect(kinPhrase('betrothed', 'Arwen', 'Aragorn', 'es')).toBe('Arwen y Aragorn, prometidos');
    expect(kinPhrase('sister', 'Lalaith', 'Túrin', 'es')).toBe('Lalaith, hermana de Túrin');
    expect(kinPhrase('cousin', 'Túrin', 'Tuor', 'es')).toBe('Túrin y Tuor, primos');
    expect(kinPhrase('foster-father', 'Thingol', 'Túrin', 'en')).toBe('Thingol, foster father of Túrin');
    expect(kinPhrase('foster-father', 'Thingol', 'Túrin', 'es')).toBe('Thingol, pariente de Túrin');
  });
});
