import { matchesStem, stems } from '@kaomoji/ascii-core';

/** Shape of data/unicode/out/search.json (see buildSearchIndex in data/unicode/build.mjs). */
export interface SymbolSearchIndex {
  blocks: string[];
  concepts: { id: string; ru: string[]; en: string[]; chars: string[]; like: string[] }[];
  chars: [char: string, block: number, words: string, ru: string, en: string][];
}

export interface SymbolHit {
  char: string;
  block: string;
  ru: string;
  en: string;
}

interface PreparedChar extends SymbolHit {
  stems: string[];
}

interface PreparedConcept {
  stems: string[];
  chars: string[];
  like: string[];
}

/** Symbols that depict a concept rank above those that resemble it, then name matches. */
const DEPICTS = 100;
const RESEMBLES = 50;

export class SymbolSearch {
  private readonly chars: PreparedChar[];
  private readonly concepts: PreparedConcept[];

  constructor(index: SymbolSearchIndex) {
    this.chars = index.chars.map(([char, block, words, ru, en]) => ({
      char,
      block: index.blocks[block] ?? '',
      ru,
      en,
      stems: stems(words),
    }));
    this.concepts = index.concepts.map((c) => ({
      stems: stems([...c.ru, ...c.en].join(' ')),
      chars: c.chars,
      like: c.like,
    }));
  }

  /** Every query word must match the character's own words or one of its concepts. */
  search(query: string, limit = 300): { hits: SymbolHit[]; total: number } {
    const queryStems = stems(query);
    if (queryStems.length === 0) return { hits: [], total: 0 };
    const all = (1 << queryStems.length) - 1;
    const maskOf = (indexed: string[]) =>
      queryStems.reduce((mask, q, i) => (matchesStem(q, indexed) ? mask | (1 << i) : mask), 0);

    const conceptMask = new Map<string, number>();
    const conceptScore = new Map<string, number>();
    for (const concept of this.concepts) {
      const mask = maskOf(concept.stems);
      if (!mask) continue;
      const add = (char: string, score: number) => {
        conceptMask.set(char, (conceptMask.get(char) ?? 0) | mask);
        conceptScore.set(char, Math.max(conceptScore.get(char) ?? 0, score));
      };
      for (const char of concept.chars) add(char, DEPICTS);
      for (const char of concept.like) add(char, RESEMBLES);
    }

    const scored: { hit: PreparedChar; score: number; order: number }[] = [];
    this.chars.forEach((c, order) => {
      const own = maskOf(c.stems);
      if (((own | (conceptMask.get(c.char) ?? 0)) & all) !== all) return;
      const ownCount = queryStems.filter((_, i) => own & (1 << i)).length;
      scored.push({ hit: c, score: (conceptScore.get(c.char) ?? 0) + ownCount, order });
    });
    scored.sort((a, b) => b.score - a.score || a.order - b.order);
    return {
      hits: scored
        .slice(0, limit)
        .map(({ hit: { char, block, ru, en } }) => ({ char, block, ru, en })),
      total: scored.length,
    };
  }
}
