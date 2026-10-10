import { describe, expect, it } from 'vitest'
import { createLevel, createSeededRandom, type CampaignProgress } from '@/domain'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { CampaignService, type MissionReport } from '../CampaignService'
import { GameSession } from '../session/GameSession'
import { presentBuildOptions, canUpgradeTechnology } from '../session/presenters/buildOptions'
import { applyEffect } from '../session/effects'

function report(overrides: Partial<MissionReport> = {}): MissionReport {
    return { outcome: 'victory', stars: 2, objectives: [], flags: {}, survivors: 18, ...overrides }
}

describe('campaign story progression', () => {
    it('persists choices, unlocks and non-linear availability through storage', () => {
        const storage = new MemoryStore()
        const campaign = new CampaignService(storage)
        const result = campaign.recordResult(
            'level_1',
            report({
                flags: {
                    tech_laser: 1,
                    supply_cache: 100,
                    refugees_pending: 1,
                    refugees_miners: 4,
                    refugees_military: 2,
                    refugees_from: 1,
                },
            }),
        )
        expect(result.advanced).toBe(true)
        expect(result.unlocks).toEqual(
            expect.arrayContaining([
                'Ракетница',
                'Баррикада «Фильтр»',
                'Лазерная установка',
                'Улучшения II',
            ]),
        )
        const reloaded = new CampaignService(storage)
        expect(reloaded.isUnlocked('level_2')).toBe(true)
        expect(reloaded.isUnlocked('level_3')).toBe(true)
        expect(reloaded.isUnlocked('level_4')).toBe(false)
        const level = createLevel('level_3')!
        const options = reloaded.prepareLevel(level)
        expect(level.startingResources).toBe(450)
        expect(options.unlockedTowers).toContain('laser')
        expect(options.campaignFlags?.refugees_pending).toBe(1)
        const session = new GameSession(level, createSeededRandom(1), options)
        session.chooseDialog(0) // The guaranteed group arrives first; acceptance keeps its consequence open.
        expect(session.story.active?.dialog.title).toContain('БЕЖЕНЦЫ')
        expect(session.story.active?.dialog.text).toContain('4 шахтёра и 2 военных')
        expect(reloaded.flags.refugees_pending).toBe(1)
        expect(presentBuildOptions(session).map((option) => option.type)).toContain('laser')
        reloaded.recordResult('level_3', report({ flags: session.story.flags }))
        expect(new CampaignService(storage).flags.refugees_pending).toBe(0)
    })

    it.each([
        ['level_1', 'save_engineer'],
        ['level_3', 'save_scientist'],
        ['level_5', 'save_archive'],
    ])('advances %s on tactical failure only when its key objective is completed', (id, key) => {
        const storage = new MemoryStore()
        const campaign = new CampaignService(storage)
        for (const previous of ['level_1', 'level_2', 'level_3', 'level_4']) {
            if (previous === id) break
            campaign.completeLevel(previous, 2)
        }
        const failed = campaign.recordResult(
            id,
            report({
                outcome: 'defeat',
                objectives: [{ id: key, text: 'Спасение', completed: false }],
            }),
        )
        expect(failed.advanced).toBe(false)
        expect(campaign.listLevels().find((level) => level.id === id)?.completed).toBe(false)
        const saved = campaign.recordResult(
            id,
            report({
                outcome: 'defeat',
                objectives: [{ id: key, text: 'Спасение', completed: true }],
            }),
        )
        expect(saved.advanced).toBe(true)
        expect(
            new CampaignService(storage).listLevels().find((level) => level.id === id),
        ).toMatchObject({ completed: true, stars: 0 })
    })

    it('does not advance ordinary failed missions or accept results for locked missions', () => {
        const campaign = new CampaignService(new MemoryStore())
        expect(campaign.recordResult('level_5', report()).advanced).toBe(false)
        expect(campaign.recordResult('missing', report()).advanced).toBe(false)
        campaign.completeLevel('level_1', 1)
        expect(
            campaign.recordResult(
                'level_2',
                report({
                    outcome: 'defeat',
                    objectives: [{ id: 'survive', text: '', completed: true }],
                }),
            ).advanced,
        ).toBe(false)
        expect(campaign.isUnlocked('level_4')).toBe(false)
    })

    it('applies choice supplies and actual survivors to later starting conditions', () => {
        const campaign = new CampaignService(new MemoryStore())
        campaign.recordResult('level_1', report({ flags: { supply_cache: 100 } }))
        campaign.recordResult('level_2', report({ flags: { lab_supplies: 80 }, survivors: 12 }))
        expect(
            campaign.listLevels().find((level) => level.id === 'level_3')?.startingResources,
        ).toBe(530)
        campaign.recordResult('level_3', report({ survivors: 18 }))
        const fourth = createLevel('level_4')!
        campaign.prepareLevel(fourth)
        expect(fourth.startingMiners).toBe(25) // 22 + (12 + 18) / 10
        campaign.recordResult('level_4', report({ survivors: 29 }))
        const fifth = createLevel('level_5')!
        campaign.prepareLevel(fifth)
        expect(fifth.startingMilitary).toBe(17)
        expect(campaign.listLevels().find((level) => level.id === fifth.id)?.startingMilitary).toBe(
            fifth.startingMilitary,
        )
    })

    it('computes early tech from real story choices and does not reannounce unlocks on replays', () => {
        const campaign = new CampaignService(new MemoryStore())
        const level = createLevel('level_1')!
        const session = new GameSession(level, createSeededRandom(1), campaign.prepareLevel(level))
        applyEffect(session, { type: 'unlockTower', tower: 'laser' })
        const first = campaign.recordResult(level.id, report({ flags: session.story.flags }))
        expect(first.unlocks).toContain('Лазерная установка')
        expect(
            campaign.recordResult(level.id, report({ flags: session.story.flags })).unlocks,
        ).toEqual([])
        campaign.completeLevel('level_3', 2)
        expect(campaign.unlocks.towers).toContain('shock')
        expect(campaign.unlocks.barricades).toContain('shield')
        expect(campaign.unlocks.upgradeTier).toBe(3)
    })

    it('gates upgrades with the campaign tier for towers and barricades', () => {
        const campaign = new CampaignService(new MemoryStore())
        const level = createLevel('level_1')!
        level.events = []
        const session = new GameSession(level, createSeededRandom(1), campaign.prepareLevel(level))
        session.buildTower(session.slots[0]!.id, 'cannon')
        for (let frame = 0; frame < 1000; frame++) session.update(1)
        const slot = session.slots[0]!
        expect(canUpgradeTechnology(session, slot.id)).toBe(true)
        slot.tower!.level = 1
        expect(canUpgradeTechnology(session, slot.id)).toBe(false)
        session.story.flags.tech_upgrade_tier = 2
        expect(canUpgradeTechnology(session, slot.id)).toBe(true)
        session.buildBarricade(level.basePath[2]!, 'wall')
        const wall = session.barricades[0]!
        wall.level = 2
        expect(canUpgradeTechnology(session, wall.id)).toBe(false)
        session.story.flags.tech_upgrade_tier = 3
        expect(canUpgradeTechnology(session, wall.id)).toBe(true)
    })

    it('loads old saves without flags, isolates returned state, and resets all progression', () => {
        const storage = new MemoryStore()
        storage.write<CampaignProgress>('campaign', {
            completedLevels: ['level_1'],
            totalStars: 2,
            currentLevelIndex: 0,
            levels: [{ id: 'level_1', completed: true, stars: 2, locked: false }],
        })
        const campaign = new CampaignService(storage)
        expect(campaign.isUnlocked('level_3')).toBe(true)
        expect(campaign.flags).toEqual({})
        campaign.recordResult('level_2', report({ flags: { lab_supplies: 80 } }))
        const flags = campaign.flags
        flags.lab_supplies = 999
        expect(campaign.flags.lab_supplies).toBe(80)
        const unlocks = campaign.unlocks
        unlocks.towers.push('shock')
        expect(campaign.unlocks.towers).not.toContain('shock')
        campaign.reset()
        const reloaded = new CampaignService(storage)
        expect(reloaded.hasProgress).toBe(false)
        expect(reloaded.flags).toEqual({})
        expect(reloaded.unlocks.towers).toEqual(['cannon', 'machinegun'])
    })
})
