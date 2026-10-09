import { graphemes } from './width.ts';

/** Characters that draw nothing: space, no-break space and the blank Braille pattern. */
const BLANK = /^[ \u00a0\u2800]$/u;

const isBlankLine = (line: string) => graphemes(line).every((g) => BLANK.test(g));

/**
 * Removes empty rows above and below a drawing and the empty columns shared by every row on
 * the left and right. Columns are counted in grapheme clusters, which suits drawings made of
 * single-width characters.
 */
export function trimArt(text: string): string {
  const rows = text.split(/\r\n|\r|\n/);
  let top = 0;
  let bottom = rows.length;
  while (top < bottom && isBlankLine(rows[top]!)) top++;
  while (bottom > top && isBlankLine(rows[bottom - 1]!)) bottom--;
  const cells = rows.slice(top, bottom).map(graphemes);
  if (cells.length === 0) return '';

  const width = Math.max(...cells.map((c) => c.length));
  const blankColumn = (x: number) => cells.every((c) => x >= c.length || BLANK.test(c[x]!));
  let left = 0;
  let right = width;
  while (left < right && blankColumn(left)) left++;
  while (right > left && blankColumn(right - 1)) right--;
  return cells.map((c) => c.slice(left, right).join('').trimEnd()).join('\n');
}
