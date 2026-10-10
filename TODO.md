# TODO

Remaining work and known limitations. Implemented items from the original list are recorded in git history (`git log --oneline`).

## Open

- [ ] Floor breaches (shortcuts into the living quarters that barricades can seal) were removed for now; reintroduce once the core loop is balanced.
- [ ] Programmatic automation API (the vanilla `window.CosmicBastion`) was not carried over by choice; e2e drives the real UI.
- [ ] Level save is a checkpoint between waves. Leaving mid-wave loses the progress of the current wave.
- [ ] Layout is tuned for 1024 px and wider; phones and touch input are not supported.
- [ ] Choices show `hint` text only for fully described events; consider short hints for partial ones.
- [ ] Balance pass for the new boss abilities and tech tree (values are first guesses).

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
- UI:
    - Animated main-menu blueprint.
    - Achievements.
    - Between-wave level checkpoints.
    - Synthesized sound.
    - People in transit.
    - Compact layout.
- Tooling: GitHub Actions CI (`npm run verify`, build, Playwright).
