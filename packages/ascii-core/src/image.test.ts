import { describe, expect, it } from 'vitest';
import { imageToAscii, type Bitmap } from './image.ts';

/** Builds an RGBA bitmap from a function returning gray (0 black … 255 white). */
function bitmap(width: number, height: number, gray: (x: number, y: number) => number): Bitmap {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = gray(x, y);
      data.set([v, v, v, 255], i);
    }
  }
  return { width, height, data };
}

const white = bitmap(8, 8, () => 255);
const black = bitmap(8, 8, () => 0);

describe('imageToAscii', () => {
  it('derives rows from the image and cell aspect ratios', () => {
    expect(
      imageToAscii(
        bitmap(100, 50, () => 255),
        { columns: 20 },
      ).rows,
    ).toBe(5);
    expect(
      imageToAscii(
        bitmap(100, 50, () => 255),
        { columns: 20, cellAspect: 1 },
      ).rows,
    ).toBe(10);
  });

  it('maps white to the first ramp character and black to the last', () => {
    expect(imageToAscii(white, { columns: 4, cellAspect: 1 }).lines[0]).toBe('    ');
    expect(imageToAscii(black, { columns: 4, cellAspect: 1 }).lines[0]).toBe('@@@@');
  });

  it('swaps light and dark when inverted', () => {
    expect(imageToAscii(white, { columns: 2, cellAspect: 1, invert: true }).lines[0]).toBe('@@');
  });

  it('treats transparent pixels as white', () => {
    const clear = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    expect(imageToAscii(clear, { columns: 2, cellAspect: 1 }).lines[0]).toBe('  ');
  });

  it('uses a custom ramp of any characters', () => {
    expect(imageToAscii(black, { columns: 2, cellAspect: 1, ramp: '░▒▓█' }).lines[0]).toBe('██');
  });

  it('draws half blocks for top and bottom halves', () => {
    const topBlack = bitmap(2, 4, (_, y) => (y < 2 ? 0 : 255));
    expect(imageToAscii(topBlack, { columns: 1, mode: 'blocks', cellAspect: 4 }).text).toBe('▀');
  });

  it('draws quadrant blocks', () => {
    const diagonal = bitmap(4, 4, (x, y) => (x < 2 === y < 2 ? 0 : 255));
    expect(imageToAscii(diagonal, { columns: 1, mode: 'quadrants', cellAspect: 1 }).text).toBe('▚');
  });

  it('draws Braille dots and keeps empty cells as blank Braille', () => {
    const leftColumn = bitmap(4, 4, (x) => (x === 0 ? 0 : 255));
    const art = imageToAscii(leftColumn, { columns: 2, mode: 'braille', cellAspect: 2 });
    expect(art.text).toBe('⡇\u2800');
    expect(
      imageToAscii(leftColumn, { columns: 2, mode: 'braille', cellAspect: 2, blankBraille: false })
        .text,
    ).toBe('⡇ ');
  });

  it('fills a black image with full Braille cells', () => {
    expect(imageToAscii(black, { columns: 2, mode: 'braille' }).lines[0]).toBe('⣿⣿');
  });

  it('dithers mid gray into a mix of dots', () => {
    const gray = bitmap(64, 64, () => 128);
    const plain = imageToAscii(gray, {
      columns: 32,
      mode: 'braille',
      cellAspect: 2,
      threshold: 0.6,
    });
    const dithered = imageToAscii(gray, {
      columns: 32,
      mode: 'braille',
      cellAspect: 2,
      dither: 'floyd-steinberg',
    });
    const dots = (text: string) =>
      Array.from(text).reduce((n, ch) => {
        const bits = (ch.codePointAt(0) ?? 0) - 0x2800;
        return n + (bits >= 0 && bits < 256 ? bits.toString(2).replaceAll('0', '').length : 0);
      }, 0);
    expect(dots(plain.text)).toBe(0);
    const ratio = dots(dithered.text) / (64 * 64);
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('draws contours with matching line characters', () => {
    const vertical = bitmap(8, 8, (x) => (x < 4 ? 0 : 255));
    const horizontal = bitmap(8, 8, (_, y) => (y < 4 ? 0 : 255));
    const diagonal = bitmap(8, 8, (x, y) => (x + y < 8 ? 0 : 255));
    const edges = (b: Bitmap) => imageToAscii(b, { columns: 8, mode: 'edges', cellAspect: 1 }).text;
    expect(edges(vertical)).toMatch(/\|/);
    expect(edges(vertical)).not.toMatch(/[-/\\]/);
    expect(edges(horizontal)).toMatch(/-/);
    expect(edges(horizontal)).not.toMatch(/[|/\\]/);
    expect(edges(diagonal)).toMatch(/\//);
    expect(edges(white)).toBe(edges(white).replace(/\S/g, ' '));
  });

  it('returns nothing for an empty image', () => {
    expect(imageToAscii({ width: 0, height: 0, data: [] }, { columns: 10 }).text).toBe('');
  });
});
