const WIDTH = 1080;
const HEIGHT = 1920;
/** Instagram covers the top and bottom ~250px with UI; keep the drawing inside. */
const SAFE_X = 90;
const SAFE_Y = 270;
const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';

/** Renders text art centered on a 1080×1920 story canvas. */
export function renderStory(art: string, dark: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = dark ? '#111' : '#fafaf9';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const lines = art.split('\n');
  // Measure the drawing at a reference size, then scale it to fit both dimensions.
  const REF = 100;
  ctx.font = `${REF}px ${FONT}`;
  const refWidth = Math.max(1, ...lines.map((line) => ctx.measureText(line).width));
  const lineHeight = 1.05;
  const size = Math.min(
    (REF * (WIDTH - 2 * SAFE_X)) / refWidth,
    (HEIGHT - 2 * SAFE_Y) / (lines.length * lineHeight),
    64,
  );
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = dark ? '#f2f2ee' : '#1c1c1a';
  ctx.textBaseline = 'top';
  const blockHeight = lines.length * size * lineHeight;
  const blockWidth = (refWidth * size) / REF;
  const x = (WIDTH - blockWidth) / 2;
  const y = (HEIGHT - blockHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * size * lineHeight));
  return canvas;
}

export function downloadStoryPng(art: string, dark: boolean): void {
  renderStory(art, dark).toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kao-ink-story.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
