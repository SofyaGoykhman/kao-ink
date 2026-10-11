import { useState } from 'preact/hooks';
import ImageArt, { type ImageArtLabels } from './ImageArt';
import TextBanner, { type TextBannerLabels } from './TextBanner';

interface Props {
  tabs: { text: string; image: string };
  textLabels: TextBannerLabels;
  imageLabels: ImageArtLabels;
}

export default function GeneratorTabs({ tabs, textLabels, imageLabels }: Props) {
  const [tab, setTab] = useState<'text' | 'image'>('text');
  return (
    <div>
      <div class="tabs" role="tablist">
        {(['text', 'image'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {tabs[t]}
          </button>
        ))}
      </div>
      {tab === 'text' ? <TextBanner labels={textLabels} /> : <ImageArt labels={imageLabels} />}
    </div>
  );
}
