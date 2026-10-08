import { useMemo, useState } from 'preact/hooks';
import { measure } from '@kaomoji/ascii-core';

interface Labels {
  input: string;
  columns: string;
  lines: string;
  ambiguous: string;
}

const SAMPLE = '（＾▽＾）\n(◕‿◕)\n¯\\_(ツ)_/¯';

export default function WidthChecker({ labels }: { labels: Labels }) {
  const [text, setText] = useState(SAMPLE);
  const [ambiguousAsWide, setAmbiguousAsWide] = useState(false);
  const metrics = useMemo(() => measure(text, { ambiguousAsWide }), [text, ambiguousAsWide]);

  return (
    <div class="width-checker">
      <label>
        <span class="muted">{labels.input}</span>
        <textarea
          rows={5}
          value={text}
          spellcheck={false}
          onInput={(e) => setText(e.currentTarget.value)}
        />
      </label>
      <label class="option">
        <input
          type="checkbox"
          checked={ambiguousAsWide}
          onChange={(e) => setAmbiguousAsWide(e.currentTarget.checked)}
        />
        <span>{labels.ambiguous}</span>
      </label>
      <p class="mono summary">
        {labels.columns}: {metrics.width} · {labels.lines}: {metrics.height}
      </p>
      <ol class="mono widths">
        {metrics.lineWidths.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ol>
    </div>
  );
}
