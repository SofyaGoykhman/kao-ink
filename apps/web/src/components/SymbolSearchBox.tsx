import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SymbolSearch, type SymbolHit, type SymbolSearchIndex } from '../data/symbol-search';

interface Labels {
  placeholder: string;
  loading: string;
  found: string;
  nothing: string;
  copied: string;
  examples: string;
}

interface Props {
  lang: 'ru' | 'en';
  labels: Labels;
  examples: string[];
  /** Block id -> block name in the page language. */
  blockNames: Record<string, string>;
}

let indexPromise: Promise<SymbolSearch> | undefined;

function loadIndex(): Promise<SymbolSearch> {
  indexPromise ??= fetch('/search/symbols.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<SymbolSearchIndex>;
    })
    .then((index) => new SymbolSearch(index));
  return indexPromise;
}

const codePoint = (char: string) =>
  `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;

export default function SymbolSearchBox({ lang, labels, examples, blockNames }: Props) {
  const [query, setQuery] = useState('');
  const [engine, setEngine] = useState<SymbolSearch>();
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<SymbolHit>();
  const input = useRef<HTMLInputElement>(null);

  const start = () => {
    loadIndex().then(setEngine, () => setFailed(true));
  };

  useEffect(() => {
    // Support links like ?q=сердце.
    const q = new URLSearchParams(location.search).get('q');
    if (q) {
      setQuery(q);
      start();
    }
  }, []);

  const result = useMemo(() => (engine ? engine.search(query) : undefined), [engine, query]);

  const run = (value: string) => {
    setQuery(value);
    start();
    const url = new URL(location.href);
    if (value) url.searchParams.set('q', value);
    else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  };

  return (
    <div class="symbol-search">
      <input
        ref={input}
        type="search"
        value={query}
        placeholder={labels.placeholder}
        aria-label={labels.placeholder}
        onFocus={start}
        onInput={(e) => run(e.currentTarget.value)}
      />
      <p class="muted examples">
        {labels.examples}{' '}
        {examples.map((example, i) => (
          <>
            {i > 0 && ', '}
            <button type="button" class="link" onClick={() => run(example)}>
              {example}
            </button>
          </>
        ))}
      </p>
      {query.trim() !== '' && (
        <div aria-live="polite">
          {failed ? (
            <p class="muted">{labels.nothing}</p>
          ) : !result ? (
            <p class="muted">{labels.loading}</p>
          ) : result.total === 0 ? (
            <p class="muted">{labels.nothing}</p>
          ) : (
            <>
              <p class="muted">
                {labels.found} {result.total}
              </p>
              <ul class="symbol-grid">
                {result.hits.map((hit) => (
                  <li key={hit.char}>
                    <button
                      type="button"
                      data-copy={hit.char}
                      title={`${hit[lang]} · ${codePoint(hit.char)}`}
                      onClick={() => setPicked(hit)}
                    >
                      {/^\p{M}/u.test(hit.char) ? `◌${hit.char}` : hit.char}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {picked && (
        <p class="picked">
          <span class="picked-char">{picked.char}</span>
          <span>
            {picked[lang]}
            <br />
            <span class="muted mono">
              {codePoint(picked.char)} ·{' '}
              <a href={`/${lang}/library/symbols/${picked.block}/`}>
                {blockNames[picked.block] ?? picked.block}
              </a>{' '}
              · {labels.copied}
            </span>
          </span>
        </p>
      )}
    </div>
  );
}
