import { useState } from 'preact/hooks';
import { fancyStyles, toFancy, unsupportedChars } from '@kaomoji/ascii-core';

interface Labels {
  input: string;
  sample: string;
  unsupported: string;
  copy: string;
}

export default function FancyText({ lang, labels }: { lang: 'ru' | 'en'; labels: Labels }) {
  const [text, setText] = useState(labels.sample);

  return (
    <div class="fancy">
      <label>
        <span class="muted">{labels.input}</span>
        <textarea rows={2} value={text} onInput={(e) => setText(e.currentTarget.value)} />
      </label>
      <ul>
        {fancyStyles.map((style) => {
          const output = toFancy(text, style.id);
          const missing = unsupportedChars(text, style.id);
          return (
            <li key={style.id}>
              <div class="head">
                <span class="muted">{style[lang]}</span>
                <button type="button" data-copy={output}>
                  {labels.copy}
                </button>
              </div>
              <button type="button" class="output" data-copy={output}>
                {output}
              </button>
              {missing.length > 0 && (
                <p class="warning muted">
                  {labels.unsupported} {missing.join(' ')}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
