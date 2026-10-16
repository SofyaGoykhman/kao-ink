import { imageToAscii, type AsciiMode, type Bitmap } from './image.ts';
import { trimArt } from './trim.ts';
import { graphemes, splitLines } from './width.ts';

/**
 * Re-fitting existing text art: the drawing is decoded into a black-and-white pixel grid
 * (exactly for Braille and block characters, by ink density for everything else), then
 * re-encoded at the requested width.
 */

const BRAILLE_BASE = 0x2800;
// Pixel offset [x, y] of each Braille dot bit.
const BRAILLE_DOTS: [number, number][] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 0],
  [1, 1],
  [1, 2],
  [0, 3],
  [1, 3],
];

// Block elements as 2×4 pixel masks, rows top to bottom, two bits per row (left, right).
const BLOCKS: Record<string, string> = {
  '█': '11111111',
  '▀': '11110000',
  '▄': '00001111',
  '▌': '10101010',
  '▐': '01010101',
  '▘': '10100000',
  '▝': '01010000',
  '▖': '00001010',
  '▗': '00000101',
  '▚': '10100101',
  '▞': '01011010',
  '▛': '11111010',
  '▜': '11110101',
  '▙': '10101111',
  '▟': '01011111',
  '▔': '11000000',
  '▁': '00000011',
  '▏': '10101010',
  '▕': '01010101',
};

// Rough ink coverage of common ASCII and shading characters, 0…1.
const DENSITY: Record<string, number> = {
  ' ': 0,
  '\u00a0': 0,
  '.': 0.1,
  ',': 0.1,
  "'": 0.1,
  '`': 0.1,
  ':': 0.2,
  ';': 0.25,
  '-': 0.2,
  _: 0.2,
  '~': 0.25,
  '"': 0.2,
  '^': 0.2,
  '!': 0.3,
  '|': 0.35,
  '/': 0.35,
  '\\': 0.35,
  '(': 0.35,
  ')': 0.35,
  '<': 0.3,
  '>': 0.3,
  '=': 0.4,
  '+': 0.4,
  '*': 0.45,
  '░': 0.25,
  '▒': 0.5,
  '▓': 0.75,
  '#': 0.7,
  '%': 0.7,
  '&': 0.7,
  $: 0.7,
  '@': 0.85,
  M: 0.75,
  W: 0.75,
};
const DEFAULT_DENSITY = 0.55;

/** How dark a character looks, 0…1. */
export function charDensity(char: string): number {
  const cp = char.codePointAt(0) ?? 0;
  if (cp >= BRAILLE_BASE && cp <= BRAILLE_BASE + 0xff) {
    const bits = cp - BRAILLE_BASE;
    let dots = 0;
    for (let b = bits; b; b >>= 1) dots += b & 1;
    return dots / 8;
  }
  const block = BLOCKS[char];
  if (block) return [...block].filter((b) => b === '1').length / 8;
  return DENSITY[char] ?? (/\s/u.test(char) ? 0 : DEFAULT_DENSITY);
}

/**
 * Decodes text art into a bitmap with 2×4 pixels per character cell. Braille and block
 * characters keep their exact dot patterns; other characters become a gray level by density.
 */
export function artToBitmap(art: string): Bitmap {
  const rows = splitLines(art).map(graphemes);
  const columns = Math.max(1, ...rows.map((r) => r.length));
  const width = columns * 2;
  const height = Math.max(1, rows.length) * 4;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const set = (x: number, y: number, ink: number) => {
    const v = Math.round(255 * (1 - ink));
    data.set([v, v, v, 255], (y * width + x) * 4);
  };
  rows.forEach((row, ry) => {
    row.forEach((char, rx) => {
      const x0 = rx * 2;
      const y0 = ry * 4;
      const cp = char.codePointAt(0) ?? 0;
      if (cp >= BRAILLE_BASE && cp <= BRAILLE_BASE + 0xff) {
        BRAILLE_DOTS.forEach(([dx, dy], bit) => {
          if ((cp - BRAILLE_BASE) & (1 << bit)) set(x0 + dx, y0 + dy, 1);
        });
        return;
      }
      const block = BLOCKS[char];
      if (block) {
        [...block].forEach((b, i) => b === '1' && set(x0 + (i % 2), y0 + Math.floor(i / 2), 1));
        return;
      }
      const ink = charDensity(char);
      if (ink > 0) for (let i = 0; i < 8; i++) set(x0 + (i % 2), y0 + Math.floor(i / 2), ink);
    });
  });
  return { width, height, data };
}

/**
 * Whether a drawing is made of dot or block characters (Braille, ▀▄█▚…), which decode
 * exactly. Line art made of ordinary characters is better rasterized with a real font.
 */
export function isDotArt(art: string): boolean {
  const chars = graphemes(art).filter((g) => !/^\s$/u.test(g));
  if (chars.length === 0) return false;
  const dots = chars.filter((g) => {
    const cp = g.codePointAt(0) ?? 0;
    return (cp >= BRAILLE_BASE && cp <= BRAILLE_BASE + 0xff) || g in BLOCKS;
  });
  return dots.length / chars.length >= 0.7;
}

export interface RefitOptions {
  /** Target width in characters. */
  columns: number;
  mode?: Extract<AsciiMode, 'braille' | 'blocks' | 'quadrants' | 'ramp'>;
  /** Ink level above which a dot is set, 0…1. */
  threshold?: number;
  invert?: boolean;
  /** Use U+2800 for empty Braille cells (keeps alignment in proportional fonts). */
  blankBraille?: boolean;
  /**
   * A rendering of the drawing to use instead of decoding its characters, e.g. the text
   * drawn with a real font on a canvas. Its aspect ratio should match the drawing.
   */
  bitmap?: Bitmap;
}

/** Re-renders a drawing at a new width, cropping empty margins. */
export function refitArt(art: string, options: RefitOptions): string {
  const bitmap = options.bitmap ?? artToBitmap(trimArt(art));
  // Decoded cells are 2×4 pixels, so a 2:1 cell aspect keeps proportions.
  return trimArt(
    imageToAscii(bitmap, {
      columns: options.columns,
      mode: options.mode ?? 'braille',
      cellAspect: 2,
      threshold: options.threshold ?? 0.3,
      invert: options.invert,
      blankBraille: options.blankBraille ?? true,
      dither: 'none',
    }).text,
  );
}

/** Characters a platform counts: code points, with each line break counting as one. */
export function countChars(text: string): number {
  return Array.from(text).length;
}

export interface PlatformLimits {
  /** Widest line that fits a phone screen, in Braille cells. */
  columns: number;
  /** Maximum characters in one message / caption / post. */
  maxChars: number;
}

/**
 * Line widths in Braille cells, calibrated on an iPhone (2026-10, /formatter/calibrate):
 * - Telegram: 28 cells fill a Saved Messages bubble; 26 leaves room for narrower chats.
 * - Instagram caption: 38 cells fit the caption editor; 34 keeps a margin.
 * - Threads: 36 cells fit the thread view, about 31 the indented feed; 30 is safe.
 * Blank Braille (U+2800) kept drawings intact in all three, while spaces and block
 * characters drifted, and Telegram turned lines starting with ">" into quotes.
 * Android has not been measured yet.
 */
export const PLATFORMS = {
  telegram: { columns: 26, maxChars: 4096 },
  'instagram-post': { columns: 34, maxChars: 2200 },
  threads: { columns: 30, maxChars: 500 },
} satisfies Record<string, PlatformLimits>;

export type Platform = keyof typeof PLATFORMS;

export interface FitResult {
  art: string;
  columns: number;
  chars: number;
  /** False when even the narrowest attempt exceeds the character limit. */
  fits: boolean;
}

/**
 * Fits a drawing into a platform's width and character limit: tries the requested width and
 * narrows it until the result is short enough.
 */
export function fitToLimits(
  art: string,
  limits: PlatformLimits,
  options: Omit<RefitOptions, 'columns'> & { columns?: number; minColumns?: number } = {},
): FitResult {
  const minColumns = options.minColumns ?? 8;
  let columns = Math.min(options.columns ?? limits.columns, limits.columns);
  let result = refitArt(art, { ...options, columns });
  while (countChars(result) > limits.maxChars && columns > minColumns) {
    columns--;
    result = refitArt(art, { ...options, columns });
  }
  const chars = countChars(result);
  return { art: result, columns, chars, fits: chars <= limits.maxChars };
}
