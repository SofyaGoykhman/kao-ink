import { describe, expect, it } from 'vitest';
import {
  fancyStyles,
  supportsChar,
  toFancy,
  unsupportedChars,
  type FancyStyleId,
} from './fancy.ts';

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

describe('fancyStyles', () => {
  it('has unique ids and both labels', () => {
    const ids = fancyStyles.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of fancyStyles) {
      expect(s.ru).toMatch(/[а-яё]/i);
      expect(s.en).toMatch(/[a-z]/i);
    }
  });

  it('never produces unassigned code points (math alphabet holes are filled)', () => {
    for (const { id } of fancyStyles) {
      const out = toFancy(ALNUM, id);
      expect(out, id).not.toMatch(/\p{Cn}/u);
    }
  });

  it('marks Cyrillic support only for styles that transform Cyrillic', () => {
    for (const { id, cyrillic } of fancyStyles) {
      expect(toFancy('ж', id) !== 'ж', id).toBe(cyrillic);
      expect(supportsChar(id, 'ж'), id).toBe(cyrillic);
    }
  });
});

describe('toFancy', () => {
  const cases: [FancyStyleId, string, string][] = [
    ['bold', 'Bold 123', '𝐁𝐨𝐥𝐝 𝟏𝟐𝟑'],
    ['italic', 'hush', 'ℎ𝑢𝑠ℎ'],
    ['bold-italic', 'Ab', '𝑨𝒃'],
    ['script', 'BEFHILMR ego', 'ℬℰℱℋℐℒℳℛ ℯℊℴ'],
    ['script', 'Script', '𝒮𝒸𝓇𝒾𝓅𝓉'],
    ['bold-script', 'bold', '𝓫𝓸𝓵𝓭'],
    ['fraktur', 'CHIRZ ok', 'ℭℌℑℜℨ 𝔬𝔨'],
    ['fraktur', 'fraktur', '𝔣𝔯𝔞𝔨𝔱𝔲𝔯'],
    ['bold-fraktur', 'Ab', '𝕬𝖇'],
    ['double-struck', 'CHNPQRZ', 'ℂℍℕℙℚℝℤ'],
    ['double-struck', 'double 42', '𝕕𝕠𝕦𝕓𝕝𝕖 𝟜𝟚'],
    ['sans', 'sans 1', '𝗌𝖺𝗇𝗌 𝟣'],
    ['sans-bold', 'Ab1', '𝗔𝗯𝟭'],
    ['sans-italic', 'Ab', '𝘈𝘣'],
    ['sans-bold-italic', 'Ab', '𝘼𝙗'],
    ['monospace', 'mono 0', '𝚖𝚘𝚗𝚘 𝟶'],
    ['fullwidth', 'full width!', 'ｆｕｌｌ　ｗｉｄｔｈ！'],
    ['circled', 'Circled 10', 'Ⓒⓘⓡⓒⓛⓔⓓ ①⓪'],
    ['circled-negative', 'Circled 10', '🅒🅘🅡🅒🅛🅔🅓 ❶⓿'],
    ['squared', 'Boxed', '🄱🄾🅇🄴🄳'],
    ['squared-negative', 'ab', '🅰🅱'],
    ['parenthesized', 'aZ1', '⒜🄩⑴'],
    ['small-caps', 'small caps', 'ꜱᴍᴀʟʟ ᴄᴀᴘꜱ'],
    ['superscript', 'x2+1 Hi', 'ˣ²⁺¹ ᴴⁱ'],
    ['subscript', 'H2O', 'ₕ₂ₒ'],
    ['upside-down', 'Hello, world!', "¡plɹoʍ 'ollǝH"],
    ['strikethrough', 'ab', 'a̶b̶'],
    ['underline', 'Да', 'Д̲а̲'],
  ];

  it.each(cases)('%s: %s', (style, input, expected) => {
    expect(toFancy(input, style)).toBe(expected);
  });

  it('passes unmapped characters through unchanged', () => {
    expect(toFancy('Привет, (◕‿◕)!', 'bold')).toBe('Привет, (◕‿◕)!');
    expect(toFancy('q', 'superscript')).toBe('q');
  });

  it('rotates multi-line text by 180 degrees', () => {
    expect(toFancy('ab\ncd', 'upside-down')).toBe('pɔ\nqɐ');
  });

  it('keeps grapheme clusters intact when rotating', () => {
    expect(toFancy('a👩‍💻e\u0301', 'upside-down')).toBe('ǝ\u0301👩‍💻ɐ');
  });

  it('decorates graphemes but not line breaks', () => {
    expect(toFancy('a\nb', 'strikethrough')).toBe('a̶\nb̶');
    expect(toFancy('é', 'underline')).toBe('é̲');
  });
});

describe('supportsChar / unsupportedChars', () => {
  it('reports whether a character is transformed', () => {
    expect(supportsChar('bold', 'a')).toBe(true);
    expect(supportsChar('bold', 'я')).toBe(false);
    expect(supportsChar('italic', '1')).toBe(false);
    expect(supportsChar('strikethrough', 'я')).toBe(true);
    expect(supportsChar('strikethrough', ' ')).toBe(false);
  });

  it('lists letters and digits left unchanged', () => {
    expect(unsupportedChars('Hi Мир 2!', 'script')).toEqual(['М', 'и', 'р', '2']);
    expect(unsupportedChars('Hi Мир', 'underline')).toEqual([]);
    expect(unsupportedChars('Small Caps', 'small-caps')).toEqual([]);
  });
});
