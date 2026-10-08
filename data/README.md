# Данные

Исходники и скрипты сборки данных для библиотеки. Сырые скачанные файлы лежат в `data/raw/` (в git не попадают); скрипты скачивают их заново.

Скрипты — Node без зависимостей (`node data/<name>/build.mjs`).

## Kaomoji — `data/kaomoji/`

- `SOURCES.md` — каждый просмотренный источник: URL, лицензия, использован или отклонён и почему.
- `categories.json` — таксономия тегов: `[{ "slug": "joy", "group": "emotion", "ru": "Радость", "en": "Joy" }]`.
- `kaomoji.json` — `[{ "id": "joy-001", "text": "(◕‿◕)", "tags": ["joy", "cute"], "source": "original" }]`.
  `tags` — только slug из `categories.json`, первый тег основной. `source` — id источника из `SOURCES.md` или `original`.
- `parts.json` — части для конструктора. Парные части (`faces`, `eyes`, `arms`, `cheeks`) — `{ "id", "left", "right" }`; `mouths` — `{ "id", "text" }`; `extras` — `{ "id", "text", "position": "left" | "right" }`. Руки стоят снаружи рамки лица, одна сторона может быть пустой; полностью пустой может быть только рамка (лицо без скобок).
- `build.mjs` — пересобирает `kaomoji.json` из источников (закреплённые коммиты) и `originals.json`; `--report` показывает отброшенные записи.
- `originals.json` — собственные kaomoji проекта по тегам.
- `licenses/` — тексты MIT-лицензий источников (показываются на странице лицензий).
- `validate.mjs` — проверка схемы, дубликатов, NFC, тегов.

## Unicode — `data/unicode/`

- `build.mjs` — скачивает UCD и CLDR закреплённых версий, собирает выходные файлы.
- `LICENSE-unicode.txt` — лицензия Unicode, под которой распространяются UCD и CLDR.
- `out/blocks.json` — `[{ "id": "arrows", "name": "Arrows", "ru": "Стрелки", "range": [8592, 8703], "count": 112, "group": "symbols" }]`.
  Большие блоки с алгоритмическими именами (иероглифы ККЯ, хангыль, тангутское письмо и т. п.) помечены `"lazy": true` и не имеют посимвольного файла. Вместо него: `ranges` (диапазоны назначенных кодовых точек) и `nameRule` — `"hex"` с `namePrefix` (`"CJK UNIFIED IDEOGRAPH-"` + код) или `"hangul"`.
- `blocks-meta.mjs` — русское название и группа для каждого блока; сборка падает, если у нового блока их нет.
- `out/stats.json` — версии Unicode и CLDR, счётчики и размеры.
- `out/blocks/<id>.json` — `[{ "cp": 8592, "char": "←", "name": "LEFTWARDS ARROW", "ru": "стрелка влево", "en": "leftwards arrow", "keywords": { "ru": [...], "en": [...] } }]`.
