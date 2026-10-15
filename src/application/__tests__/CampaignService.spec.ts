import { describe, expect, it } from 'vitest'
import { CAMPAIGN, createLevel, createSeededRandom } from '@/domain'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { CampaignService } from '../CampaignService'
import { GameSession } from '../session/GameSession'

describe('CampaignService', () => {
    it('unlocks the next level and persists progress', () => {
        const storage = new MemoryStore()
        const service = new CampaignService(storage)
        expect(service.isUnlocked('level_2')).toBe(false)

        service.completeLevel('level_1', 2)

        const reloaded = new CampaignService(storage)
        expect(reloaded.isUnlocked('level_2')).toBe(true)
        expect(reloaded.listLevels().find((level) => level.id === 'level_1')).toMatchObject({
            completed: true,
            stars: 2,
        })
        expect(reloaded.hasProgress).toBe(true)

        reloaded.reset()
        expect(new CampaignService(storage).isUnlocked('level_2')).toBe(false)
    })
})

describe('CampaignService carry-over and endings', () => {
    function serviceWith(flags: Record<string, number>, completed: string[] = []) {
        const storage = new MemoryStore()
        storage.write('campaign', {
            flags,
            completedLevels: completed,
            totalStars: 0,
            currentLevelIndex: 0,
            levels: completed.map((id) => ({ id, completed: true, stars: 1, locked: false })),
        })
        return new CampaignService(storage)
    }

    it('turns carry-over rules of a level into start effects and excluded abilities', () => {
        const level = createLevel('level_2')!
        level.carryOver = [
            { type: 'start', stat: 'military', flags: ['a', 'b'], divide: 2 },
            {
                type: 'effect',
                when: [{ flag: 'a', atLeast: 1 }],
                effect: { type: 'buffBarricades', value: 1.5 },
                message: 'Стены усилены',
            },
            { type: 'excludeAbility', when: [{ flag: 'b', atLeast: 1 }], ability: 'sabotage' },
            { type: 'excludeAbility', when: [{ flag: 'missing', atLeast: 1 }], ability: 'split' },
        ]
        const military = level.startingMilitary
        const options = serviceWith({ a: 3, b: 2 }).prepareLevel(level)
        expect(level.startingMilitary).toBe(military + 2)
        expect(options.startEffects).toEqual([
            { effect: { type: 'buffBarricades', value: 1.5 }, message: 'Стены усилены' },
        ])
        expect(options.excludedAbilities).toEqual(['sabotage'])

        const session = new GameSession(level, createSeededRandom(1), options)
        expect(session.barricadeMultiplier).toBe(1.5)
        expect(session.drainMessages()).toContain('Стены усилены')
    })

    it('reports an ending only for the finale', () => {
        const service = serviceWith({}, [
            'level_1',
            'level_2',
            'level_3',
            'level_4',
            'level_9',
            'level_10',
            'level_14',
            'level_15',
        ])
        const report = { stars: 1, objectives: [], flags: {}, survivors: 10 }
        expect(service.recordResult('level_1', { ...report, outcome: 'victory' }).ending).toBeNull()
        const finale = CAMPAIGN.finale
        expect(service.isUnlocked(finale)).toBe(true)
        expect(service.recordResult(finale, { ...report, outcome: 'defeat' }).ending?.id).toBe(
            'communion',
        )
        expect(service.recordResult(finale, { ...report, outcome: 'victory' }).ending?.id).toBe(
            'bastion',
        )
    })
})
