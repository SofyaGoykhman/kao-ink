import { graphemes, splitLines } from './width.ts';

/**
 * "Fancy text": Latin letters and digits re-spelled with styled Unicode characters
 * (Mathematical Alphanumeric Symbols, Letterlike Symbols, fullwidth, enclosed forms,
 * modifier letters) or decorated with combining marks.
 *
 * Characters a style has no mapping for pass through unchanged. Only the combining-mark
 * styles work for Cyrillic: Unicode has no styled Cyrillic alphabets.
 */
export interface FancyStyle {
  id: FancyStyleId;
  ru: string;
  en: string;
  /** True when Cyrillic letters are transformed too. */
  cyrillic: boolean;
}

interface StyleDef {
  id: string;
  ru: string;
  en: string;
  cyrillic: boolean;
  /** Per-code-point replacements. */
  map?: ReadonlyMap<string, string>;
  /** Combining mark appended after every grapheme (except line breaks). */
  mark?: string;
  /** Rotate the result by 180°: reverse graphemes in each line and the line order. */
  rotate?: boolean;
}

type Pairs = [from: string, to: string][];

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

const cp = (code: number): string => String.fromCodePoint(code);

/** Maps each char of `from` to consecutive code points starting at `start`. */
function run(from: string, start: number): Pairs {
  return Array.from(from, (ch, i) => [ch, cp(start + i)]);
}

/** Zips two equal-length strings (by code point) into pairs. */
function zip(from: string, to: string): Pairs {
  const a = Array.from(from);
  const b = Array.from(to);
  if (a.length !== b.length) throw new Error(`fancy: length mismatch for "${from}"`);
  return a.map((ch, i) => [ch, b[i]!]);
}

/** Splits "aAbB…" into [a, A], [b, B], … pairs (by code point). */
function pairs(list: string): Pairs {
  const chars = Array.from(list);
  return chars.flatMap((ch, i): Pairs => (i % 2 === 0 ? [[ch, chars[i + 1]!]] : []));
}

/**
 * A Mathematical Alphanumeric Symbols alphabet. Some letters were encoded earlier in
 * Letterlike Symbols, leaving reserved holes in the math block; `holes` fills them.
 */
function math(
  upper: number,
  lower: number,
  digits?: number,
  holes: Pairs = [],
): Map<string, string> {
  const map = new Map([...run(UPPER, upper), ...run(LOWER, lower), ...holes]);
  if (digits !== undefined) for (const [from, to] of run(DIGITS, digits)) map.set(from, to);
  return map;
}

const ITALIC_HOLES = pairs('hℎ');
const SCRIPT_HOLES = pairs('BℬEℰFℱHℋIℐLℒMℳRℛeℯgℊoℴ');
const FRAKTUR_HOLES = pairs('CℭHℌIℑRℜZℨ');
const DOUBLE_STRUCK_HOLES = pairs('CℂHℍNℕPℙQℚRℝZℤ');

/** Fullwidth Forms: U+FF01..FF5E mirror ASCII U+0021..007E; space becomes U+3000. */
function fullwidth(): Map<string, string> {
  const map = new Map<string, string>([[' ', '　']]);
  for (let code = 0x21; code <= 0x7e; code++) map.set(cp(code), cp(code + 0xfee0));
  return map;
}

/** Enclosed capitals that have no lowercase variant: lowercase maps to the same glyph. */
function capsOnly(start: number, extra: Pairs = []): Map<string, string> {
  return new Map([...run(UPPER, start), ...run(LOWER, start), ...extra]);
}

// Capitals stay full-size (the classic "Sᴍᴀʟʟ Cᴀᴘs" look) and count as supported.
const SMALL_CAPS = new Map([...zip(UPPER, UPPER), ...zip(LOWER, 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ')]);

const SUPERSCRIPT_LOWER = zip('abcdefghijklmnoprstuvwxyz', 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ');
const SUPERSCRIPT = new Map([
  ...SUPERSCRIPT_LOWER,
  // Capitals without a modifier form fall back to the lowercase one.
  ...zip('CFSXYZ', 'ᶜᶠˢˣʸᶻ'),
  ...zip('ABDEGHIJKLMNOPRTUVW', 'ᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ'),
  ...zip(DIGITS, '⁰¹²³⁴⁵⁶⁷⁸⁹'),
  ...zip('+-=()', '⁺⁻⁼⁽⁾'),
]);

const SUBSCRIPT_LETTERS = zip('aehijklmnoprstuvx', 'ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ');
const SUBSCRIPT = new Map([
  ...SUBSCRIPT_LETTERS,
  ...SUBSCRIPT_LETTERS.map(([from, to]): [string, string] => [from.toUpperCase(), to]),
  ...zip(DIGITS, '₀₁₂₃₄₅₆₇₈₉'),
  ...zip('+-=()', '₊₋₌₍₎'),
]);

// Rotated look-alikes; only narrow, left-to-right characters so ASCII art stays aligned.
const UPSIDE_DOWN = new Map([
  ...zip(LOWER, 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz'),
  ...zip(UPPER, '∀ꓭƆꓷƎℲ⅁HIſꓘ˥WNOԀΌꓤS⊥∩ΛMX⅄Z'),
  ...zip(DIGITS, '0Ɩ↊↋ᔭϛ9L86'),
  ...zip('.,\'"?!()[]{}<>_&', "˙',„¿¡)(][}{><‾⅋"),
]);

const STYLE_DEFS = [
  { id: 'bold', ru: 'Жирный', en: 'Bold', cyrillic: false, map: math(0x1d400, 0x1d41a, 0x1d7ce) },
  {
    id: 'italic',
    ru: 'Курсив',
    en: 'Italic',
    cyrillic: false,
    map: math(0x1d434, 0x1d44e, undefined, ITALIC_HOLES),
  },
  {
    id: 'bold-italic',
    ru: 'Жирный курсив',
    en: 'Bold italic',
    cyrillic: false,
    map: math(0x1d468, 0x1d482),
  },
  {
    id: 'script',
    ru: 'Рукописный',
    en: 'Script',
    cyrillic: false,
    map: math(0x1d49c, 0x1d4b6, undefined, SCRIPT_HOLES),
  },
  {
    id: 'bold-script',
    ru: 'Жирный рукописный',
    en: 'Bold script',
    cyrillic: false,
    map: math(0x1d4d0, 0x1d4ea),
  },
  {
    id: 'fraktur',
    ru: 'Готический (фрактура)',
    en: 'Fraktur',
    cyrillic: false,
    map: math(0x1d504, 0x1d51e, undefined, FRAKTUR_HOLES),
  },
  {
    id: 'bold-fraktur',
    ru: 'Жирный готический',
    en: 'Bold fraktur',
    cyrillic: false,
    map: math(0x1d56c, 0x1d586),
  },
  {
    id: 'double-struck',
    ru: 'Двойной контур',
    en: 'Double-struck',
    cyrillic: false,
    map: math(0x1d538, 0x1d552, 0x1d7d8, DOUBLE_STRUCK_HOLES),
  },
  {
    id: 'sans',
    ru: 'Без засечек',
    en: 'Sans-serif',
    cyrillic: false,
    map: math(0x1d5a0, 0x1d5ba, 0x1d7e2),
  },
  {
    id: 'sans-bold',
    ru: 'Жирный без засечек',
    en: 'Sans-serif bold',
    cyrillic: false,
    map: math(0x1d5d4, 0x1d5ee, 0x1d7ec),
  },
  {
    id: 'sans-italic',
    ru: 'Курсив без засечек',
    en: 'Sans-serif italic',
    cyrillic: false,
    map: math(0x1d608, 0x1d622),
  },
  {
    id: 'sans-bold-italic',
    ru: 'Жирный курсив без засечек',
    en: 'Sans-serif bold italic',
    cyrillic: false,
    map: math(0x1d63c, 0x1d656),
  },
  {
    id: 'monospace',
    ru: 'Моноширинный',
    en: 'Monospace',
    cyrillic: false,
    map: math(0x1d670, 0x1d68a, 0x1d7f6),
  },
  { id: 'fullwidth', ru: 'Полноширинный', en: 'Fullwidth', cyrillic: false, map: fullwidth() },
  {
    id: 'circled',
    ru: 'В кружках',
    en: 'Circled',
    cyrillic: false,
    map: new Map([
      ...run(UPPER, 0x24b6),
      ...run(LOWER, 0x24d0),
      ['0', '⓪'],
      ...run('123456789', 0x2460),
    ]),
  },
  {
    id: 'circled-negative',
    ru: 'В чёрных кружках',
    en: 'Negative circled',
    cyrillic: false,
    map: capsOnly(0x1f150, [['0', '⓿'], ...run('123456789', 0x2776)]),
  },
  {
    id: 'squared',
    ru: 'В квадратах',
    en: 'Squared',
    cyrillic: false,
    map: capsOnly(0x1f130),
  },
  {
    id: 'squared-negative',
    ru: 'В чёрных квадратах',
    en: 'Negative squared',
    cyrillic: false,
    map: capsOnly(0x1f170),
  },
  {
    id: 'parenthesized',
    ru: 'В скобках',
    en: 'Parenthesized',
    cyrillic: false,
    map: new Map([...run(UPPER, 0x1f110), ...run(LOWER, 0x249c), ...run('123456789', 0x2474)]),
  },
  { id: 'small-caps', ru: 'Капитель', en: 'Small caps', cyrillic: false, map: SMALL_CAPS },
  { id: 'superscript', ru: 'Надстрочный', en: 'Superscript', cyrillic: false, map: SUPERSCRIPT },
  { id: 'subscript', ru: 'Подстрочный', en: 'Subscript', cyrillic: false, map: SUBSCRIPT },
  {
    id: 'upside-down',
    ru: 'Вверх ногами',
    en: 'Upside down',
    cyrillic: false,
    map: UPSIDE_DOWN,
    rotate: true,
  },
  { id: 'strikethrough', ru: 'Зачёркнутый', en: 'Strikethrough', cyrillic: true, mark: '̶' },
  { id: 'underline', ru: 'Подчёркнутый', en: 'Underline', cyrillic: true, mark: '̲' },
  {
    id: 'double-underline',
    ru: 'Двойное подчёркивание',
    en: 'Double underline',
    cyrillic: true,
    mark: '̳',
  },
  { id: 'slashed', ru: 'Перечёркнутый косой чертой', en: 'Slashed', cyrillic: true, mark: '̸' },
] as const satisfies readonly StyleDef[];

export type FancyStyleId = (typeof STYLE_DEFS)[number]['id'];

const BY_ID = new Map<string, StyleDef>(STYLE_DEFS.map((s) => [s.id, s]));

/** All styles in display order. */
export const fancyStyles: readonly FancyStyle[] = STYLE_DEFS.map(({ id, ru, en, cyrillic }) => ({
  id,
  ru,
  en,
  cyrillic,
}));

function getStyle(styleId: FancyStyleId): StyleDef {
  const style = BY_ID.get(styleId);
  if (!style) throw new Error(`Unknown fancy style: ${styleId}`);
  return style;
}

const LINE_BREAK = /^[\r\n]+$/;

/** Re-spells `text` in the given style. Unmapped characters are kept as they are. */
export function toFancy(text: string, styleId: FancyStyleId): string {
  const style = getStyle(styleId);
  let out = text;
  const map = style.map;
  if (map) out = Array.from(out, (ch) => map.get(ch) ?? ch).join('');
  const mark = style.mark;
  if (mark) {
    out = graphemes(out)
      .map((g) => (LINE_BREAK.test(g) ? g : g + mark))
      .join('');
  }
  if (style.rotate) {
    out = splitLines(out)
      .map((line) => graphemes(line).reverse().join(''))
      .reverse()
      .join('\n');
  }
  return out;
}

/**
 * Whether the style changes `char` (a single character). Combining-mark styles accept any
 * visible character; mapping styles accept only characters in their table.
 */
export function supportsChar(styleId: FancyStyleId, char: string): boolean {
  const style = getStyle(styleId);
  if (style.mark) return !/^\s$/u.test(char);
  return style.map?.has(char) ?? false;
}

/**
 * Distinct letters and digits of `text` that the style leaves unchanged, in order of first
 * appearance. Lets the UI warn e.g. "Cyrillic is not supported in this style".
 */
export function unsupportedChars(text: string, styleId: FancyStyleId): string[] {
  const seen = new Set<string>();
  for (const ch of text) {
    if (/[\p{L}\p{N}]/u.test(ch) && !supportsChar(styleId, ch)) seen.add(ch);
  }
  return [...seen];
}
