import { describe, expect, it } from 'vitest'
import {
    REQUISITIONS,
    createLevel,
    createSeededRandom,
    missionReward,
    NO_RECORD,
    upgradeCost,
    upgradeDefinition,
    type CampaignProgress,
    type DifficultyId,
} from '@/domain'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { RequisitionService } from '../RequisitionService'
import { GameSession } from '../session/GameSession'

function campaign(storage: MemoryStore, completed: string[], stars = 2) {
    storage.write<CampaignProgress>('campaign', {
        completedLevels: completed,
        totalStars: completed.length * stars,
        currentLevelIndex: 0,
        levels: completed.map((id) => ({ id, completed: true, stars, locked: false })),
    })
}

const funded = (amount: number, difficulty: DifficultyId = 'modest', completed: string[] = []) => {
    const storage = new MemoryStore()
    campaign(storage, completed)
    storage.write('requisitions', {
        version: 2,
        balance: amount,
        earned: amount,
        spent: 0,
        levels: {},
        missions: {},
    })
    return { storage, service: new RequisitionService(storage, { difficulty: () => difficulty }) }
}

const upgrade = (service: RequisitionService, id: string) =>
    service
        .view()
        .trees.flatMap((tree) => tree.tiers.flatMap((tier) => tier.upgrades))
        .find((candidate) => candidate.id === id)!

describe('RequisitionService', () => {
    it('pays first victories, new stars and diminishing replays with the rank multiplier', () => {
        const { service } = funded(0)
        const win = { outcome: 'victory' as const, stars: 2, wavesHeld: 4 }
        const first = missionReward(NO_RECORD, win)
        expect(service.award('level_1', win, 1.6)).toBe(Math.round(first.amount * 1.6))
        const replay = missionReward(first.record, { ...win, stars: 3 })
        expect(service.award('level_1', { ...win, stars: 3 })).toBe(replay.amount)
        // Another sector is a first victory again.
        expect(service.award('level_2', win)).toBe(first.amount)
        expect(service.award('level_2', { outcome: 'defeat', stars: 0, wavesHeld: 2 })).toBe(
            2 * REQUISITIONS.earning.defeatPerWave,
        )
    })

    it('opens tiers by purchases over all trees and buys at rising prices', () => {
        const { service } = funded(100_000)
        expect(upgrade(service, 'upgrade_step_two').blocked).toBe(
            'Разряд II откроется после 4 нарядов',
        )
        expect(service.buy('upgrade_step_two')).toEqual({
            ok: false,
            error: 'Разряд II откроется после 4 нарядов',
        })
        const prices: number[] = []
        for (let i = 0; i < 2; i++) {
            prices.push(upgrade(service, 'tower_damage').cost!)
            expect(service.buy('tower_damage').ok).toBe(true)
        }
        // Crew purchases count too.
        service.buy('mining')
        service.buy('mining')
        expect(prices[1]).toBeGreaterThan(prices[0]!)
        expect(service.view().purchases).toBe(4)
        expect(upgrade(service, 'upgrade_step_two').blocked).toBeNull()
        expect(service.buy('upgrade_step_two').ok).toBe(true)
        expect(service.buy('upgrade_step_two')).toEqual({
            ok: false,
            error: 'Наряд исполнен полностью',
        })
        expect(service.bonuses.upgradeTier).toBe(1)
    })

    it('requires earlier forms and refuses what the balance cannot pay', () => {
        const { service } = funded(20)
        expect(service.buy('tower_damage').ok).toBe(true)
        expect(service.buy('tower_damage')).toEqual({ ok: false, error: 'Недостаточно реквизиций' })
        const rich = funded(1_000_000).service
        for (let i = 0; i < 10; i++) rich.buy(i % 2 ? 'tower_damage' : 'tower_range')
        expect(upgrade(rich, 'upgrade_step_three').blocked).toBe(
            'Сначала нужен наряд «Чертежи второй ступени»',
        )
    })

    it('keeps science and the favours closed until the story and the rank allow them', () => {
        const lieutenant = funded(1_000_000, 'modest', ['level_1', 'level_2'])
        const view = lieutenant.service.view()
        const tree = (id: string) => view.trees.find((candidate) => candidate.id === id)!
        expect(tree('science').locked).toBe('ОТКРОЕТСЯ ПОСЛЕ ПОБЕДЫ В СЕКТОРЕ C-9')
        expect(tree('special').locked).toBe('ДОПУСК ТОЛЬКО ДЛЯ МАЙОРОВ И ГЕНЕРАЛОВ')
        expect(lieutenant.service.buy('enemy_health').ok).toBe(false)

        const major = funded(1_000_000, 'complex', ['level_1', 'level_2', 'level_3', 'level_4'])
        expect(major.service.buy('enemy_health').ok).toBe(true)
        expect(major.service.buy('build_cost').ok).toBe(true)
        expect(major.service.bonuses.buildCost).toBeLessThan(1)
        // The same ledger under a lower rank (dev console re-rank) loses the favours.
        const demoted = new RequisitionService(major.storage, { difficulty: () => 'modest' })
        expect(demoted.bonuses.buildCost).toBe(1)
    })

    it('does not sell a ban the rank already makes pointless', () => {
        const all = Object.fromEntries(REQUISITIONS.upgrades.map((u) => [u.id, u.maxLevel]))
        delete all.ban_destroy
        delete all.ban_blind
        const storage = new MemoryStore()
        campaign(storage, ['level_3'])
        storage.write('requisitions', {
            version: 2,
            balance: 1_000_000,
            earned: 0,
            spent: 0,
            levels: all,
            missions: {},
        })
        const junior = new RequisitionService(storage, { difficulty: () => 'simple' })
        expect(upgrade(junior, 'ban_destroy').blocked).toBe(
            'На вашем звании Средоточия этого не умеют',
        )
        const lieutenant = new RequisitionService(storage, { difficulty: () => 'modest' })
        expect(upgrade(lieutenant, 'ban_blind').blocked).toBeNull()
    })

    it('refunds 75% of everything spent on reset', () => {
        const { service } = funded(1_000)
        service.buy('tower_damage')
        service.buy('mining')
        const spent = upgradeCost(upgradeDefinition('tower_damage')!, 0) * 2
        expect(service.view().spent).toBe(spent)
        expect(service.reset()).toBe(Math.floor(spent * 0.75))
        expect(service.view().purchases).toBe(0)
    })

    it('back-pays held sectors once and converts old ledgers with a full refund', () => {
        const storage = new MemoryStore()
        campaign(storage, ['level_1', 'level_2'], 3)
        const opened = new RequisitionService(storage)
        const paid = missionReward(NO_RECORD, { outcome: 'victory', stars: 3, wavesHeld: 0 })
        expect(opened.balance).toBe(paid.amount * 2)
        expect(new RequisitionService(storage).balance).toBe(paid.amount * 2)
        // Held stars are not paid again.
        expect(
            opened.award('level_1', { outcome: 'victory', stars: 3, wavesHeld: 4 }),
        ).toBeLessThan(paid.amount)

        const old = new MemoryStore()
        campaign(old, ['level_1'], 3)
        old.write('requisitions', {
            balance: 40,
            earned: 200,
            spent: 160,
            levels: { tower_range: 2 },
        })
        const converted = new RequisitionService(old)
        expect(converted.migrationRefund).toBe(160)
        expect(converted.balance).toBe(200)
        expect(converted.view().purchases).toBe(0)
        expect(new RequisitionService(old).migrationRefund).toBe(0)
        expect(
            converted.award('level_1', { outcome: 'victory', stars: 3, wavesHeld: 4 }),
        ).toBeLessThan(paid.amount)
    })

    it('applies bought upgrades to a level run', () => {
        const storage = new MemoryStore()
        campaign(storage, ['level_3', 'level_4'])
        storage.write('requisitions', {
            version: 2,
            balance: 0,
            earned: 0,
            spent: 0,
            levels: {
                start_resources: 1,
                start_military: 1,
                start_miners: 1,
                tower_range: 1,
                fire_rate: 1,
                mining: 1,
                enemy_health: 5,
                horde_size: 4,
                ban_ambush: 1,
                breach_tolerance: 1,
                build_cost: 3,
            },
            missions: {},
        })
        const service = new RequisitionService(storage, { difficulty: () => 'complex' })
        const level = createLevel('level_1')!
        const plain = new GameSession(createLevel('level_1')!, createSeededRandom(1), {
            difficulty: 'complex',
        })
        const session = new GameSession(level, createSeededRandom(1), {
            difficulty: 'complex',
            bonuses: service.bonuses,
        })
        expect(session.resources).toBe(plain.resources + 30)
        expect(session.military).toBe(plain.military + 1)
        expect(session.miners).toBe(plain.miners + 2)
        expect(session.maxBreakthroughs).toBe(plain.maxBreakthroughs + 1)
        expect(session.excludedAbilities).toContain('ambush')
        expect(session.upgradeTier).toBe(1)
        expect(session.buildCost('tower', 'cannon')).toBe(Math.round(50 * 0.88 ** 1))

        session.resources = 10_000
        session.buildTower(session.slots[0]!.id, 'cannon')
        for (let frame = 0; frame < 600 && !session.slots[0]!.tower; frame++) session.update(1)
        session.update(1)
        const tower = session.slots[0]!.tower!
        expect(tower.range).toBeCloseTo(120 * 1.04)
        expect(tower.fireRate).toBeCloseTo(60 / 1.04)

        session.startWave()
        plain.startWave()
        expect(session.enemies.length).toBeLessThan(plain.enemies.length)
        session.update(1)
        expect(session.resourceRate).toBeCloseTo(session.miners * 0.5 * 1.06)
    })
})
