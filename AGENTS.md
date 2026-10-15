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

Music files (`public/audio/music/*.webm`) are stored in **Git LFS**: run `git lfs install` once before cloning, or `git lfs pull` in an existing clone. Without it the files are LFS pointers and the game stays silent.

## Architecture (Clean Architecture)

Dependencies point inward only. ESLint (`no-restricted-imports` in `eslint.config.ts`) fails the build when a layer imports an outer one.

```
src/
  domain/          entities + rules. Pure TS: no Vue, DOM, storage, timers or Math.random
    model/         Enemy, Tower (+5 kinds), TowerSlot, Barricade, Projectile, Person, Conversion, Level, Campaign
    content/       parseContent + shared Valibot schema pieces
    rules/         typed catalogs parsed from content (towers, barricades, enemies, waves, difficulty)
    levels/        level schema (LevelDefinition, effects, objectives, carry-over) + registry
    story/         campaign graph, endings, event templates (refugees), technology tree / unlocks
    achievements/  achievement definitions
    services/      waveGenerator
    random.ts      Random port + seeded (mulberry32) and Math.random implementations
  content/         game data as JSON, validated at startup (see "Content" below)
  application/     use cases. Depends on domain only
    session/       GameSession (combat, building, waves, pointer) composed of:
                   personnel.ts, livingQuarters.ts, story.ts (StoryDirector), effects.ts,
                   objectives.ts (ObjectiveTracker), checkpoint.ts; presenter.ts + presenters/
                   turn the session into GameSnapshot; scene.ts is the read model for renderers
    profiles/      ProfileService (≤3 profiles, briefing line), CachedStore/SwitchingStore
    ports/         KeyValueStore, ProfileRepository, FrameScheduler, SoundPlayer, MusicPlayer (implemented in infrastructure)
    dto/           plain view models for the UI
    CampaignService, CheckpointService, AchievementService, RequisitionService
  infrastructure/  adapters: localStorage/memory stores, requestAnimationFrame scheduler,
                   canvas renderers, Web Audio synth sounds
  stores/          Pinia: interface adapters between the UI and the application
    services.ts    injected adapters (provideServices / useServices)
  ui/
    components/    atomic, props in / events out, no custom child components, no stores
    layouts/       compose components, may use stores
    pages/         route targets (MainMenuPage, LevelSelectPage, GamePage)
  router/          / (menu), /levels, /quartermaster, /game/:levelId (?resume=1 continues a checkpoint)
  styles/          SCSS tokens, mixins, base and shared BEM blocks
  main.ts          composition root: the only place that names concrete adapters
```

Key rules:

- **Time is in frames at 60 fps.** `update(dt)` gets frames. `GameSession.advance(realFrames)` applies speed (×0.5…×8), pause and the ×0.5 slow-down while a dialog is open.
- **Randomness is injected.** Gameplay uses `Random` (`rng.next()`, `rng.id(prefix)`). Pass `createSeededRandom(seed)` in tests for reproducible runs. Renderers may use `Math.random` for cosmetics only.
- **Entities are never reactive.** `gameStore` keeps the `GameSession` in a plain variable and publishes `snapshot` (a `GameSnapshot` DTO) via `shallowRef` after each tick. Canvas renderers read the session through the read-only `Scene` interface.
- **Commands return `CommandResult`** (`{ok}` or `{ok:false, error}`). The store turns errors into toasts. Domain and application code never show UI.
- **Level layout rules** (tested in `domain/__tests__/layout.spec.ts`): tower foundations stay ≥45 px from every enemy route and ≥50 px from each other. Barricades can only be placed via `Level.barricadePlacement` (snapped onto a route); an intact barricade stops enemies until destroyed. Enemies enter the living quarters only at the end of their route.
- **Difficulty** (`domain/rules/difficulty.ts`) scales enemy health and speed and sets how many breakthroughs lose the level. It is read from settings when a level starts and stored in checkpoints.
- **Campaign progression:** a level is completed — and the sectors that require it unlock — only on victory. Defeats keep story flags but never advance the map.
- **Campaign context** reaches a level through `SessionOptions` (unlocks, story flags); the session never reads storage.
- **New story effect:** extend `EventEffect` and `effectSchema` (`domain/levels/schema.ts`), then handle it in `applyEffect` and `canAfford` (`application/session/effects.ts`).
- **New objective kind:** add it to `OBJECTIVE_KINDS` (`domain/levels/schema.ts`) and handle it in `ObjectiveTracker` (`application/session/objectives.ts`).
- **Persistence:** services use the synchronous `KeyValueStore` port. In the app it is the active profile's `CachedStore`: `ProfileService.open` (in `main.ts`) loads every profile from IndexedDB (`IdbProfileRepository`, via `idb`) before the app mounts; writes update memory at once and reach IndexedDB in order. Settings are device-wide (`AppServices.deviceStorage`); campaign, checkpoints and achievements belong to a profile. Old `cosmicBastion:` localStorage saves move into the first profile.
- **Profiles:** at most three. Without an active profile the security dialog (`ProfilesModal`) cannot be closed and mission routes redirect to the menu. After a switch, `profileStore` reloads the campaign and achievement stores. The menu greeting comes from `content/briefings.json` by story progress.

## UI rules

- **Component** (`ui/components`): atomic. It contains only native elements, gets data via props and reports via emits. It never imports another `.vue` file or a store.
- The UI never imports `@/domain` or `@/infrastructure` (lint-enforced); it gets data from stores and DTOs.
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
- Keep dependencies small. Runtime deps are only `vue`, `vue-router`, `pinia`, `valibot` and `idb`; ask before adding any.
- Store and UI tests set up services with `provideTestServices()` (`application/__tests__/testServices.ts`).
- Tests: Vitest specs live next to the code in `__tests__/`; e2e specs live in `e2e/`.
- Commits follow Conventional Commits: `feat(scope): …`, `fix: …`, `refactor: …`, `test: …`, `docs: …`, `chore: …`.

## Content

Game content is data in `src/content/*.json`; code only interprets it. Each file is parsed by a Valibot schema when its module loads, so a mistake fails the app and `npm test` with the path to the bad value. Kinds of things (tower types, effect types, objective kinds) stay in code; numbers and texts are data.

| File                                                          | What it holds                                                                             | Schema                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `levels/level_N.json`                                         | One level: geometry, tower slots, start, waves, objectives, events, carry-over            | `domain/levels/schema.ts`                             |
| `campaign.json`                                               | Sector order, prerequisites, ship-map rooms and conduits, finale, `contentVersion`        | `domain/story/campaign.ts`                            |
| `endings.json`                                                | Endings after the finale, chosen by outcome and story flags                               | `domain/story/endings.ts`                             |
| `events/refugees.json`                                        | Texts and prices of the refugee event template                                            | `domain/story/events.ts`                              |
| `towers.json`, `barricades.json`                              | Costs, base stats and per-level upgrade stats                                             | `domain/rules/*Catalog.ts`                            |
| `enemies.json`                                                | Enemy stats, ability texts, wave generation                                               | `domain/rules/enemyRules.ts`                          |
| `music.json`                                                  | Soundtrack catalogue, menu track and the license credit; levels pick a track with `music` | `domain/story/soundtrack.ts`                          |
| `requisitions.json`                                           | Meta-progression: earning, ranks and prices, upgrades and their effects, reset refund     | `domain/meta/requisitions.ts`                         |
| `briefings.json`                                              | Main-menu greeting line by story progress (`{name}` is the profile)                       | `domain/story/briefing.ts`                            |
| `difficulties.json`, `technologies.json`, `achievements.json` | Settings levels, tech tree, achievements                                                  | `domain/rules`, `domain/story`, `domain/achievements` |

- **New level:** add `src/content/levels/level_N.json` (the `id` must match the file name) and a sector for it in `campaign.json`. A sector may only require sectors listed before it. The layout and content tests run on every level automatically.
- **Level events:** `when` lists story-flag conditions (`atLeast` / `below`). Pairs of events with opposite conditions give branches. At most 3 events per wave and 10 per level; timers 7–15 s.
- **Carry-over** (`carryOver` in a level): `start` adds flag sums to the starting stats, `effect` applies an effect at the start when flags hold, `excludeAbility` removes an enemy ability from the level's waves.
- **Requisitions (meta-progression):** each profile earns requisitions for missions (`RequisitionService`, key `requisitions`) and spends them on permanent upgrades in the quartermaster terminal (`/quartermaster`). Upgrades become `MetaBonuses` passed to `GameSession` via `SessionOptions.bonuses`. A new upgrade effect needs a `BONUS_KINDS` entry (`domain/meta/requisitions.ts`) and handling in `GameSession`.
- **Music:** every level has its own track (`music` in its file); the menu and ship map play `music.json#menu`. `HtmlMusicPlayer` loops and crossfades tracks and starts after the first user gesture when autoplay is blocked. New tracks must allow redistribution (CC0/CC BY); add the file as Opus WebM to `public/audio/music/`, list it in `music.json` and credit it in `CREDITS.md`.
- **Changing an existing level's layout:** bump `contentVersion` in `campaign.json`, so old between-wave checkpoints of that content are discarded.

## Story

Story content (levels, events, characters, names) follows the story bible in `docs/LORE.md`.

## Known gaps

See `TODO.md`.
