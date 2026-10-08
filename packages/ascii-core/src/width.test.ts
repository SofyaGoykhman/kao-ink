import { describe, expect, it } from 'vitest';
import { graphemeWidth, graphemes, measure, padEndToWidth, stringWidth } from './width.ts';

describe('graphemeWidth', () => {
  it('counts ASCII as one column', () => {
    expect(graphemeWidth('a')).toBe(1);
    expect(graphemeWidth('#')).toBe(1);
  });

  it('counts fullwidth and CJK as two columns', () => {
    expect(graphemeWidth('（')).toBe(2);
    expect(graphemeWidth('＾')).toBe(2);
    expect(graphemeWidth('ツ')).toBe(2);
    expect(graphemeWidth('漢')).toBe(2);
  });

  it('counts emoji, including ZWJ sequences and flags, as two columns', () => {
    expect(graphemeWidth('😀')).toBe(2);
    expect(graphemeWidth('👩‍💻')).toBe(2);
    expect(graphemeWidth('🇷🇺')).toBe(2);
    expect(graphemeWidth('♥️')).toBe(2);
  });

  it('keeps text-presentation symbols narrow', () => {
    expect(graphemeWidth('♥')).toBe(1);
  });

  it('treats ambiguous characters per option', () => {
    expect(graphemeWidth('ω')).toBe(1);
    expect(graphemeWidth('ω', { ambiguousAsWide: true })).toBe(2);
    expect(graphemeWidth('°', { ambiguousAsWide: true })).toBe(2);
  });

  it('gives zero width to controls and invisible format characters', () => {
    expect(graphemeWidth('​')).toBe(0);
    expect(graphemeWidth('\u0007')).toBe(0);
  });

  it('keeps base width for letters with combining marks', () => {
    expect(graphemes('é')).toHaveLength(1);
    expect(graphemeWidth('é')).toBe(1);
  });

  it('counts braille and block elements as one column', () => {
    expect(graphemeWidth('⣿')).toBe(1);
    expect(graphemeWidth('⠀')).toBe(1);
    expect(graphemeWidth('█')).toBe(1);
  });
});

describe('stringWidth', () => {
  it('measures kaomoji with mixed widths', () => {
    expect(stringWidth('(◕‿◕)')).toBe(5);
    expect(stringWidth('（＾▽＾）')).toBe(9);
    expect(stringWidth('¯\\_(ツ)_/¯')).toBe(10);
  });

  it('measures Cyrillic as one column per letter', () => {
    expect(stringWidth('привет')).toBe(6);
  });
});

describe('measure', () => {
  it('reports the widest line and the line count', () => {
    expect(measure('ab\r\nｗｉｄｅ\n')).toEqual({ width: 8, height: 3, lineWidths: [2, 8, 0] });
  });
});

describe('padEndToWidth', () => {
  it('pads by columns, not by string length', () => {
    expect(padEndToWidth('ツ', 4)).toBe('ツ  ');
    expect(padEndToWidth('long', 2)).toBe('long');
  });
});
