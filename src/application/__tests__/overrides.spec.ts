import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
    Barricade,
    CannonTower,
    Enemy,
    LaserTower,
    MachineGunTower,
    RocketTower,
    ShockTower,
    createLevel,
    createSeededRandom,
} from '@/domain'
import { GameSession } from '../session/GameSession'
import { createCheckpoint, restoreCheckpoint } from '../session/checkpoint'
import { CheckpointService } from '../CheckpointService'
import { useAchievementsStore } from '@/stores/achievementsStore'
import { useCampaignStore } from '@/stores/campaignStore'
import { useGameStore } from '@/stores/gameStore'
import { useRequisitionStore } from '@/stores/requisitionStore'
import { provideTestServices } from './testServices'

function session() {
    const level = createLevel('level_1')!
    level.events = []
    return new GameSession(level, createSeededRandom(24))
}

function enemy(id: string, abilities: Enemy['abilities'] = []) {
    const target = new Enemy('simple', 'large', id, abilities)
    target.setPath([
        { x: 0, y: 0 },
        { x: 500, y: 0 },
    ])
    target.setProgress(99.5)
    return target
}

afterEach(() => vi.restoreAllMocks())

describe('session overrides', () => {
    it('grants resources and marks even failed invocations as used', () => {
        const value = session()
        const initial = value.resources
        expect(value.grantResources(250)).toEqual({ ok: true })
        expect(value.resources).toBe(initial + 250)
        expect(value.overrides.used).toBe(true)
        for (const amount of [NaN, Infinity, -1]) {
            expect(value.grantResources(amount).ok).toBe(false)
        }
        value.forceVictory()
        expect(value.grantResources(10).ok).toBe(false)
        expect(value.resources).toBe(initial + 250)
        const idle = session()
        expect(idle.clearWave().ok).toBe(false)
        expect(idle.overrides.used).toBe(true)
    })

    it('keeps usage sticky when toggles are switched off', () => {
        const value = session()
        for (const kind of ['lethal', 'fortified'] as const) {
            expect(value.toggleOverride(kind)).toBe(true)
            expect(value.toggleOverride(kind)).toBe(false)
        }
        expect(value.overrides.used).toBe(true)
    })

    it('eliminates pending, split and quarters enemies with normal kill rewards', () => {
        const value = session()
        const pending = enemy('pending', ['split'])
        pending.spawned = false
        pending.spawnDelay = 1000
        const split = enemy('split', ['split'])
        split.die()
        const summoner = enemy('summoner', ['spawn'])
        const queued = enemy('queued', ['split'])
        summoner.spawnedEnemies.push(queued)
        const inside = enemy('inside', ['split'])
        value.enemies = [pending, split, summoner]
        value.quarters.admit(inside)
        const initial = value.resources
        expect(value.eliminateEnemies().ok).toBe(true)
        expect(value.stats.killed).toBe(0)
        expect(queued.alive).toBe(false)
        value.update(1)
        expect(value.enemies).toHaveLength(0)
        expect(value.quarters.enemies).toHaveLength(0)
        expect(value.stats.killed).toBe(4)
        expect(value.resources).toBe(
            initial + pending.reward + split.reward + summoner.reward + inside.reward,
        )
        value.update(1)
        expect(value.stats.killed).toBe(4)
    })

    it.each([false, true])('clears a wave naturally after one advance (quarters: %s)', (inside) => {
        const value = session()
        value.startWave()
        if (inside) value.quarters.admit(enemy('inside', ['split']))
        expect(value.clearWave().ok).toBe(true)
        expect(value.waveInProgress).toBe(true)
        value.advance(1)
        expect(value.waveInProgress).toBe(false)
        expect(value.currentWave).toBe(1)
        expect(value.ended).toBe(false)
        expect(value.clearWave().ok).toBe(false)
    })

    it('forces victory, settles kills and completes survival objectives', () => {
        const value = session()
        value.startWave()
        value.quarters.admit(enemy('inside', ['split']))
        const count = value.enemies.length + 1
        expect(value.forceVictory().ok).toBe(true)
        expect(value.result).toEqual({ outcome: 'victory', reason: '' })
        expect(value.stats.killed).toBe(count)
        expect(value.enemies).toHaveLength(0)
        expect(value.quarters.enemies).toHaveLength(0)
        expect(
            value.objectives.all
                .filter((objective) => objective.kind === 'survive')
                .every((objective) => objective.completed),
        ).toBe(true)
        expect(value.forceVictory().ok).toBe(false)
        expect(value.eliminateEnemies().ok).toBe(false)
    })

    it.each([
        [CannonTower, true],
        [MachineGunTower, true],
        [RocketTower, false],
        [LaserTower, false],
        [ShockTower, false],
    ] as const)(
        'makes positive hits lethal for %s, including projectile splash',
        (Tower, nearbySurvives) => {
            const value = session()
            const target = enemy('target', ['weakImmunity'])
            const nearby = enemy('nearby', ['weakImmunity'])
            target.maxHealth = target.currentHealth = 1000000
            nearby.maxHealth = nearby.currentHealth = 1000000
            value.enemies = [target, nearby]
            const slot = value.slots[0]!
            slot.tower = new Tower(90, 0, slot.id)
            value.update(1)
            value.update(1)
            expect(target.alive).toBe(true)
            value.toggleOverride('lethal')
            slot.tower.fireTimer = 0
            value.update(1)
            value.update(1)
            expect(target.alive).toBe(false)
            expect(nearby.alive).toBe(nearbySurvives)
        },
    )

    it('bypasses adaptation only for positive tower damage and clears exposure on toggle off', () => {
        const value = session()
        const target = enemy('target', ['adaptation'])
        value.enemies = [target]
        value.toggleOverride('lethal')
        value.update(1)
        target.abilityStates = {
            adaptationActive: true,
            adaptationExemptTower: 'last',
            adaptedTower: 'first',
        }
        target.takeDamage(0, 'middle')
        target.takeDamage(1)
        expect(target.alive).toBe(true)
        target.takeDamage(1, 'middle')
        expect(target.alive).toBe(false)
        const next = enemy('next')
        value.enemies = [next]
        value.update(1)
        value.toggleOverride('lethal')
        value.update(1)
        next.takeDamage(1, 'tower')
        expect(next.alive).toBe(true)
    })

    it('fortifies barricades while preserving collisions and ordinary counter-damage', () => {
        const value = session()
        const wall = new Barricade('filter', 100, -20, 40, 40, 'wall')
        wall.active = true
        wall.broken = false
        const target = enemy('target')
        value.enemies = [target]
        value.barricades = [wall]
        value.toggleOverride('lethal')
        value.toggleOverride('fortified')
        const health = target.currentHealth
        value.update(1)
        expect(wall.currentHealth).toBe(wall.maxHealth)
        expect(target.pathProgress).toBe(99.5)
        expect(target.currentHealth).toBeLessThan(health)
        expect(target.alive).toBe(true)
        value.toggleOverride('fortified')
        value.update(1)
        expect(wall.currentHealth).toBeLessThan(wall.maxHealth)
    })

    it('persists only usage through JSON checkpoints and accepts older checkpoints', async () => {
        const { storage } = await provideTestServices()
        const checkpoints = new CheckpointService(storage)
        const value = session()
        value.toggleOverride('lethal')
        value.toggleOverride('fortified')
        expect(checkpoints.save(value)).toBe(true)
        const restored = session()
        expect(checkpoints.restore(restored)).toBe(true)
        expect(restored.overrides).toEqual({ used: true, lethal: false, fortified: false })
        const saved = JSON.parse(JSON.stringify(createCheckpoint(value)))
        delete saved.overridesUsed
        const older = session()
        restoreCheckpoint(older, saved)
        expect(older.overrides.used).toBe(false)
        restoreCheckpoint(restored, saved)
        expect(restored.overrides.used).toBe(true)
    })
})

describe('store override penalties', () => {
    it.each([false, true])(
        'checks eligibility throughout and after a resumed session (used: %s)',
        async (used) => {
            setActivePinia(createPinia())
            let tick: (frames: number) => void = () => {}
            const services = await provideTestServices({
                createScheduler: () => ({
                    start: (callback) => {
                        tick = callback
                    },
                    stop: () => {},
                }),
            })
            const saved = session()
            if (used) saved.grantResources(1)
            new CheckpointService(services.storage).save(saved)
            const achievements = vi.spyOn(useAchievementsStore(), 'check')
            const award = vi.spyOn(useRequisitionStore(), 'award')
            const campaign = useCampaignStore()
            const record = vi.spyOn(campaign, 'recordResult')
            const captured: { current?: GameSession } = {}
            vi.spyOn(GameSession.prototype, 'advance').mockImplementation(
                function (this: GameSession) {
                    captured.current = this
                },
            )
            const store = useGameStore()
            expect(store.start('level_1', true)).toBe(true)
            for (let i = 0; i < 60; i++) tick(1)
            expect(achievements).toHaveBeenCalledTimes(used ? 0 : 1)
            captured.current!.status = 'victory'
            captured.current!.result = { outcome: 'victory', reason: '' }
            tick(1)
            expect(achievements).toHaveBeenCalledTimes(used ? 0 : 2)
            expect(award).toHaveBeenCalledTimes(used ? 0 : 1)
            expect(record).toHaveBeenCalledOnce()
            expect(campaign.isUnlocked('level_2')).toBe(true)
            expect(store.snapshot?.result?.requisitions).toBe(award.mock.results[0]?.value ?? null)
            store.stop()
        },
    )
})
