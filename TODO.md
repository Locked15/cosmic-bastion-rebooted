# TODO

Remaining work and known limitations. Implemented items from the original list are recorded in git history (`git log --oneline`).

## Open

- [ ] Floor breaches (shortcuts into the living quarters that barricades can seal) were removed for now; reintroduce once the core loop is balanced.
- [ ] Programmatic automation API (the vanilla `window.CosmicBastion`) was not carried over by choice; e2e drives the real UI.
- [ ] Level save is a checkpoint between waves. Leaving mid-wave loses the progress of the current wave.
- [ ] Layout is tuned for 1024 px and wider; phones and touch input are not supported.
- [ ] Choices show `hint` text only for fully described events; consider short hints for partial ones.
- [ ] Balance pass for the new boss abilities, tech tree and sectors 6–9 (values are first guesses; they live in `src/content`).
- [ ] Optional: generate JSON Schema files from the Valibot schemas (`@valibot/to-json-schema`) for editor autocompletion in `src/content`.

- [ ] Full event hints don't mention relationship changes yet (e.g. "Ренн это запомнит").
- [ ] Balance pass for relationship values and thresholds (`content/cast.json`, `content/scenes.json`).
- [ ] Character portraits for scenes.
- [ ] Rework replays of held sectors: a replay currently writes its story choices back into the campaign (both `ballast_dumped` and `ballast_kept` can end up set) and adds relationship changes again (reputation can be farmed). Replays should run as drills: combat, stars and requisitions only.
- [ ] Economy: Младший лейтенант earns ×0.6 requisitions and needs about 9 replay passes to complete the common trees (Лейтенант about 3); consider a higher multiplier for that rank.

## Done (summary)

- Gameplay:
    - Walls block enemies until they are destroyed.
    - Barricades snap to the track or a breach.
    - Tower foundations are off the track.
    - Enemy, mini-boss and boss abilities follow the brief.
    - Tower and barricade upgrade lines, with timed barricade upgrades.
    - Story buffs.
- Story:
    - Full, partial and unknown events, with a consequence window.
    - Dialog limits and timers.
    - Refugees event.
    - Campaign flags.
    - Tech tree.
    - Branching ship map.
    - Key objectives.
    - Nine sectors on a tactical deck plan, four endings (`docs/LORE.md`).
    - Relationships and romance: disposition for the cast, affection for four romanceable characters, optional scenes between missions, a partner choice before the finale, epilogues and the golden ending.
- Content: levels, campaign, endings, balance, tech tree and achievements are validated JSON in `src/content`.
- UI:
    - Animated main-menu blueprint.
    - Achievements.
    - Between-wave level checkpoints.
    - Synthesized sound.
    - People in transit.
    - Compact layout.
- Tooling: GitHub Actions CI (`npm run verify`, build, Playwright).
