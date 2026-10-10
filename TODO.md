# TODO

Features from the design brief (`../cosmic-bastion/Промт.docx`) that are not implemented yet, plus follow-ups from the Vue rewrite.

## Gameplay

- [ ] Boss abilities exist only as names: `dodge` (every third projectile), `confuse`, `blind` (shoot the last known position), `destroy` (wipe a tower; slot reusable after 5 s), `spawn` (every 10 s, up to 5).
- [ ] Spawn bosses at a random point in the first half of the path.
- [ ] Story effects `buffDamage` and `buffBarricades` are ignored (`GameSession.applyEffect`).
- [ ] Laser: half damage to enemies crossed by the beam; level 3 beam across the whole map.
- [ ] Shock tower level 3: stun groups of 3+ close enemies for 7 s every 10 s (now a 30% chance per hit for 1 s).
- [ ] Barricades:
    - [ ] Wall level 3: push stopped enemies back every 5 s.
    - [ ] Filter level 3: let weak enemies through slowed.
    - [ ] Laser shield (`shield`): not unlocked in any level.
- [ ] Barricade upgrades are instant. They should take time like towers, with the button locked during the upgrade.
- [ ] Barricades should snap onto the enemy path ("стена автоматически выравнивается на дороге"). Placement is free now.
- [ ] Enemy damage to barricades proportional to enemy size (`mass`).
- [ ] Adaptation ability: should not work on the last tower on the path or when only one tower exists.
- [ ] Soldiers in the living quarters should retreat slowly while shooting.

## Story and campaign

- [ ] Event kinds from the brief:
    - [ ] Fully described events.
    - [ ] Partial events (no costs or consequences shown, but a follow-up window).
    - [ ] Unknown events (hidden consequences, no follow-up window).
- [ ] Consequence window after a choice ("второе окно с последствиями").
- [ ] Limits: at most 3 dialogs per wave and 10 per level. Dialogs can appear mid-wave, not only at the start.
- [ ] Refugee event with accept / redirect (repeat on the next level) / refuse.
- [ ] Choices affecting later levels and campaign-wide state.
- [ ] Global ship map with several active missions at once; story levels that advance even on tactical failure.
- [ ] Meta-progression: unlock towers and barricades along the campaign. Unlocks are fixed now in `presenter.ts` (`UNLOCKED_TOWERS`, `UNLOCKED_BARRICADES`).
- [ ] Level objectives never checked: `max_towers`, `save_reactor`, `no_personnel_loss`.

## UI

- [ ] Animated ship blueprint over a hostile landscape in the main menu.
- [ ] Achievements (existed in the vanilla version: first blood, builder, survivor, economist, general).
- [ ] Save and resume an in-progress level (the vanilla version auto-saved every 30 s). Only campaign progress and settings are saved now.
- [ ] Sound: the volume setting exists, but there is no audio.
- [ ] Living quarters status should show people in transit (active conversions).
- [ ] Responsive layout below 1024 px wide.

## Tooling

- [ ] A programmatic automation API (the vanilla `window.CosmicBastion`) was not carried over. E2E drives the real UI instead.
- [ ] CI workflow running `npm run verify` and `npm run test:e2e`.
