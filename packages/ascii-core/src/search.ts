/**
 * Small search helpers for Russian and English text: normalization, tokenizing and a light
 * suffix-stripping stemmer, so that «сердечки» finds «сердечко» and "hearts" finds "heart".
 */

/** Lowercases, folds ё to е and strips accents from Latin letters. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/(\p{Script=Latin})\p{M}+/gu, '$1')
    .normalize('NFC');
}

/** Splits normalized text into words of letters and digits. */
export function tokenize(text: string): string[] {
  return normalizeText(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

// Longest first, so «ами» is tried before «и».
const RU_ENDINGS = [
  'иями',
  'ями',
  'ами',
  'ого',
  'его',
  'ому',
  'ему',
  'ыми',
  'ими',
  'иях',
  'ах',
  'ях',
  'ов',
  'ев',
  'ей',
  'ой',
  'ий',
  'ый',
  'ая',
  'яя',
  'ое',
  'ее',
  'ые',
  'ие',
  'ую',
  'юю',
  'ом',
  'ем',
  'ам',
  'ям',
  'а',
  'я',
  'о',
  'е',
  'и',
  'ы',
  'у',
  'ю',
  'ь',
  'й',
];
const EN_ENDINGS = ['ies', 'es', 's'];
const MIN_STEM = 3;

/** Strips one inflectional ending, keeping at least three letters. */
export function stem(word: string): string {
  const endings = /\p{Script=Cyrillic}/u.test(word) ? RU_ENDINGS : EN_ENDINGS;
  for (const ending of endings) {
    if (word.length - ending.length >= MIN_STEM && word.endsWith(ending)) {
      if (ending === 's' && word.endsWith('ss')) return word;
      return word.slice(0, -ending.length);
    }
  }
  return word;
}

/** Stems of every word in `text`, deduplicated. */
export function stems(text: string): string[] {
  return [...new Set(tokenize(text).map(stem))];
}

/**
 * Whether a query stem matches any of the indexed stems. Short queries must match a whole
 * word; longer ones also match as a prefix, so «серд» finds «сердце» while typing.
 */
export function matchesStem(queryStem: string, indexed: readonly string[]): boolean {
  if (queryStem.length < MIN_STEM) return indexed.includes(queryStem);
  return indexed.some((s) => s.startsWith(queryStem));
}
