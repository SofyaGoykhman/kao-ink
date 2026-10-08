# Kao.ink

Сайт с библиотекой kaomoji, Unicode-символов и шрифтов, генератором ASCII-графики и форматтером под Telegram, Instagram и Threads. План — в [docs/PLAN.md](docs/PLAN.md).

## Структура

```
apps/web/              сайт (Astro + Preact), ru/en
packages/ascii-core/   ядро: ширина символов, дальше генерация и форматирование
data/                  источники данных и скрипты сборки
```

## Команды

Нужен Node 24+.

```sh
npm install
npm run dev          # локальный сервер
npm test             # тесты ядра (Vitest)
npm run lint         # ESLint
npm run typecheck    # tsc и astro check
npm run build        # статическая сборка в apps/web/dist
```
