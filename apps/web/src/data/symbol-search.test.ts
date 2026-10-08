import { describe, expect, it } from 'vitest';
import { SymbolSearch, type SymbolSearchIndex } from './symbol-search';

const index: SymbolSearchIndex = {
  blocks: ['misc', 'georgian'],
  concepts: [
    {
      id: 'heart',
      ru: ['сердце', 'сердечко'],
      en: ['heart', 'love'],
      chars: ['♡'],
      like: ['ღ'],
    },
  ],
  chars: [
    ['ღ', 1, 'georgian letter ghan', 'грузинская буква', 'georgian letter ghan'],
    ['♡', 0, 'white heart suit', 'черви', 'white heart suit'],
    ['♥', 0, 'black heart suit червы', 'червы', 'heart suit'],
    ['→', 0, 'rightwards arrow стрелка вправо', 'стрелка вправо', 'right arrow'],
  ],
};

const chars = (query: string) => new SymbolSearch(index).search(query).hits.map((h) => h.char);

describe('SymbolSearch', () => {
  it('ranks depicting, then resembling, then name matches', () => {
    expect(chars('heart')).toEqual(['♡', 'ღ', '♥']);
  });

  it('finds concept chars by Russian word forms', () => {
    expect(chars('сердечки')).toEqual(['♡', 'ღ']);
  });

  it('requires every query word to match', () => {
    expect(chars('стрелка вправо')).toEqual(['→']);
    expect(chars('стрелка влево')).toEqual([]);
  });

  it('returns nothing for an empty query', () => {
    expect(new SymbolSearch(index).search('  ').total).toBe(0);
  });
});
