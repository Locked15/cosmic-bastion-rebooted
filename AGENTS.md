# AGENTS.md — Cosmic Bastion (rebooted)

A tower-defense / visual-novel hybrid. It is a Vue 3 + Vite + TypeScript single-page app (SPA) that renders the battlefield on a Canvas. The previous vanilla-JS version lives in the sibling folder `../cosmic-bastion`, and its `Промт.docx` is the original design brief. User-facing text is in Russian; code, comments and commits are in English.

## Commands

| Command                                   | Purpose                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev`                             | Vite dev server on http://localhost:5173                                              |
| `npm run build`                           | Type-check and production build to `dist/`                                            |
| `npm run verify`                          | Runs `type-check`, `lint`, `format:check` and `test`. **Run it before every commit.** |
| `npm test` / `npm run test:unit`          | Vitest, once / in watch mode                                                          |
| `npm run test:e2e`                        | Playwright (chromium, headless). It starts the dev server itself                      |
| `npm run lint` / `npm run lint:fix`       | ESLint, which also enforces the layer rules below                                     |
| `npm run format` / `npm run format:check` | oxfmt                                                                                 |

## Architecture (Clean Architecture)

Dependencies point inward only. ESLint (`no-restricted-imports` in `eslint.config.ts`) fails the build when a layer imports an outer one.

```
src/
  domain/          entities + rules. Pure TS: no Vue, DOM, storage, timers or Math.random
    model/         Enemy, Tower (+5 kinds), TowerSlot, Barricade, Projectile, Person, Conversion, Level, Campaign
    rules/         balance catalogs (towers, barricades, enemy stats, abilities)
    levels/        level1..5 + registry (LEVEL_IDS, createLevel)
    services/      waveGenerator
    random.ts      Random port + seeded (mulberry32) and Math.random implementations
  application/     use cases. Depends on domain only
    session/       GameSession (one running level), presenter (session → GameSnapshot), Scene, viewport math
    ports/         KeyValueStore, FrameScheduler (interfaces implemented in infrastructure)
    dto/views.ts   plain view models for the UI
    CampaignService.ts
  infrastructure/  adapters: localStorage/memory stores, requestAnimationFrame scheduler, canvas renderers
  stores/          Pinia: interface adapters between the UI and the application
    services.ts    injected adapters (provideServices / useServices)
  ui/
    components/    atomic, props in / events out, no custom child components, no stores
    layouts/       compose components, may use stores
    pages/         route targets (MainMenuPage, LevelSelectPage, GamePage)
  router/          / (menu), /levels, /game/:levelId
  styles/          SCSS tokens, mixins, base and shared BEM blocks
  main.ts          composition root: the only place that names concrete adapters
```

Key rules:

- **Time is in frames at 60 fps.** `update(dt)` gets frames. `GameSession.advance(realFrames)` applies speed (×0.5…×8), pause and the ×0.5 slow-down while a dialog is open.
- **Randomness is injected.** Gameplay uses `Random` (`rng.next()`, `rng.id(prefix)`). Pass `createSeededRandom(seed)` in tests for reproducible runs. Renderers may use `Math.random` for cosmetics only.
- **Entities are never reactive.** `gameStore` keeps the `GameSession` in a plain variable and publishes `snapshot` (a `GameSnapshot` DTO) via `shallowRef` after each tick. Canvas renderers read the session through the read-only `Scene` interface.
- **Commands return `CommandResult`** (`{ok}` or `{ok:false, error}`). The store turns errors into toasts. Domain and application code never show UI.
- **New level:** add `src/domain/levels/levelN.ts` and register it in `levels/registry.ts`.
- **New story effect:** extend `EventEffect` (`domain/model/Level.ts`), then handle it in `GameSession.applyEffect` and `canAfford`.
- **Persistence** goes through the `KeyValueStore` port (keys are prefixed `cosmicBastion:` in localStorage).

## UI rules

- **Component** (`ui/components`): atomic. It contains only native elements, gets data via props and reports via emits. It never imports another `.vue` file or a store.
- **Layout** (`ui/layouts`): a reusable block built from components. It may read and act on stores.
- **Page** (`ui/pages`): what the user sees on a route, composed from layouts and components.
- Confirmations use `useUiStore().confirm(message)` (a promise). Never use `window.confirm`/`alert`.

## Styling

- SCSS with BEM: `.block`, `.block__element`, `.block--modifier`. Nest with `&__` and `&--`.
- `styles/_tokens.scss` (colors, spacing, z-index) and `styles/_mixins.scss` are injected into every `<style lang="scss">` via `vite.config.ts`. Use the variables, don't hard-code the palette.
- Reusable blocks live in `styles/blocks/` (`button`, `panel-block`, `modal`) and are loaded globally from `styles/main.scss`. Component-specific styles stay in `<style scoped lang="scss">`.
- No inline `style=` except dynamic values (e.g. progress width).

## Code style

- 4-space indent. oxfmt also indents the contents of `<script>`, `<template>` and `<style>` (`vueIndentScriptAndStyle`). No semicolons, single quotes, 100 columns.
- Keep dependencies small. Runtime deps are only `vue`, `vue-router` and `pinia`; ask before adding any.
- Tests: Vitest specs live next to the code in `__tests__/`; e2e specs live in `e2e/`.
- Commits follow Conventional Commits: `feat(scope): …`, `fix: …`, `refactor: …`, `test: …`, `docs: …`, `chore: …`.

## Known gaps

See `TODO.md`.
