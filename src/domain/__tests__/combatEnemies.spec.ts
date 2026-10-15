import { describe, expect, it } from 'vitest'
import {
    Enemy,
    createLevel,
    CannonTower,
    TowerSlot,
    Projectile,
    createSeededRandom,
    generateWave,
} from '../index'

const path = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 200 },
    { x: 400, y: 200 },
]
const rng = () => createSeededRandom(17)
function enemy(abilities: Enemy['abilities'], type: Enemy['type'] = 'boss') {
    const value = new Enemy(type, 'large', 'enemy', abilities)
    value.setPath(path)
    return value
}

describe('combat enemy abilities', () => {
    it('accelerates by 5% at five-second intervals, retaining excess frames', () => {
        const value = enemy(['accelerate'], 'ability')
        value.updateAbilities(299, [], [], rng())
        expect(value.accelerateMultiplier).toBe(1)
        value.updateAbilities(302, [], [], rng())
        expect(value.accelerateMultiplier).toBeCloseTo(1.05 ** 2)
        expect(value.abilityStates.accelerateTimer).toBe(1)
    })

    it('splits into at most five regular small enemies at the same path position', () => {
        const value = enemy(['split'], 'ability')
        value.setProgress(250)
        value.die()
        value.update(1, { towers: [], enemies: [], rng: rng() })
        expect(value.spawnedEnemies).toHaveLength(5)
        for (const child of value.spawnedEnemies) {
            expect(child).toMatchObject({ type: 'simple', size: 'small', x: 200, y: 50 })
            expect(child.pathProgress).toBe(250)
        }
    })

    it('marks a seeded random active tower before entry and teleports to its range exit', () => {
        const towers = [new CannonTower(150, 50, 'first'), new CannonTower(250, 200, 'last')]
        towers.forEach((tower) => {
            tower.range = 80
        })
        const value = enemy(['teleport'], 'ability')
        value.updateAbilities(1, towers, [], rng())
        const marked = towers.find((tower) => tower.id === value.abilityStates.markedTower)!
        expect(marked).toBeDefined()
        expect(value.abilityStates.hasTeleported).toBeUndefined()
        value.setProgress(marked.id === 'first' ? 100 : 480)
        value.updateAbilities(1, towers, [], rng())
        expect(value.abilityStates.hasTeleported).toBe(true)
        expect(value.distanceTo(marked.x, marked.y)).toBeCloseTo(marked.range)
    })

    it('adaptation randomly permits one in-range tower and always permits the final tower', () => {
        const value = enemy(['adaptation'], 'ability')
        const towers = [
            new CannonTower(20, 0, 'a'),
            new CannonTower(60, 0, 'b'),
            new CannonTower(100, 0, 'last'),
        ]
        value.prepareCombat(towers, rng())
        const selected = value.abilityStates.adaptedTower!
        const denied = towers.find((tower) => tower.id !== selected && tower.id !== 'last')!
        value.takeDamage(10, denied.id)
        expect(value.currentHealth).toBe(value.maxHealth)
        value.takeDamage(10, selected)
        value.takeDamage(10, 'last')
        expect(value.currentHealth).toBe(value.maxHealth - 20)
        value.prepareCombat([towers[0]!], rng())
        value.takeDamage(10, 'a')
        expect(value.currentHealth).toBe(value.maxHealth - 30)
    })

    it('chooses another adaptation tower when the old one leaves range', () => {
        const value = enemy(['adaptation'], 'ability')
        const first = new CannonTower(0, 0, 'a')
        const second = new CannonTower(200, 100, 'b')
        const last = new CannonTower(400, 200, 'last')
        value.prepareCombat([first, second, last], rng())
        expect(value.abilityStates.adaptedTower).toBe('a')
        value.setProgress(300)
        value.prepareCombat([first, second, last], rng())
        expect(value.abilityStates.adaptedTower).toBe('b')
    })

    it('sabotages one random active tower for ten seconds, once', () => {
        const value = enemy(['sabotage'], 'ability')
        const towers = [new CannonTower(0, 0, 'a'), new CannonTower(100, 0, 'b')]
        value.updateAbilities(1, towers, [], rng())
        const disabled = towers.filter((tower) => tower.disabled)
        expect(disabled).toHaveLength(1)
        expect(disabled[0]!.disableTimer).toBe(600)
        value.updateAbilities(600, towers, [], rng())
        expect(towers.filter((tower) => tower.disabled)).toHaveLength(1)
    })

    it('rolls exclusive adaptation/sabotage and one unique boss ability across seeds', () => {
        const wave = Array.from({ length: 50 }, (_, seed) =>
            generateWave(8, 1, createSeededRandom(seed), {
                boss: { onThisWave: true, abilities: 1, banned: [] },
            }),
        ).flat()
        for (const value of wave.filter((candidate) => candidate.type === 'boss')) {
            expect(value.abilities).toHaveLength(1)
            expect(['ambush', 'dodge', 'confuse', 'blind', 'destroy', 'spawn', 'absorb']).toContain(
                value.abilities[0],
            )
            expect(value.maxHealth).toBeGreaterThan(1000)
        }
        for (const value of wave.filter(
            (candidate) => candidate.hasAbility('adaptation') || candidate.hasAbility('sabotage'),
        )) {
            expect(value.abilities).toHaveLength(1)
        }
        for (const value of wave.filter((candidate) => candidate.type === 'miniboss')) {
            expect([1, 2]).toContain(value.abilities.length)
        }
        expect(enemy(['accelerate'], 'miniboss').maxHealth).toBeGreaterThan(
            enemy(['accelerate', 'split'], 'miniboss').maxHealth,
        )
    })

    it('ambushes only once at a reproducible point in the first half of path length', () => {
        const value = enemy(['ambush'])
        value.updateAbilities(1, [], [], rng())
        expect(value.pathProgress).toBeGreaterThan(0)
        expect(value.pathProgress).toBeLessThanOrEqual(value.pathLength / 2)
        const progress = value.pathProgress
        value.updateAbilities(1, [], [], rng())
        expect(value.pathProgress).toBe(progress)
        expect(value.ambushFlashTimer).toBe(60)
    })

    it('dodges every third projectile without dodging other damage', () => {
        const value = enemy(['dodge'])
        for (let i = 0; i < 6; i++) new Projectile(value.x, value.y, value, 10, `p${i}`).hit()
        expect(value.currentHealth).toBe(value.maxHealth - 40)
        value.takeDamage(10)
        expect(value.currentHealth).toBe(value.maxHealth - 50)
    })

    it('confuses for six seconds after each twelve-second cooldown', () => {
        const value = enemy(['confuse'])
        value.updateAbilities(719, [], [], rng())
        expect(value.abilityStates.confuseTimer).toBe(0)
        value.updateAbilities(1, [], [], rng())
        expect(value.abilityStates.confuseTimer).toBe(360)
        value.updateAbilities(360, [], [], rng())
        expect(value.abilityStates.confuseTimer).toBe(0)
    })

    it('blinds the two nearest towers to a detached fixed point for eight seconds', () => {
        const value = enemy(['blind'])
        const towers = [10, 50, 100].map((x) => new CannonTower(x, 0, `${x}`))
        value.updateAbilities(720, towers, [], rng())
        expect(towers.map((tower) => tower.blindTimer)).toEqual([480, 480, 0])
        value.x = 100
        expect(towers[0]!.blindTarget).toEqual({ x: 0, y: 0 })
        towers[0]!.update(480, [], rng())
        expect(towers[0]!.blindTarget).toBeNull()
    })

    it('destroys a tower every fifteen seconds and leaves a five-second slot cooldown', () => {
        const value = enemy(['destroy'])
        const slot = new TowerSlot('slot', 0, 0, 'cannon')
        slot.tower = new CannonTower(0, 0, slot.id)
        value.updateAbilities(899, [slot.tower], [], rng(), [slot])
        expect(slot.tower).not.toBeNull()
        value.updateAbilities(1, [slot.tower!], [], rng(), [slot])
        expect(slot.tower).toBeNull()
        expect(slot.startConstruction('rocket')).toBe(false)
        slot.updateConstruction(10, 299)
        expect(slot.startConstruction('rocket')).toBe(false)
        slot.updateConstruction(10, 1)
        expect(slot.startConstruction('rocket')).toBe(true)
    })

    it('spawns at ten-second intervals with at most five living regular offspring', () => {
        const value = enemy(['spawn'])
        value.updateAbilities(599, [], [value], rng())
        expect(value.spawnedEnemies).toHaveLength(0)
        value.updateAbilities(1, [], [value], rng())
        expect(value.spawnedEnemies).toHaveLength(1)
        value.updateAbilities(6000, [], [value], rng())
        expect(value.spawnedEnemies).toHaveLength(5)
        expect(
            value.spawnedEnemies.every(
                (child) => child.type === 'simple' && !child.abilities.length,
            ),
        ).toBe(true)
        value.spawnedEnemies[0]!.alive = false
        value.updateAbilities(600, [], [value], rng())
        expect(value.spawnedEnemies.filter((child) => child.alive)).toHaveLength(5)
    })

    it('absorbs a nearby non-boss at eight seconds and heals its original maximum health', () => {
        const value = enemy(['absorb'])
        value.currentHealth -= 500
        const victim = enemy(['split'], 'miniboss')
        victim.currentHealth = 1
        const otherBoss = enemy(['dodge'])
        const hidden = new Enemy('simple', 'small', 'hidden')
        hidden.spawned = false
        value.updateAbilities(479, [], [otherBoss, hidden, victim], rng())
        expect(victim.alive).toBe(true)
        value.updateAbilities(1, [], [otherBoss, hidden, victim], rng())
        expect(victim.alive).toBe(false)
        expect(victim.splitPending).toBe(false)
        expect(value.currentHealth).toBe(
            Math.min(value.maxHealth, value.maxHealth - 500 + victim.maxHealth),
        )
        expect(otherBoss.alive).toBe(true)
        expect(hidden.alive).toBe(true)
    })
})

describe('path following', () => {
    it('reaches the end of a long multi-segment track', () => {
        const enemy = new Enemy('simple', 'small', 'runner')
        enemy.setPath(createLevel('level_1')!.basePath)
        for (let frame = 0; frame < 5000 && !enemy.reached; frame++) enemy.move(1)
        expect(enemy.reached).toBe(true)
    })
})
