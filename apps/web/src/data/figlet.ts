import figlet from 'figlet';
import fontsJson from '@data/figlet/fonts.json';

export interface FigletFontInfo {
  id: string;
  name: string;
  license: 'figlet-bsd' | 'permission' | 'wtfpl' | 'mit' | 'free';
  /** Whether the font draws Cyrillic letters. */
  cyrillic: boolean;
  height: number;
}

export const figletFonts = fontsJson as FigletFontInfo[];
export const DEFAULT_FONT = 'standard';

const fontFiles = import.meta.glob<string>('../../../../data/figlet/fonts/*.flf', {
  query: '?raw',
  import: 'default',
});

const loaded = new Map<string, Promise<void>>();

/** Fetches a font file once and registers it with figlet under its id. */
export function loadFigletFont(id: string): Promise<void> {
  let promise = loaded.get(id);
  if (!promise) {
    const load = fontFiles[`../../../../data/figlet/fonts/${id}.flf`];
    if (!load) return Promise.reject(new Error(`Unknown FIGlet font "${id}"`));
    promise = load().then((data) => {
      figlet.parseFont(id, data);
    });
    loaded.set(id, promise);
  }
  return promise;
}

/** Renders text with a font that loadFigletFont has already loaded. */
export function renderFiglet(text: string, id: string, width?: number): string {
  const art = figlet.textSync(text, { font: id, width, whitespaceBreak: true });
  // Drop trailing spaces and blank lines so the result copies cleanly.
  return art
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}
