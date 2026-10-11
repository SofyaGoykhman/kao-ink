import { describe, expect, it } from 'vitest';
import { matchesStem, normalizeText, stem, stems, tokenize } from './search.ts';

describe('normalizeText', () => {
  it('lowercases, folds ё and strips Latin accents', () => {
    expect(normalizeText('Звёздочка Café')).toBe('звездочка cafe');
  });

  it('keeps Cyrillic й', () => {
    expect(normalizeText('Йод')).toBe('йод');
  });
});

describe('tokenize', () => {
  it('splits on punctuation and spaces', () => {
    expect(tokenize('стрелка «налево», left-pointing')).toEqual([
      'стрелка',
      'налево',
      'left',
      'pointing',
    ]);
  });
});

describe('stem', () => {
  it('joins Russian word forms', () => {
    expect(stem('сердечко')).toBe(stem('сердечки'));
    expect(stem('звезды')).toBe(stem('звезда'));
    expect(stem('стрелками')).toBe(stem('стрелка'));
  });

  it('joins English plurals', () => {
    expect(stem('hearts')).toBe('heart');
    expect(stem('crosses')).toBe('cross');
    expect(stem('cross')).toBe('cross');
  });

  it('keeps short words intact', () => {
    expect(stem('кот')).toBe('кот');
    expect(stem('sun')).toBe('sun');
  });
});

describe('matchesStem', () => {
  const indexed = stems('сердце червы heart suit');

  it('matches word forms and prefixes', () => {
    expect(matchesStem(stem('сердца'), indexed)).toBe(true);
    expect(matchesStem(stem('серд'), indexed)).toBe(true);
    expect(matchesStem(stem('hearts'), indexed)).toBe(true);
  });

  it('requires whole words for very short queries', () => {
    expect(matchesStem('се', indexed)).toBe(false);
  });
});
