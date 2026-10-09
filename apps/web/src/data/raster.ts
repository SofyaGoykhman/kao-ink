import type { Bitmap } from '@kaomoji/ascii-core';

/** Max side of the bitmap handed to the converter; larger images are scaled down first. */
const MAX_SIDE = 1200;

/** Draws an image into a canvas no larger than MAX_SIDE and returns its pixels. */
export function imageToBitmap(
  image: CanvasImageSource & { width: number; height: number },
): Bitmap {
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/** Renders text in a system font, black on white, tightly cropped — for raster banners. */
export function textToBitmap(text: string, font: string, weight = 700): Bitmap {
  const size = 96;
  const lines = text.split('\n');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const css = `${weight} ${size}px ${font}`;
  ctx.font = css;
  const width = Math.ceil(Math.max(1, ...lines.map((l) => ctx.measureText(l).width))) + 8;
  const lineHeight = Math.ceil(size * 1.15);
  canvas.width = width;
  canvas.height = lineHeight * lines.length + 8;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.font = css;
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, 4, 4 + i * lineHeight));
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Loads a File or Blob into an image element. */
export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Not an image'));
    };
    img.src = url;
  });
}
