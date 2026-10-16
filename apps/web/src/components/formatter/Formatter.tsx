import { useMemo, useState } from 'preact/hooks';
import {
  countChars,
  fitToLimits,
  isDotArt,
  PLATFORMS,
  trimArt,
  type Platform,
} from '@kaomoji/ascii-core';
import { textToBitmap } from '../../data/raster';
import ArtOutput, { type ArtOutputLabels } from '../generator/ArtOutput';
import { downloadStoryPng } from '../../data/story';

type Target = Platform | 'story';

export interface FormatterLabels extends ArtOutputLabels {
  input: string;
  placeholder: string;
  platform: string;
  platforms: Record<Target, string>;
  method: string;
  braille: string;
  asIs: string;
  width: string;
  threshold: string;
  invert: string;
  chars: string;
  tooLong: string;
  asIsWarning: string;
  preview: string;
  previewNote: string;
  storyColors: string;
  storyDark: string;
  storyLight: string;
  storyDownload: string;
  empty: string;
}

const TARGETS: Target[] = ['telegram', 'instagram-post', 'threads', 'story'];
const SAMPLE = ['   _____', '  /     \\', ' | () () |', '  \\  ^  /', '   |||||', '   |||||'].join(
  '\n',
);

export default function Formatter({ labels }: { labels: FormatterLabels }) {
  const [input, setInput] = useState(SAMPLE);
  const [target, setTarget] = useState<Target>('telegram');
  const [method, setMethod] = useState<'braille' | 'as-is'>('braille');
  const [columns, setColumns] = useState<number>(PLATFORMS.telegram.columns);
  const [threshold, setThreshold] = useState(0.3);
  const [invert, setInvert] = useState(false);
  const [storyDark, setStoryDark] = useState(true);

  // Stories are images, so text limits do not apply: allow wide drawings.
  const limits =
    target === 'story' ? { columns: 80, maxChars: Infinity } : PLATFORMS[target as Platform];

  const choose = (next: Target) => {
    setTarget(next);
    setColumns(next === 'story' ? 40 : PLATFORMS[next].columns);
  };

  const result = useMemo(() => {
    if (!input.trim()) return { art: '', chars: 0, fits: true };
    if (method === 'as-is') {
      const art = trimArt(input);
      return { art, chars: countChars(art), fits: countChars(art) <= limits.maxChars };
    }
    // Line art keeps its shapes when drawn with a real font; dot art decodes exactly.
    const bitmap = isDotArt(input)
      ? undefined
      : textToBitmap(trimArt(input), 'ui-monospace, Menlo, Consolas, monospace', 700);
    return fitToLimits(input, limits, { columns, threshold, invert, bitmap });
  }, [input, method, target, columns, threshold, invert, limits]);

  return (
    <div class="generator">
      <label class="field">
        <span class="muted">{labels.input}</span>
        <textarea
          rows={8}
          value={input}
          placeholder={labels.placeholder}
          spellcheck={false}
          onInput={(e) => setInput(e.currentTarget.value)}
        />
      </label>

      <div class="controls">
        <label class="field">
          <span class="muted">{labels.platform}</span>
          <select value={target} onChange={(e) => choose(e.currentTarget.value as Target)}>
            {TARGETS.map((t) => (
              <option key={t} value={t}>
                {labels.platforms[t]}
              </option>
            ))}
          </select>
        </label>
        <fieldset class="segmented">
          <legend class="muted">{labels.method}</legend>
          <label>
            <input
              type="radio"
              name="method"
              checked={method === 'braille'}
              onChange={() => setMethod('braille')}
            />
            <span>{labels.braille}</span>
          </label>
          <label>
            <input
              type="radio"
              name="method"
              checked={method === 'as-is'}
              onChange={() => setMethod('as-is')}
            />
            <span>{labels.asIs}</span>
          </label>
        </fieldset>
        {method === 'braille' && (
          <>
            <label class="field">
              <span class="muted">
                {labels.width}: {columns}
              </span>
              <input
                type="range"
                min={8}
                max={limits.columns}
                value={columns}
                onInput={(e) => setColumns(Number(e.currentTarget.value))}
              />
            </label>
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
            <label class="check">
              <input
                type="checkbox"
                checked={invert}
                onChange={(e) => setInvert(e.currentTarget.checked)}
              />
              <span>{labels.invert}</span>
            </label>
          </>
        )}
      </div>

      {!result.art ? (
        <p class="muted">{labels.empty}</p>
      ) : (
        <>
          {method === 'as-is' && target !== 'story' && <p class="hint">{labels.asIsWarning}</p>}
          {target !== 'story' && (
            <p class={result.fits ? 'muted mono' : 'hint'}>
              {labels.chars}: {result.chars} / {limits.maxChars}
              {!result.fits && ` — ${labels.tooLong}`}
            </p>
          )}
          <ArtOutput
            art={result.art}
            labels={labels}
            filename="kao-ink-formatted.txt"
            solid={method === 'braille'}
          />
          {target === 'story' ? (
            <div class="controls">
              <fieldset class="segmented">
                <legend class="muted">{labels.storyColors}</legend>
                <label>
                  <input
                    type="radio"
                    name="story"
                    checked={storyDark}
                    onChange={() => setStoryDark(true)}
                  />
                  <span>{labels.storyDark}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="story"
                    checked={!storyDark}
                    onChange={() => setStoryDark(false)}
                  />
                  <span>{labels.storyLight}</span>
                </label>
              </fieldset>
              <button
                type="button"
                class="primary"
                onClick={() => downloadStoryPng(result.art, storyDark)}
              >
                {labels.storyDownload}
              </button>
            </div>
          ) : (
            <section class="app-preview">
              <h2>{labels.preview}</h2>
              <p class="muted">{labels.previewNote}</p>
              <div class="bubble">{result.art}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
