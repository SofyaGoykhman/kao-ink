import blocksJson from '@data/unicode/out/blocks.json';

/** Navigation order: symbol-like groups first, writing systems last. */
export const groupOrder = [
  'symbols',
  'arrows',
  'math',
  'shapes',
  'box-drawing',
  'technical',
  'punctuation',
  'games',
  'emoji',
  'other',
  'scripts',
  'cjk',
] as const;

export type UnicodeGroup = (typeof groupOrder)[number];

export interface UnicodeBlock {
  id: string;
  name: string;
  ru: string;
  range: [number, number];
  count: number;
  group: UnicodeGroup;
  /** Algorithmic-name block without a per-character file. */
  lazy?: boolean;
}

export interface UnicodeChar {
  cp: number;
  char: string;
  name: string;
  ru: string | null;
  en: string | null;
  keywords: { ru: string[]; en: string[] };
  /** Russian characteristics translated from the Unicode name. */
  desc: string[];
  /** Search concepts the character depicts or resembles. */
  concepts: string[];
}

/** Human label for a character in the page language. */
export function charLabel(c: UnicodeChar, lang: 'ru' | 'en'): string {
  if (lang === 'ru') return c.ru ?? (c.desc.length ? c.desc.join(', ') : c.name.toLowerCase());
  return c.en ?? c.name.toLowerCase();
}

export const blocks = blocksJson as UnicodeBlock[];

const blockFiles = import.meta.glob<UnicodeChar[]>('../../../../data/unicode/out/blocks/*.json', {
  import: 'default',
});

export async function loadBlockChars(id: string): Promise<UnicodeChar[]> {
  const load = blockFiles[`../../../../data/unicode/out/blocks/${id}.json`];
  if (!load) throw new Error(`No character file for block "${id}"`);
  return load();
}

export function formatCodePoint(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}
