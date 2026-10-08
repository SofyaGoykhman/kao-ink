import { eastAsianWidth } from 'get-east-asian-width';

export interface WidthOptions {
  /**
   * Treat East Asian "ambiguous" characters (°, ω, ×, Greek and Cyrillic letters…)
   * as two columns, as CJK terminals and fonts do. Defaults to false.
   */
  ambiguousAsWide?: boolean;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

const RGI_EMOJI = /^\p{RGI_Emoji}$/v;
const ZERO_WIDTH = /^[\p{Cc}\p{Cf}\p{M}\p{Default_Ignorable_Code_Point}]+$/u;

/** Splits text into user-perceived characters (grapheme clusters). */
export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/** Number of monospace columns a single grapheme cluster occupies: 0, 1 or 2. */
export function graphemeWidth(grapheme: string, options: WidthOptions = {}): number {
  if (grapheme === '' || ZERO_WIDTH.test(grapheme)) return 0;
  if (RGI_EMOJI.test(grapheme)) return 2;
  const codePoint = grapheme.codePointAt(0)!;
  return eastAsianWidth(codePoint, { ambiguousAsWide: options.ambiguousAsWide ?? false });
}

/** Monospace column width of a single line of text. */
export function stringWidth(text: string, options: WidthOptions = {}): number {
  let width = 0;
  for (const g of graphemes(text)) width += graphemeWidth(g, options);
  return width;
}

/** Splits text into lines, accepting \n, \r\n and \r. */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

export interface TextMetrics {
  /** Widest line, in columns. */
  width: number;
  /** Number of lines. */
  height: number;
  /** Width of each line, in columns. */
  lineWidths: number[];
}

/** Column metrics of a multi-line block such as an ASCII drawing. */
export function measure(text: string, options: WidthOptions = {}): TextMetrics {
  const lineWidths = splitLines(text).map((line) => stringWidth(line, options));
  return { width: Math.max(0, ...lineWidths), height: lineWidths.length, lineWidths };
}

/** Pads a line with `fill` on the right until it reaches `width` columns. */
export function padEndToWidth(
  line: string,
  width: number,
  fill = ' ',
  options: WidthOptions = {},
): string {
  const missing = width - stringWidth(line, options);
  return missing > 0 ? line + fill.repeat(missing) : line;
}
