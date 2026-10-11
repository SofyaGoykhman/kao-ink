import { describe, expect, it } from 'vitest';
import { trimArt } from './trim.ts';

describe('trimArt', () => {
  it('removes blank rows and shared blank columns', () => {
    expect(trimArt('      \n  /\\  \n /  \\ \n      ')).toBe(' /\\\n/  \\');
  });

  it('treats blank Braille as empty', () => {
    expect(trimArt('\u2800\u2800\u2800\n\u2800⣿\u2800')).toBe('⣿');
  });

  it('returns an empty string for a blank drawing', () => {
    expect(trimArt('  \n\u2800 ')).toBe('');
  });
});
