import { graphemes } from './width.ts';

/** RGBA pixels, row by row, 4 bytes per pixel (the layout of canvas ImageData). */
export interface Bitmap {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

/**
 * - `ramp`: one character per cell, picked from a light-to-dense character ramp.
 * - `blocks`: half blocks ▀▄█, two pixels per cell.
 * - `quadrants`: quadrant blocks ▘▚▙…, 2×2 pixels per cell.
 * - `braille`: Braille dots ⣿, 2×4 pixels per cell — the most detailed.
 * - `edges`: outlines drawn with | / - \ along the image's contours.
 */
export type AsciiMode = 'ramp' | 'blocks' | 'quadrants' | 'braille' | 'edges';

export type Dither = 'none' | 'floyd-steinberg' | 'atkinson';

export interface ImageToAsciiOptions {
  /** Output width in characters. */
  columns: number;
  mode?: AsciiMode;
  /** Characters from "no ink" to "full ink", for `ramp` mode. */
  ramp?: string;
  /** Draw light areas instead of dark ones (for light-on-dark output). */
  invert?: boolean;
  /** Character cell height divided by its width; 2 suits most monospace fonts. */
  cellAspect?: number;
  /** Added to brightness, -1…1. */
  brightness?: number;
  /** -1…1; positive values increase contrast. */
  contrast?: number;
  /** Brightness curve; values above 1 darken midtones. */
  gamma?: number;
  dither?: Dither;
  /** Ink level (0…1) above which a pixel is set, for the dot and block modes. */
  threshold?: number;
  /**
   * Use the blank Braille pattern U+2800 for empty Braille cells instead of a space. It has
   * the width of the other Braille characters, which keeps drawings aligned in proportional
   * fonts and stops apps from collapsing runs of spaces. Defaults to true.
   */
  blankBraille?: boolean;
}

export interface AsciiArt {
  text: string;
  lines: string[];
  columns: number;
  rows: number;
}

export const DEFAULT_RAMP = ' .:-=+*#%@';

const QUADRANTS = ' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█';
const HALF_BLOCKS = [' ', '▀', '▄', '█'];
// Braille dot bit for each pixel of a 2×4 cell, indexed [y][x].
const BRAILLE_BITS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];
const BRAILLE_BLANK = '\u2800';

const CELL: Record<AsciiMode, [x: number, y: number]> = {
  ramp: [1, 1],
  edges: [1, 1],
  blocks: [1, 2],
  quadrants: [2, 2],
  braille: [2, 4],
};

/** A grid of values in 0…1, row by row. */
interface Grid {
  width: number;
  height: number;
  values: Float32Array;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Relative luminance (0 black … 1 white), with transparency composited over white. */
function luminanceAt(data: ArrayLike<number>, i: number): number {
  const r = data[i]!;
  const g = data[i + 1]!;
  const b = data[i + 2]!;
  const a = data[i + 3]! / 255;
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return y * a + (1 - a);
}

/** Box-filters the bitmap's luminance down (or nearest-samples up) to a width × height grid. */
function resample(bitmap: Bitmap, width: number, height: number): Grid {
  const values = new Float32Array(width * height);
  const sx = bitmap.width / width;
  const sy = bitmap.height / height;
  for (let gy = 0; gy < height; gy++) {
    const y0 = Math.floor(gy * sy);
    const y1 = Math.min(bitmap.height, Math.max(y0 + 1, Math.floor((gy + 1) * sy)));
    for (let gx = 0; gx < width; gx++) {
      const x0 = Math.floor(gx * sx);
      const x1 = Math.min(bitmap.width, Math.max(x0 + 1, Math.floor((gx + 1) * sx)));
      let sum = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) sum += luminanceAt(bitmap.data, (y * bitmap.width + x) * 4);
      }
      values[gy * width + gx] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return { width, height, values };
}

/** Turns luminance into ink (0 none … 1 full) after brightness, contrast and gamma. */
function toInk(grid: Grid, options: ImageToAsciiOptions): void {
  const brightness = options.brightness ?? 0;
  const contrast = 1 + (options.contrast ?? 0);
  const gamma = options.gamma ?? 1;
  const { values } = grid;
  for (let i = 0; i < values.length; i++) {
    let v = clamp01((values[i]! - 0.5) * contrast + 0.5 + brightness);
    if (gamma !== 1) v = v ** gamma;
    values[i] = options.invert ? v : 1 - v;
  }
}

const DIFFUSION: Record<Exclude<Dither, 'none'>, [dx: number, dy: number, weight: number][]> = {
  'floyd-steinberg': [
    [1, 0, 7 / 16],
    [-1, 1, 3 / 16],
    [0, 1, 5 / 16],
    [1, 1, 1 / 16],
  ],
  // Atkinson spreads only 3/4 of the error, which keeps highlights and shadows clean.
  atkinson: [
    [1, 0, 1 / 8],
    [2, 0, 1 / 8],
    [-1, 1, 1 / 8],
    [0, 1, 1 / 8],
    [1, 1, 1 / 8],
    [0, 2, 1 / 8],
  ],
};

/**
 * Quantizes every value to one of `levels` evenly spaced steps (0…levels-1), optionally
 * spreading the rounding error to neighbours. With two levels `threshold` sets the cut.
 */
function quantize(grid: Grid, levels: number, dither: Dither, threshold = 0.5): Uint8Array {
  const { width, height } = grid;
  const values = Float32Array.from(grid.values);
  const out = new Uint8Array(values.length);
  const steps = levels - 1;
  const kernel = dither === 'none' ? [] : DIFFUSION[dither];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const v = clamp01(values[i]!);
      const level = levels === 2 ? (v > threshold ? 1 : 0) : Math.min(steps, Math.round(v * steps));
      out[i] = level;
      const error = values[i]! - level / steps;
      for (const [dx, dy, weight] of kernel) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny < height) values[ny * width + nx]! += error * weight;
      }
    }
  }
  return out;
}

/** Sobel edges: a line character along each strong contour, a space elsewhere. */
function edgeChars(grid: Grid, threshold: number): string[] {
  const { width, height, values } = grid;
  const at = (x: number, y: number) =>
    values[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))]!;
  const chars: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gx =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      // The strongest possible response is 4 (a hard 0→1 step).
      if (Math.hypot(gx, gy) / 4 < threshold) {
        chars.push(' ');
        continue;
      }
      // The contour runs perpendicular to the gradient; screen y grows downwards.
      const angle = ((Math.atan2(-gy, gx) * 180) / Math.PI + 90 + 180) % 180;
      chars.push(
        angle < 22.5 || angle >= 157.5 ? '-' : angle < 67.5 ? '/' : angle < 112.5 ? '|' : '\\',
      );
    }
  }
  return chars;
}

/** Converts an image to text art. */
export function imageToAscii(bitmap: Bitmap, options: ImageToAsciiOptions): AsciiArt {
  if (bitmap.width < 1 || bitmap.height < 1) return { text: '', lines: [], columns: 0, rows: 0 };
  const mode = options.mode ?? 'ramp';
  const columns = Math.max(1, Math.round(options.columns));
  const [cellX, cellY] = CELL[mode];
  const cellAspect = options.cellAspect ?? 2;
  const rows = Math.max(1, Math.round((bitmap.height * columns) / (bitmap.width * cellAspect)));

  const grid = resample(bitmap, columns * cellX, rows * cellY);
  const dither = options.dither ?? 'none';
  const threshold = options.threshold ?? 0.5;
  const lines: string[] = [];

  if (mode === 'edges') {
    // Contours are the same in ink and in brightness, so the ink grid works for both.
    toInk(grid, options);
    const chars = edgeChars(grid, threshold * 0.5);
    for (let y = 0; y < rows; y++) lines.push(chars.slice(y * columns, (y + 1) * columns).join(''));
  } else if (mode === 'ramp') {
    toInk(grid, options);
    const ramp = graphemes(options.ramp || DEFAULT_RAMP);
    const levels = quantize(grid, ramp.length, dither);
    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < columns; x++) line += ramp[levels[y * columns + x]!];
      lines.push(line);
    }
  } else {
    toInk(grid, options);
    const dots = quantize(grid, 2, dither, threshold);
    const dot = (x: number, y: number) => dots[y * grid.width + x] === 1;
    const blank = options.blankBraille === false ? ' ' : BRAILLE_BLANK;
    for (let row = 0; row < rows; row++) {
      let line = '';
      for (let col = 0; col < columns; col++) {
        const x = col * cellX;
        const y = row * cellY;
        if (mode === 'blocks') {
          line += HALF_BLOCKS[(dot(x, y) ? 1 : 0) | (dot(x, y + 1) ? 2 : 0)];
        } else if (mode === 'quadrants') {
          const index =
            (dot(x, y) ? 1 : 0) |
            (dot(x + 1, y) ? 2 : 0) |
            (dot(x, y + 1) ? 4 : 0) |
            (dot(x + 1, y + 1) ? 8 : 0);
          line += QUADRANTS[index];
        } else {
          let bits = 0;
          for (let dy = 0; dy < 4; dy++) {
            for (let dx = 0; dx < 2; dx++) if (dot(x + dx, y + dy)) bits |= BRAILLE_BITS[dy]![dx]!;
          }
          line += bits ? String.fromCodePoint(0x2800 + bits) : blank;
        }
      }
      lines.push(line);
    }
  }

  return { text: lines.join('\n'), lines, columns, rows };
}
