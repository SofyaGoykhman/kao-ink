import { describe, expect, it } from 'vitest';
import { artToBitmap, charDensity, countChars, fitToLimits, isDotArt, refitArt } from './format.ts';
import { imageToAscii } from './image.ts';

const BLANK = String.fromCodePoint(0x2800);

describe('charDensity', () => {
  it('counts Braille dots and block coverage', () => {
    expect(charDensity('⣿')).toBe(1);
    expect(charDensity(BLANK)).toBe(0);
    expect(charDensity('⠁')).toBe(1 / 8);
    expect(charDensity('▀')).toBe(0.5);
    expect(charDensity(' ')).toBe(0);
  });
});

describe('artToBitmap', () => {
  it('decodes Braille exactly', () => {
    const art = '⡇' + BLANK;
    const bitmap = artToBitmap(art);
    expect([bitmap.width, bitmap.height]).toEqual([4, 4]);
    expect(imageToAscii(bitmap, { columns: 2, mode: 'braille' }).text).toBe(art);
  });

  it('decodes half blocks', () => {
    const bitmap = artToBitmap('▀');
    expect(imageToAscii(bitmap, { columns: 1, mode: 'blocks', cellAspect: 2 }).text).toBe('▀');
  });
});

describe('refitArt', () => {
  const square = Array.from({ length: 8 }, () => '⣿'.repeat(16)).join('\n');

  it('scales a drawing to the requested width', () => {
    const half = refitArt(square, { columns: 8 });
    const lines = half.split('\n');
    expect(lines.every((l) => Array.from(l).length === 8)).toBe(true);
    expect(lines).toHaveLength(4);
  });

  it('converts plain ASCII into Braille with blank Braille padding', () => {
    const art = refitArt(' ### \n#####\n ### ', { columns: 10 });
    expect(art).not.toMatch(/ /);
    expect(art).toMatch(/⣿/);
  });
});

describe('fitToLimits', () => {
  const big = Array.from({ length: 40 }, () => '⣿'.repeat(60)).join('\n');

  it('narrows the drawing until it fits the character limit', () => {
    const result = fitToLimits(big, { columns: 30, maxChars: 500 });
    expect(result.fits).toBe(true);
    expect(result.chars).toBeLessThanOrEqual(500);
    expect(countChars(result.art)).toBe(result.chars);
    expect(result.columns).toBeLessThan(30);
  });

  it('keeps the platform width when the limit is generous', () => {
    expect(fitToLimits(big, { columns: 30, maxChars: 4096 }).columns).toBe(30);
  });
});

describe('isDotArt', () => {
  it('recognizes Braille and block drawings', () => {
    expect(isDotArt('⣿⣿⡇\n▀▄█')).toBe(true);
    expect(isDotArt(' /\\_/\\\n( o.o )')).toBe(false);
    expect(isDotArt('   ')).toBe(false);
  });
});
