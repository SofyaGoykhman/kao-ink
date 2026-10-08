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
    'library.kaomoji': 'Kaomoji',
    'library.kaomoji.lead': 'Эмоции, действия и персонажи из японских смайликов.',
    'library.symbols': 'Символы',
    'library.symbols.lead':
      'Все символы Unicode по блокам: стрелки, фигуры, псевдографика, математика.',
    'library.fonts': 'Шрифты',
    'library.fonts.lead': 'Стилизованный текст: 𝓼𝓬𝓻𝓲𝓹𝓽, 𝕕𝕠𝕦𝕓𝕝𝕖, ⓒⓘⓡⓒⓛⓔⓓ и другие.',
    'symbols.chars': 'символов',
    'symbols.lazy': 'скоро',
    'symbols.filter': 'Фильтр по названию',
    'symbols.copyHint': 'Нажмите на символ, чтобы скопировать.',
    'group.symbols': 'Символы',
    'group.arrows': 'Стрелки',
    'group.math': 'Математика',
    'group.shapes': 'Фигуры',
    'group.box-drawing': 'Псевдографика и блоки',
    'group.technical': 'Технические',
    'group.punctuation': 'Пунктуация и пробелы',
    'group.games': 'Игры',
    'group.emoji': 'Эмодзи',
    'group.other': 'Прочее',
    'group.scripts': 'Письменности',
    'group.cjk': 'Китайский, японский, корейский',
    'fonts.input': 'Ваш текст',
    'fonts.sample': 'Kao.ink 2026',
    'fonts.unsupported': 'Без изменений останутся:',
    'fonts.cyrillicNote':
      'Кириллицу поддерживают только стили с линиями (зачёркнутый, подчёркнутый). В Unicode нет стилизованных кириллических алфавитов.',
    'kaomoji.group.emotion': 'Эмоции',
    'kaomoji.group.action': 'Действия',
    'kaomoji.group.character': 'Персонажи',
    'kaomoji.group.other': 'Разное',
    'kaomoji.all': 'все',
    'kaomoji.count': 'kaomoji',
    'kaomoji.copyHint': 'Нажмите на kaomoji, чтобы скопировать.',
    'licenses.title': 'Лицензии и источники',
    'licenses.lead':
      'Данные сайта собраны из открытых источников. Здесь указаны их авторы и лицензии.',
    'copy.copy': 'Копировать',
    'copy.done': 'Скопировано',
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
    'library.kaomoji': 'Kaomoji',
    'library.kaomoji.lead': 'Japanese emoticons for emotions, actions and characters.',
    'library.symbols': 'Symbols',
    'library.symbols.lead': 'Every Unicode character by block: arrows, shapes, box drawing, math.',
    'library.fonts': 'Fonts',
    'library.fonts.lead': 'Styled text: 𝓼𝓬𝓻𝓲𝓹𝓽, 𝕕𝕠𝕦𝕓𝕝𝕖, ⓒⓘⓡⓒⓛⓔⓓ and more.',
    'symbols.chars': 'characters',
    'symbols.lazy': 'soon',
    'symbols.filter': 'Filter by name',
    'symbols.copyHint': 'Click a character to copy it.',
    'group.symbols': 'Symbols',
    'group.arrows': 'Arrows',
    'group.math': 'Math',
    'group.shapes': 'Shapes',
    'group.box-drawing': 'Box drawing and blocks',
    'group.technical': 'Technical',
    'group.punctuation': 'Punctuation and spaces',
    'group.games': 'Games',
    'group.emoji': 'Emoji',
    'group.other': 'Other',
    'group.scripts': 'Writing systems',
    'group.cjk': 'Chinese, Japanese, Korean',
    'fonts.input': 'Your text',
    'fonts.sample': 'Kao.ink 2026',
    'fonts.unsupported': 'Left unchanged:',
    'fonts.cyrillicNote':
      'Only line styles (strikethrough, underline) work with Cyrillic: Unicode has no styled Cyrillic alphabets.',
    'kaomoji.group.emotion': 'Emotions',
    'kaomoji.group.action': 'Actions',
    'kaomoji.group.character': 'Characters',
    'kaomoji.group.other': 'Other',
    'kaomoji.all': 'all',
    'kaomoji.count': 'kaomoji',
    'kaomoji.copyHint': 'Click a kaomoji to copy it.',
    'licenses.title': 'Licenses and sources',
    'licenses.lead':
      'The site data comes from open sources. Their authors and licenses are listed here.',
    'copy.copy': 'Copy',
    'copy.done': 'Copied',
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
