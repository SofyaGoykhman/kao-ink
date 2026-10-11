import { measure } from '@kaomoji/ascii-core';

export interface ArtOutputLabels {
  copy: string;
  download: string;
  size: string;
  columns: string;
  lines: string;
}

interface Props {
  art: string;
  labels: ArtOutputLabels;
  filename: string;
  /** Solid drawings (blocks, Braille) read best with rows touching. */
  solid?: boolean;
}

/** A drawing scaled to fit its container, with copy and download actions. */
export default function ArtOutput({ art, labels, filename, solid = false }: Props) {
  const { width, height } = measure(art);
  const download = () => {
    const url = URL.createObjectURL(new Blob([art], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="art-output">
      <div class="art-frame" style={{ '--cols': Math.max(width, 1) }}>
        <pre class={solid ? 'art solid' : 'art'}>{art}</pre>
      </div>
      <div class="art-actions">
        <span class="muted mono">
          {labels.size}: {width} {labels.columns} × {height} {labels.lines}
        </span>
        <button type="button" data-copy={art} disabled={!art}>
          {labels.copy}
        </button>
        <button type="button" onClick={download} disabled={!art}>
          {labels.download}
        </button>
      </div>
    </div>
  );
}
