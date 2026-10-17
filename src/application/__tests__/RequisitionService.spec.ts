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
        .trees.flatMap((tree) => tree.stages.flatMap((stage) => stage.upgrades))
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

    it('opens tiers per tree and raises every price with each purchase', () => {
        const { service } = funded(100_000)
        const gate = 'Переход I–II откроется после 3 нарядов этой ветви'
        expect(upgrade(service, 'upgrade_step_two').blocked).toBe(gate)
        expect(service.buy('upgrade_step_two')).toEqual({ ok: false, error: gate })
        // Purchases in the crew tree raise machinery prices but do not open its tiers.
        const before = upgrade(service, 'tower_damage').cost!
        for (let i = 0; i < 4; i++) expect(service.buy('mining').ok).toBe(true)
        expect(upgrade(service, 'tower_damage').cost!).toBeGreaterThan(before)
        expect(upgrade(service, 'upgrade_step_two').blocked).toBe(gate)
        expect(service.view().priceIndex).toBeCloseTo(1 + 4 * REQUISITIONS.priceRise)
        for (let i = 0; i < 3; i++) service.buy('tower_damage')
        const machinery = service.view().trees.find((tree) => tree.id === 'machinery')!
        expect(machinery.purchases).toBe(3)
        expect(upgrade(service, 'upgrade_step_two').blocked).toBeNull()
        expect(service.buy('upgrade_step_two').ok).toBe(true)
        expect(service.buy('upgrade_step_two')).toEqual({
            ok: false,
            error: 'Наряд исполнен полностью',
        })
        expect(service.bonuses.upgradeTier).toBe(1)
    })

    it('keeps a tier shut until its transition keystones are bought', () => {
        const { service } = funded(20)
        expect(service.buy('tower_damage').ok).toBe(true)
        expect(service.buy('tower_damage')).toEqual({ ok: false, error: 'Недостаточно реквизиций' })
        const rich = funded(1_000_000).service
        for (let i = 0; i < 10; i++) rich.buy(i % 2 ? 'tower_damage' : 'tower_range')
        // Enough purchases: the transition opens, the tier behind it waits for the keystone.
        expect(upgrade(rich, 'upgrade_step_two').blocked).toBeNull()
        expect(upgrade(rich, 'barricade_health').blocked).toBe(
            'Разряд II откроется после перехода I–II',
        )
        expect(rich.buy('barricade_health').ok).toBe(false)
        expect(rich.buy('upgrade_step_two').ok).toBe(true)
        expect(upgrade(rich, 'barricade_health').blocked).toBeNull()
        const machinery = rich.view().trees.find((tree) => tree.id === 'machinery')!
        expect(machinery.stages.map((stage) => stage.numeral)).toEqual([
            'I',
            'I–II',
            'II',
            'III',
            'III–IV',
            'IV',
            'V',
        ])
        expect(machinery.stages.find((stage) => stage.numeral === 'IV')!.waitsFor).toBe('III–IV')
    })

    it('keeps science and the favours closed until the story and the rank allow them', () => {
        const lieutenant = funded(1_000_000, 'modest', ['level_1', 'level_2'])
        const view = lieutenant.service.view()
        const tree = (id: string) => view.trees.find((candidate) => candidate.id === id)!
        // Sealed registers say why, not what is inside.
        expect(tree('science').seal).toEqual({
            text: expect.stringContaining('РАЗДЕЛ ОПЕЧАТАН'),
            requirements: [{ text: 'Сектор C-9 «Лаборатории» удержан', met: false }],
        })
        expect(tree('special').seal!.requirements).toEqual([
            { text: 'Звание: майор или генерал', met: false },
            { text: 'Сектор D-1 «Техническое ядро» удержан', met: false },
        ])
        expect(tree('machinery').seal).toBeNull()
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
        const damage = upgradeDefinition('tower_damage')!
        const mining = upgradeDefinition('mining')!
        // The second purchase already pays the raised price index.
        const spent = upgradeCost(damage, 0, 0) + upgradeCost(mining, 0, 1)
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
