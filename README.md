# Cosmic Bastion

Гибрид Tower Defense и визуальной новеллы: оборона отсеков разбившегося крейсера, управление шахтёрами и военными, сюжетные решения во время волн.

Vue 3 + Vite + TypeScript, Pinia, Vue Router, SCSS, Canvas.

## Запуск

```sh
npm install
npm run dev        # http://localhost:5173
```

## Проверка

```sh
npm run verify     # типы, линтер, форматирование, юнит-тесты
npm run test:e2e   # Playwright
```

## Управление

ЛКМ — выбор / строительство · ESC — отмена / пауза · Пробел — начать волну · V — переключить вид · U — улучшить выделенное.

Архитектура и соглашения — [AGENTS.md](AGENTS.md). Нереализованное — [TODO.md](TODO.md).
