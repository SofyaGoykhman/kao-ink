export const languages = { ru: 'Русский', en: 'English' } as const;
export type Lang = keyof typeof languages;
export const langs = Object.keys(languages) as Lang[];

export const sections = ['library', 'generator', 'formatter'] as const;
export type Section = (typeof sections)[number];

const ui = {
  ru: {
    'site.tagline': 'Kaomoji, символы и ASCII-графика',
    'nav.library': 'Библиотека',
    'nav.generator': 'Генератор',
    'nav.formatter': 'Форматтер',
    'library.lead': 'Kaomoji, Unicode-символы и шрифты с поиском и копированием в один клик.',
    'generator.lead': 'ASCII-графика из текста и изображений.',
    'formatter.lead': 'Подгонка готового рисунка под Telegram, Instagram и Threads.',
    'section.soon': 'Раздел в разработке.',
    'theme.toggle': 'Сменить тему',
    'lang.switch': 'Язык',
    'width.title': 'Ширина строки',
    'width.lead':
      'Вставьте kaomoji или рисунок: покажем ширину в моноширинных колонках. Полноширинные символы занимают две.',
    'width.input': 'Текст',
    'width.columns': 'колонок',
    'width.lines': 'строк',
    'width.ambiguous': 'Неоднозначные символы (°, ω, кириллица) как широкие',
  },
  en: {
    'site.tagline': 'Kaomoji, symbols and ASCII art',
    'nav.library': 'Library',
    'nav.generator': 'Generator',
    'nav.formatter': 'Formatter',
    'library.lead': 'Kaomoji, Unicode symbols and fonts with search and one-click copy.',
    'generator.lead': 'ASCII art from text and images.',
    'formatter.lead': 'Fit an existing drawing to Telegram, Instagram and Threads.',
    'section.soon': 'This section is in progress.',
    'theme.toggle': 'Toggle theme',
    'lang.switch': 'Language',
    'width.title': 'Line width',
    'width.lead':
      'Paste a kaomoji or a drawing to see its width in monospace columns. Fullwidth characters take two.',
    'width.input': 'Text',
    'width.columns': 'columns',
    'width.lines': 'lines',
    'width.ambiguous': 'Treat ambiguous characters (°, ω, Cyrillic) as wide',
  },
} as const;

export type UiKey = keyof (typeof ui)['ru'];

export function useTranslations(lang: Lang) {
  return (key: UiKey): string => ui[lang][key];
}

export function isLang(value: string | undefined): value is Lang {
  return value !== undefined && value in languages;
}

/** Same page in another language: swaps the leading locale segment of a path. */
export function localizePath(path: string, lang: Lang): string {
  const rest = path.replace(/^\/(ru|en)(?=\/|$)/, '');
  return `/${lang}${rest || '/'}`;
}
