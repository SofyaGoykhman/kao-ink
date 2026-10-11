import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  DEFAULT_RAMP,
  imageToAscii,
  type AsciiMode,
  type Bitmap,
  type Dither,
} from '@kaomoji/ascii-core';
import { imageToBitmap, loadImage } from '../../data/raster';
import ArtOutput, { type ArtOutputLabels } from './ArtOutput';

export interface ImageArtLabels extends ArtOutputLabels {
  drop: string;
  choose: string;
  notImage: string;
  mode: string;
  modes: Record<AsciiMode, string>;
  width: string;
  invert: string;
  contrast: string;
  brightness: string;
  threshold: string;
  dither: string;
  dithers: Record<Dither, string>;
  ramp: string;
}

const MODES: AsciiMode[] = ['braille', 'blocks', 'quadrants', 'ramp', 'edges'];
const DITHERS: Dither[] = ['none', 'floyd-steinberg', 'atkinson'];

export default function ImageArt({ labels }: { labels: ImageArtLabels }) {
  const [bitmap, setBitmap] = useState<Bitmap>();
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<AsciiMode>('braille');
  const [columns, setColumns] = useState(60);
  const [invert, setInvert] = useState(false);
  const [contrast, setContrast] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [threshold, setThreshold] = useState(0.5);
  const [dither, setDither] = useState<Dither>('atkinson');
  const [ramp, setRamp] = useState(DEFAULT_RAMP);

  const open = async (file: Blob | null | undefined) => {
    if (!file) return;
    try {
      setBitmap(imageToBitmap(await loadImage(file)));
      setError('');
    } catch {
      setError(labels.notImage);
    }
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/'),
      );
      if (item) open(item.getAsFile());
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const art = useMemo(
    () =>
      bitmap
        ? imageToAscii(bitmap, {
            columns,
            mode,
            invert,
            contrast,
            brightness,
            threshold,
            dither: mode === 'edges' ? 'none' : dither,
            ramp,
          }).text
        : '',
    [bitmap, columns, mode, invert, contrast, brightness, threshold, dither, ramp],
  );

  const binary = mode === 'braille' || mode === 'blocks' || mode === 'quadrants';

  return (
    <div class="generator">
      <label
        class={`dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          open(e.dataTransfer?.files[0]);
        }}
      >
        <input type="file" accept="image/*" onChange={(e) => open(e.currentTarget.files?.[0])} />
        <span>{labels.drop}</span>
        <span class="link">{labels.choose}</span>
      </label>
      {error && <p class="hint">{error}</p>}

      <div class="controls">
        <label class="field">
          <span class="muted">{labels.mode}</span>
          <select value={mode} onChange={(e) => setMode(e.currentTarget.value as AsciiMode)}>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {labels.modes[m]}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="muted">
            {labels.width}: {columns}
          </span>
          <input
            type="range"
            min={10}
            max={200}
            value={columns}
            onInput={(e) => setColumns(Number(e.currentTarget.value))}
          />
        </label>
        <label class="field">
          <span class="muted">{labels.contrast}</span>
          <input
            type="range"
            min={-0.9}
            max={2}
            step={0.05}
            value={contrast}
            onInput={(e) => setContrast(Number(e.currentTarget.value))}
          />
        </label>
        <label class="field">
          <span class="muted">{labels.brightness}</span>
          <input
            type="range"
            min={-0.5}
            max={0.5}
            step={0.02}
            value={brightness}
            onInput={(e) => setBrightness(Number(e.currentTarget.value))}
          />
        </label>
        {(binary || mode === 'edges') && (
          <label class="field">
            <span class="muted">{labels.threshold}</span>
            <input
              type="range"
              min={0.05}
              max={0.95}
              step={0.01}
              value={threshold}
              onInput={(e) => setThreshold(Number(e.currentTarget.value))}
            />
          </label>
        )}
        {mode !== 'edges' && (
          <label class="field">
            <span class="muted">{labels.dither}</span>
            <select value={dither} onChange={(e) => setDither(e.currentTarget.value as Dither)}>
              {DITHERS.map((d) => (
                <option key={d} value={d}>
                  {labels.dithers[d]}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === 'ramp' && (
          <label class="field">
            <span class="muted">{labels.ramp}</span>
            <input
              type="text"
              class="mono"
              value={ramp}
              onInput={(e) => setRamp(e.currentTarget.value)}
            />
          </label>
        )}
        <label class="check">
          <input
            type="checkbox"
            checked={invert}
            onChange={(e) => setInvert(e.currentTarget.checked)}
          />
          <span>{labels.invert}</span>
        </label>
      </div>

      {bitmap && <ArtOutput art={art} labels={labels} filename="kao-ink-art.txt" solid={binary} />}
    </div>
  );
}
