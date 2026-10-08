import categoriesJson from '@data/kaomoji/categories.json';
import kaomojiJson from '@data/kaomoji/kaomoji.json';

export interface KaomojiCategory {
  slug: string;
  group: 'emotion' | 'action' | 'character' | 'other';
  ru: string;
  en: string;
}

export interface Kaomoji {
  id: string;
  text: string;
  /** Category slugs; the first one is primary. */
  tags: string[];
  source: string;
}

export const categories = categoriesJson as KaomojiCategory[];
export const kaomoji = kaomojiJson as Kaomoji[];
export const kaomojiGroups = ['emotion', 'action', 'character', 'other'] as const;

export function kaomojiIn(slug: string): Kaomoji[] {
  return kaomoji.filter((k) => k.tags.includes(slug));
}
