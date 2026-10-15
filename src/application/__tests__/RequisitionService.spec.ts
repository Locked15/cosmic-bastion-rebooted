import { describe, expect, it } from 'vitest'
import { createLevel, createSeededRandom, upgradeCost, upgradeDefinition } from '@/domain'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { RequisitionService } from '../RequisitionService'
import { GameSession } from '../session/GameSession'

const funded = (amount: number) => {
    const storage = new MemoryStore()
    storage.write('requisitions', { balance: amount, earned: amount, spent: 0, levels: {} })
    return { storage, service: new RequisitionService(storage) }
}

describe('RequisitionService', () => {
    it('buys levels at rising prices until the money or the levels run out', () => {
        const { storage, service } = funded(100)
        const mining = upgradeDefinition('mining')!
        expect(service.buy('mining')).toEqual({ ok: true })
        expect(service.balance).toBe(100 - upgradeCost(mining, 0))
        expect(service.view().tiers[0]!.upgrades[0]).toMatchObject({
            level: 1,
            cost: upgradeCost(mining, 1),
            current: '+6%',
            next: '+12%',
        })
        expect(service.buy('breach_tolerance')).toEqual({
            ok: false,
            error: 'Недостаточно реквизиций',
        })
        expect(service.buy('nope').ok).toBe(false)
        expect(new RequisitionService(storage).view().spent).toBe(upgradeCost(mining, 0))
    })

    it('stops at the maximum level', () => {
        const { service } = funded(100_000)
        const upgrade = upgradeDefinition('breach_tolerance')!
        for (let level = 0; level < upgrade.maxLevel; level++) service.buy(upgrade.id)
        expect(service.buy(upgrade.id)).toEqual({ ok: false, error: 'Наряд исполнен полностью' })
        const tiers = service.view().tiers
        const view = tiers[tiers.length - 1]!.upgrades[0]!
        expect(view).toMatchObject({ cost: null, next: null, affordable: false })
    })

    it('refunds 75% of everything spent on reset', () => {
        const { service } = funded(1000)
        service.buy('mining')
        service.buy('mining')
        service.buy('tower_damage')
        const spent = service.view().spent
        const balance = service.balance
        expect(service.view().refund).toBe(Math.floor(spent * 0.75))
        expect(service.reset()).toBe(Math.floor(spent * 0.75))
        expect(service.balance).toBe(balance + Math.floor(spent * 0.75))
        expect(service.view()).toMatchObject({ spent: 0, refund: 0 })
        expect(service.bonuses.towerDamage).toBe(1)
    })

    it('pays missions and back-pays sectors won before requisitions existed', () => {
        const storage = new MemoryStore()
        storage.write('campaign', {
            completedLevels: ['level_1'],
            totalStars: 2,
            currentLevelIndex: 0,
            levels: [{ id: 'level_1', completed: true, stars: 2, locked: false }],
        })
        const service = new RequisitionService(storage)
        expect(service.balance).toBe(40 + 30 + 40)
        expect(service.award('defeat', 0, false)).toBe(10)
        expect(service.view().earned).toBe(120)
        // Back pay happens once.
        expect(new RequisitionService(storage).balance).toBe(120)
    })

    it('applies bought upgrades to a level run', () => {
        const { service } = funded(100_000)
        for (const id of [
            'start_resources',
            'start_military',
            'breach_tolerance',
            'tower_range',
            'mining',
        ])
            service.buy(id)
        const level = createLevel('level_1')!
        const session = new GameSession(level, createSeededRandom(1), { bonuses: service.bonuses })
        expect(session.resources).toBe(level.startingResources + 30)
        expect(session.military).toBe(level.startingMilitary + 1)
        expect(session.maxBreakthroughs).toBe(
            new GameSession(createLevel('level_1')!, createSeededRandom(1)).maxBreakthroughs + 1,
        )

        session.resources = 10_000
        session.buildTower(session.slots[0]!.id, 'cannon')
        for (let frame = 0; frame < 600 && !session.slots[0]!.tower; frame++) session.update(1)
        session.update(1)
        expect(session.slots[0]!.tower!.range).toBeCloseTo(120 * 1.04)

        session.startWave()
        session.update(1)
        expect(session.resourceRate).toBeCloseTo(session.miners * 0.5 * 1.06)
    })
})
