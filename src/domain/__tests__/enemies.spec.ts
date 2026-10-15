import { describe, it, expect } from 'vitest'
import { Enemy, CannonTower, createSeededRandom, generateWave } from '../index'
import type { EnemyUpdateContext } from '../index'
const context = (): EnemyUpdateContext => ({ towers: [], enemies: [], rng: createSeededRandom(1) })

describe('enemies', () => {
    it('generates identical wave kinds, sizes, abilities and IDs for the same seed', () => {
        const wave = (seed: number) =>
            generateWave(3, 1, createSeededRandom(seed)).map((enemy) => ({
                type: enemy.type,
                size: enemy.size,
                abilities: enemy.abilities,
                id: enemy.id,
            }))
        const first = wave(1)
        expect(first.length).toBeGreaterThan(0)
        expect(wave(1)).toEqual(first)
        expect(wave(2)).not.toEqual(first)
        expect(new Set(first.map((enemy) => enemy.id)).size).toBe(first.length)
    })
    it('adds a delayed boss when requested', () => {
        const wave = generateWave(4, 1, createSeededRandom(1), {
            boss: { onThisWave: true, abilities: 1, banned: [] },
        })
        expect(wave).toHaveLength(21)
        const boss = wave[wave.length - 1]!
        expect(boss.type).toBe('boss')
        expect(boss.abilities).toHaveLength(1)
        expect(boss.spawnDelay).toBe(250)
        expect(wave.every((enemy) => !enemy.spawned)).toBe(true)
    })
    it('eventually reaches the end of a two-point path', () => {
        const enemy = new Enemy('simple', 'small', 'enemy')
        const ctx = context()
        enemy.setPath([
            { x: 0, y: 0 },
            { x: 20, y: 0 },
        ])
        expect(enemy.reached).toBe(false)
        for (let i = 0; i < 1000 && !enemy.reached; i++) enemy.update(1, ctx)
        expect(enemy.reached).toBe(true)
    })
    it.each([0, 1])('lethal damage plus %i marks an enemy dead', (extra) => {
        const enemy = new Enemy('simple', 'small', 'enemy')
        expect(enemy.alive).toBe(true)
        enemy.takeDamage(enemy.currentHealth + extra)
        expect(enemy.currentHealth).toBeLessThanOrEqual(0)
        expect(enemy.alive).toBe(false)
    })
    it('flushes split offspring on the next update using the supplied RNG', () => {
        const split = () => {
            const enemy = new Enemy('ability', 'medium', 'parent', ['split'])
            enemy.setPath([
                { x: 0, y: 0 },
                { x: 100, y: 0 },
            ])
            enemy.takeDamage(enemy.maxHealth)
            const ctx = context()
            enemy.update(1, ctx)
            expect(enemy.spawnedEnemies).toHaveLength(3)
            expect(
                enemy.spawnedEnemies.every((child) => !child.spawned && child.type === 'simple'),
            ).toBe(true)
            const snapshots = enemy.spawnedEnemies.map((child) => child.snapshot())
            enemy.update(1, ctx)
            expect(enemy.spawnedEnemies.map((child) => child.snapshot())).toEqual(snapshots)
            return snapshots
        }
        expect(split()).toEqual(split())
    })
    it('restricts adaptation damage to its selected in-range tower ID', () => {
        const enemy = new Enemy('ability', 'large', 'enemy', ['adaptation'])
        enemy.abilityStates.adaptationActive = true
        enemy.abilityStates.adaptedTower = 'tower_1'
        enemy.takeDamage(10, 'tower_1')
        const health = enemy.currentHealth
        enemy.takeDamage(10, 'tower_2')
        expect(enemy.currentHealth).toBe(health)
        enemy.takeDamage(10, 'tower_1')
        expect(enemy.currentHealth).toBe(health - 10)
    })
    it('blocks weak damage below 0.5% of boss health', () => {
        const enemy = new Enemy('boss', 'large', 'boss', ['weakImmunity'])
        enemy.takeDamage(enemy.maxHealth * 0.004)
        expect(enemy.currentHealth).toBe(enemy.maxHealth)
        enemy.takeDamage(enemy.maxHealth * 0.005)
        expect(enemy.currentHealth).toBeLessThan(enemy.maxHealth)
    })
    it('scales slow, stun and flash timers by frames', () => {
        const enemy = new Enemy('simple', 'small', 'enemy')
        enemy.setPath([
            { x: 0, y: 0 },
            { x: 100, y: 0 },
        ])
        enemy.slowTimer = 10
        enemy.slowMultiplier = 0.5
        enemy.stunTimer = 2
        enemy.flashTimer = 5
        enemy.update(2, context())
        expect(enemy.x).toBe(0)
        expect(enemy.stunTimer).toBe(0)
        expect(enemy.slowTimer).toBe(8)
        expect(enemy.flashTimer).toBe(3)
        enemy.update(8, context())
        expect(enemy.slowMultiplier).toBe(1)
    })
    it('accelerates, teleports, sabotages and absorbs according to the original rules', () => {
        const accelerating = new Enemy('ability', 'small', 'fast', ['accelerate'])
        accelerating.update(300, context())
        expect(accelerating.accelerateMultiplier).toBeCloseTo(1.05)
        const tower = new CannonTower(0, 0, 'tower')
        const ctx = context()
        ctx.towers.push(tower)
        const teleporter = new Enemy('ability', 'small', 'teleport', ['teleport'])
        teleporter.setPath(Array.from({ length: 10 }, (_, x) => ({ x: x * 100, y: 0 })))
        teleporter.update(1, ctx)
        expect(teleporter.pathProgress).toBeCloseTo(122)
        const saboteur = new Enemy('ability', 'small', 'sabotage', ['sabotage'])
        saboteur.update(1, ctx)
        expect(tower.disabled).toBe(true)
        expect(tower.disableTimer).toBe(600)
        const boss = new Enemy('boss', 'large', 'boss', ['absorb'])
        const victim = new Enemy('simple', 'small', 'victim')
        boss.currentHealth -= 100
        ctx.enemies.push(boss, victim)
        boss.update(480, ctx)
        expect(victim.alive).toBe(false)
        expect(boss.currentHealth).toBe(boss.maxHealth - 70)
    })
    it('returns detached snapshot ability collections', () => {
        const enemy = new Enemy('ability', 'small', 'enemy', ['accelerate'])
        const snapshot = enemy.snapshot()
        snapshot.abilities.length = 0
        snapshot.abilityStates.accelerateTimer = 99
        expect(enemy.abilities).toEqual(['accelerate'])
        expect(enemy.abilityStates.accelerateTimer).toBeUndefined()
    })
})
