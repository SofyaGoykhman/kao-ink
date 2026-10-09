import { useEffect, useMemo, useState } from 'preact/hooks';
import { imageToAscii, trimArt, type AsciiMode } from '@kaomoji/ascii-core';
import { DEFAULT_FONT, figletFonts, loadFigletFont, renderFiglet } from '../../data/figlet';
import { textToBitmap } from '../../data/raster';
import ArtOutput, { type ArtOutputLabels } from './ArtOutput';

export interface TextBannerLabels extends ArtOutputLabels {
  text: string;
  sample: string;
  style: string;
  figlet: string;
  raster: string;
  font: string;
  cyrillicFonts: string;
  otherFonts: string;
  noCyrillic: string;
  rasterFont: string;
  rasterMode: string;
  modes: Record<'blocks' | 'quadrants' | 'braille' | 'ramp', string>;
  width: string;
  prev: string;
  next: string;
}

const CYRILLIC = /\p{Script=Cyrillic}/u;
const RASTER_FONTS = [
  'system-ui, sans-serif',
  'Georgia, serif',
  'ui-monospace, monospace',
  '"Comic Sans MS", cursive',
  'Impact, sans-serif',
];
const RASTER_MODES = ['blocks', 'quadrants', 'braille', 'ramp'] as const;

export default function TextBanner({ labels }: { labels: TextBannerLabels }) {
  const [text, setText] = useState(labels.sample);
  const [kind, setKind] = useState<'figlet' | 'raster'>('figlet');
  const [fontId, setFontId] = useState(DEFAULT_FONT);
  const [fontReady, setFontReady] = useState('');
  const [rasterFont, setRasterFont] = useState(RASTER_FONTS[0]!);
  const [rasterMode, setRasterMode] = useState<AsciiMode>('blocks');
  const [columns, setColumns] = useState(60);

  const hasCyrillic = CYRILLIC.test(text);
  const font = figletFonts.find((f) => f.id === fontId);

  useEffect(() => {
    if (kind !== 'figlet') return;
    let current = true;
    loadFigletFont(fontId).then(() => current && setFontReady(fontId));
    return () => {
      current = false;
    };
  }, [kind, fontId]);

  const art = useMemo(() => {
    if (!text.trim()) return '';
    if (kind === 'figlet') return fontReady === fontId ? renderFiglet(text, fontId) : '';
    const bitmap = textToBitmap(text, rasterFont);
    return trimArt(imageToAscii(bitmap, { columns, mode: rasterMode, dither: 'none' }).text);
  }, [text, kind, fontId, fontReady, rasterFont, rasterMode, columns]);

  const step = (delta: number) => {
    const i = figletFonts.findIndex((f) => f.id === fontId);
    const next = figletFonts[(i + delta + figletFonts.length) % figletFonts.length]!;
    setFontId(next.id);
  };

  return (
    <div class="generator">
      <label class="field">
        <span class="muted">{labels.text}</span>
        <textarea rows={2} value={text} onInput={(e) => setText(e.currentTarget.value)} />
      </label>

      <div class="controls">
        <fieldset class="segmented">
          <legend class="muted">{labels.style}</legend>
          {(['figlet', 'raster'] as const).map((k) => (
            <label key={k}>
              <input
                type="radio"
                name="banner-kind"
                checked={kind === k}
                onChange={() => setKind(k)}
              />
              <span>{labels[k]}</span>
            </label>
          ))}
        </fieldset>

        {kind === 'figlet' ? (
          <div class="field">
            <span class="muted">{labels.font}</span>
            <div class="row">
              <button type="button" onClick={() => step(-1)} aria-label={labels.prev}>
                ←
              </button>
              <select value={fontId} onChange={(e) => setFontId(e.currentTarget.value)}>
                <optgroup label={labels.cyrillicFonts}>
                  {figletFonts
                    .filter((f) => f.cyrillic)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label={labels.otherFonts}>
                  {figletFonts
                    .filter((f) => !f.cyrillic)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </optgroup>
              </select>
              <button type="button" onClick={() => step(1)} aria-label={labels.next}>
                →
              </button>
            </div>
          </div>
        ) : (
          <>
            <label class="field">
              <span class="muted">{labels.rasterFont}</span>
              <select value={rasterFont} onChange={(e) => setRasterFont(e.currentTarget.value)}>
                {RASTER_FONTS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f.split(',')[0]!.replaceAll('"', '')}
                  </option>
                ))}
              </select>
            </label>
            <label class="field">
              <span class="muted">{labels.rasterMode}</span>
              <select
                value={rasterMode}
                onChange={(e) => setRasterMode(e.currentTarget.value as AsciiMode)}
              >
                {RASTER_MODES.map((m) => (
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
                min={16}
                max={160}
                value={columns}
                onInput={(e) => setColumns(Number(e.currentTarget.value))}
              />
            </label>
          </>
        )}
      </div>

      {kind === 'figlet' && hasCyrillic && font && !font.cyrillic && (
        <p class="hint">{labels.noCyrillic}</p>
      )}

      <ArtOutput art={art} labels={labels} filename="kao-ink-banner.txt" />
    </div>
  );
}
