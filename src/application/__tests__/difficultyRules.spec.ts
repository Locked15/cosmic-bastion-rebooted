import { describe, expect, it } from 'vitest'
import {
    CAMPAIGN,
    WAVE_RULES,
    generateWave,
    sectorDepth,
    DIFFICULTIES,
    DIFFICULTY_IDS,
    Enemy,
    NO_BONUSES,
    TOWER_CATALOG,
    BARRICADE_CATALOG,
    createLevel,
    createSeededRandom,
    type DifficultyId,
    type TowerType,
} from '@/domain'
import { GameSession, barricadeRefund } from '../session/GameSession'
import { createCheckpoint, restoreCheckpoint } from '../session/checkpoint'
import { presentSession } from '../session/presenter'

function session(difficulty: DifficultyId = 'xhard') {
    const value = new GameSession(createLevel('level_1')!, createSeededRandom(7), { difficulty })
    value.story.close()
    return value
}

function tower(value: GameSession, type: TowerType, index = 0) {
    const slot = value.slots[index]!
    slot.startConstruction(type)
    slot.updateConstruction(1, 1e9)
    // Keep combat deterministic: manual damage below exercises the same source IDs.
    slot.tower!.fireRate = 1e9
    return slot.tower!
}

function kills(value: GameSession, sources: string[]) {
    value.enemies = sources.map((_, index) => new Enemy('simple', 'small', `victim-${index}`))
    for (const enemy of value.enemies)
        enemy.setPath([
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
        ])
    value.update(0)
    value.enemies.forEach((enemy, index) => enemy.takeDamage(1e9, sources[index]))
    value.update(0)
}

describe('difficulty gameplay rules', () => {
    it('lets the player answer a simple dialog after an unlimited pause', () => {
        const value = session('simple')
        value.story.active = {
            dialog: createLevel('level_1')!.events[0]!.dialog,
            phase: 'choice',
            consequence: null,
            framesLeft: 600,
        }
        value.advance(6000)
        expect(value.story.active?.framesLeft).toBe(600)
        expect(value.chooseDialog(0).ok).toBe(true)
    })

    it.each(DIFFICULTY_IDS)('uses %s dialog speed and real-time countdown policy', (id) => {
        const value = session(id)
        value.speedIndex = 4
        const dialog = createLevel('level_1')!.events[0]!.dialog
        value.story.active = { dialog, phase: 'choice', consequence: null, framesLeft: 600 }
        const before = value.resources
        value.advance(60)
        const factor = id === 'xhard' ? 8 : DIFFICULTIES[id].dialogSpeed
        expect(value.resources - before).toBeCloseTo(value.resourceRate * factor)
        expect(value.story.active?.framesLeft).toBe(id === 'simple' ? 600 : 540)
    })

    it.each(DIFFICULTY_IDS)('scales %s starting resources before the meta bonus', (id) => {
        const level = createLevel('level_1')!
        const value = new GameSession(level, createSeededRandom(1), {
            difficulty: id,
            bonuses: { ...NO_BONUSES, startResources: 37 },
        })
        expect(value.resources).toBe(
            Math.round(level.startingResources * DIFFICULTIES[id].startResources) + 37,
        )
    })

    it.each(DIFFICULTY_IDS)('uses %s refunds in commands and presentation', (id) => {
        const value = session(id)
        const slot = value.slots[0]!
        value.buildTower(slot.id, 'cannon')
        value.selectedId = slot.id
        const refund = Math.floor(TOWER_CATALOG.cannon.cost * DIFFICULTIES[id].refundRate)
        expect(presentSession(value).selection?.refund).toBe(refund)
        const before = value.resources
        value.demolish()
        expect(value.resources).toBe(before + refund)
        const barricade = value.buildBarricadeAt({ x: 0, y: 0, width: 10, height: 10 }, 'wall')
        const barricadeAmount = Math.floor(
            BARRICADE_CATALOG.wall.cost * DIFFICULTIES[id].refundRate,
        )
        value.selectedId = barricade.id
        expect(presentSession(value).selection?.refund).toBe(barricadeAmount)
        expect(barricadeRefund(barricade, value.refundRate)).toBe(barricadeAmount)
        const resources = value.resources
        value.demolish()
        expect(value.resources).toBe(resources + barricadeAmount)
        barricade.destroy()
        expect(barricadeRefund(barricade, value.refundRate)).toBe(0)
    })
})

describe('Swarm memory', () => {
    it('aggregates kills from multiple towers of the same type', () => {
        const value = session('complex')
        const a = tower(value, 'cannon').id
        const b = tower(value, 'cannon', 1).id
        value.startWave()
        kills(value, [a, a, b])
        expect(value.remembered).toBe('cannon')
        value.startWave()
        value.update(0)
        const enemy = value.enemies[0]!
        const before = enemy.currentHealth
        enemy.takeDamage(10, a)
        expect(enemy.currentHealth).toBeCloseTo(before - 8.5)
    })

    it('remembers the leading type, resists next wave, persists and then clears', () => {
        const value = session()
        const cannon = tower(value, 'cannon')
        const machinegun = tower(value, 'machinegun', 1)
        value.startWave()
        kills(value, [cannon.id, cannon.id, cannon.id, machinegun.id])
        expect(value.remembered).toBe('cannon')
        expect(value.drainMessages()).toContain(
            `Сонм запомнил: ${TOWER_CATALOG.cannon.name} (−25% урона)`,
        )
        expect(presentSession(value).swarmMemory).toEqual({
            tower: TOWER_CATALOG.cannon.name,
            percent: 25,
        })
        const saved = JSON.parse(JSON.stringify(createCheckpoint(value)))
        const resumed = session('simple')
        restoreCheckpoint(resumed, saved)
        expect(resumed.remembered).toBe('cannon')
        expect(resumed.resources).toBe(value.resources)
        expect(resumed.difficulty).toBe('xhard')
        resumed.startWave()
        resumed.update(0)
        const enemy = resumed.enemies[0]!
        const health = enemy.currentHealth
        const source = resumed.slots[0]!.tower!.id
        enemy.takeDamage(10, source)
        expect(enemy.currentHealth).toBeCloseTo(health - 7.5)
        enemy.takeDamage(10, resumed.slots[1]!.tower!.id)
        expect(enemy.currentHealth).toBeCloseTo(health - 17.5)
        resumed.enemies.forEach((target) => target.die({ suppressOffspring: true }))
        resumed.update(0)
        expect(resumed.remembered).toBeNull()
        expect(presentSession(resumed).swarmMemory).toBeNull()
    })

    it.each(['simple', 'modest'] as const)('disables memory on %s', (id) => {
        const value = session(id)
        const source = tower(value, 'cannon').id
        value.startWave()
        kills(value, [source, source, source])
        expect(value.remembered).toBeNull()
    })

    it('requires three kills and clears ties', () => {
        for (const counts of [
            [2, 0],
            [3, 3],
        ]) {
            const value = session('complex')
            const a = tower(value, 'cannon').id
            const b = tower(value, 'machinegun', 1).id
            value.remembered = 'cannon'
            value.startWave()
            kills(value, [
                ...Array<string>(counts[0]!).fill(a),
                ...Array<string>(counts[1]!).fill(b),
            ])
            expect(value.remembered).toBeNull()
        }
    })

    it('counts the killing blow rather than earlier tower damage or environmental deaths', () => {
        const value = session()
        const a = tower(value, 'cannon').id
        const b = tower(value, 'machinegun', 1).id
        value.startWave()
        value.enemies = Array.from({ length: 3 }, (_, i) => new Enemy('simple', 'small', String(i)))
        for (const enemy of value.enemies)
            enemy.setPath([
                { x: 0, y: 0 },
                { x: 1000, y: 0 },
            ])
        value.update(0)
        for (const enemy of value.enemies) {
            enemy.takeDamage(1, a)
            enemy.takeDamage(1e9, b)
        }
        value.update(0)
        expect(value.remembered).toBe('machinegun')
        value.startWave()
        value.enemies = Array.from(
            { length: 3 },
            (_, i) => new Enemy('simple', 'small', `environment-${i}`),
        )
        for (const enemy of value.enemies)
            enemy.setPath([
                { x: 0, y: 0 },
                { x: 1000, y: 0 },
            ])
        value.update(0)
        for (const enemy of value.enemies) {
            enemy.takeDamage(1, b)
            enemy.takeDamage(1e9)
        }
        value.update(0)
        expect(value.remembered).toBeNull()
    })

    it('keeps lethal override above memory and enemy defenses', () => {
        const value = session()
        const source = tower(value, 'cannon').id
        value.remembered = 'cannon'
        value.startWave()
        value.toggleOverride('lethal')
        value.update(0)
        const enemy = value.enemies[0]!
        enemy.takeDamage(0.001, source)
        expect(enemy.alive).toBe(false)
        expect(enemy.lastHitBy).toBe(source)
    })

    it('reads legacy checkpoints without memory', () => {
        const value = session()
        const saved = createCheckpoint(value)
        delete saved.remembered
        value.remembered = 'cannon'
        restoreCheckpoint(value, saved)
        expect(value.remembered).toBeNull()
    })
})

// Scheduling is a session decision; the generator only receives a resolved boss request.
describe('boss scheduling', () => {
    it.each(DIFFICULTY_IDS)('schedules %s by depth, cadence and last wave', (difficulty) => {
        const expected = {
            simple: { minDepth: 5, every: null },
            modest: { minDepth: 3, every: 4 },
            complex: { minDepth: 2, every: 3 },
            xhard: { minDepth: 1, every: 3 },
        }[difficulty]
        for (let depth = 0; depth <= 6; depth++) {
            const level = createLevel('level_1')!
            const session = new GameSession(level, createSeededRandom(1), { difficulty, depth })
            session.story.close()
            for (let wave = 1; wave <= level.totalWaves; wave++) {
                session.currentWave = wave - 1
                session.waveInProgress = false
                session.enemies = []
                session.startWave()
                expect(session.enemies.some((enemy) => enemy.type === 'boss')).toBe(
                    depth >= expected.minDepth &&
                        (wave === level.totalWaves ||
                            (expected.every !== null && wave % expected.every === 0)),
                )
            }
        }
    })

    it('defaults to campaign depth and excludes training', () => {
        for (const sector of CAMPAIGN.sectors) {
            const value = new GameSession(createLevel(sector.level)!, createSeededRandom(1))
            expect(value.depth).toBe(sectorDepth(sector.level))
        }
    })

    it.each(DIFFICULTY_IDS)('respects %s boss bans with distinct abilities across seeds', (id) => {
        const config = DIFFICULTIES[id].bosses
        for (let seed = 0; seed < 100; seed++) {
            const wave = generateWave(3, 1, createSeededRandom(seed), {
                excludedAbilities: ['spawn'],
                boss: { onThisWave: true, abilities: config.abilities, banned: config.banned },
            })
            const boss = wave.find((enemy) => enemy.type === 'boss')!
            expect(boss.abilities).toHaveLength(config.abilities)
            expect(new Set(boss.abilities).size).toBe(config.abilities)
            for (const ability of boss.abilities)
                expect([...config.banned, 'spawn']).not.toContain(ability)
        }
    })

    it('spawns an unpowered boss when all abilities are excluded', () => {
        const wave = generateWave(3, 1, createSeededRandom(1), {
            excludedAbilities: WAVE_RULES.bossAbilities,
            boss: { onThisWave: true, abilities: 2, banned: [] },
        })
        expect(wave.find((enemy) => enemy.type === 'boss')?.abilities).toEqual([])
        expect(
            generateWave(4, 1, createSeededRandom(1)).some((enemy) => enemy.type === 'boss'),
        ).toBe(false)
    })
})
