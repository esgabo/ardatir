// How to say a hard name (docs/DESIGN.md §3.5): an optional `pronounce: { en, es }` on
// characters, places, ages and events, written as a simple respelling for readers of that
// language, syllables joined by hyphens, the stressed one in capitals: `ee-LOO-va-tar`
// (English readers), `i-LÚ-va-tar` (Spanish readers). Words are separated by spaces, and each
// word has exactly one stressed syllable: `MEE-nas TEE-rith`. Pure: used by the content build
// (validation) and the site (the small hint beside a name).

export interface Syllable {
  text: string;
  stressed: boolean;
}

const isUpper = (s: string) => s === s.toUpperCase() && s !== s.toLowerCase();
const isLower = (s: string) => s === s.toLowerCase();

/** What is wrong with a respelling, or undefined when it is well formed. */
export function pronounceProblem(s: string): string | undefined {
  if (!s.trim()) return 'empty';
  if (!/^[\p{L}' -]+$/u.test(s)) return 'only letters, hyphens between syllables, spaces between words';
  for (const word of s.trim().split(/\s+/)) {
    const syl = word.split('-');
    if (syl.some((x) => !x || !/\p{L}/u.test(x))) return `"${word}": an empty syllable (doubled or stray hyphen)`;
    if (syl.some((x) => !isUpper(x) && !isLower(x))) return `"${word}": a syllable is either all capitals (stressed) or all small letters`;
    const stressed = syl.filter(isUpper).length;
    if (stressed !== 1) return `"${word}": needs exactly one stressed syllable in CAPITALS, got ${stressed}`;
  }
  return undefined;
}

/** A respelling as words of syllables, for display: `MEE-nas TEE-rith` → [[MEE*, nas], [TEE*, rith]]. */
export function syllables(s: string): Syllable[][] {
  return s.trim().split(/\s+/).map((w) => w.split('-').map((text) => ({ text, stressed: isUpper(text) })));
}
