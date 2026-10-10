import { describe, expect, it } from 'vitest'
import {
    Enemy,
    CannonTower,
    RocketTower,
    MachineGunTower,
    LaserTower,
    ShockTower,
    Barricade,
    createSeededRandom,
} from '../index'

const rng = () => createSeededRandom(9)
function target(id: string, x: number, y = 0) {
    const value = new Enemy('simple', 'large', id)
    value.setPath([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 200 },
    ])
    value.x = x
    value.y = y
    value.maxHealth = value.currentHealth = 10000
    return value
}
function upgrade(
    tower: CannonTower | RocketTower | MachineGunTower | LaserTower | ShockTower | Barricade,
    level = 3,
) {
    for (let i = 1; i <= level; i++) {
        tower.level = i
        tower.applyUpgrade()
    }
}

describe('combat towers', () => {
    it('cannon L2 improves fire rate and L3 hits exactly three distinct targets', () => {
        const tower = new CannonTower(0, 0, 'tower')
        const enemies = [20, 30, 40, 50].map((x) => target(`${x}`, x))
        upgrade(tower)
        expect(tower.damage).toBe(25)
        expect(tower.fireRate).toBe(40)
        tower.fire(enemies[0]!, enemies, rng())
        expect(tower.projectiles).toHaveLength(3)
        expect(new Set(tower.projectiles.map((projectile) => projectile.target.id)).size).toBe(3)
        tower.projectiles.forEach((projectile) => projectile.update(100))
        expect(enemies.filter((enemy) => enemy.currentHealth < enemy.maxHealth)).toHaveLength(3)
    })

    it('rocket L3 pushes backwards across a path corner and future movement preserves it', () => {
        const tower = new RocketTower(100, 10, 'tower')
        upgrade(tower)
        const enemy = target('enemy', 100, 10)
        enemy.setProgress(110)
        tower.fire(enemy, [enemy], rng())
        tower.projectiles[0]!.update(1)
        expect(enemy.pathProgress).toBe(90)
        expect(enemy).toMatchObject({ x: 90, y: 0, pathIndex: 0 })
        enemy.move(1)
        expect(enemy.pathProgress).toBeCloseTo(90.8)
        expect(enemy.y).toBe(0)
    })

    it('continues disable and blind timers while holding fire and stops a sustained beam', () => {
        const tower = new LaserTower(0, 0, 'laser')
        const enemy = target('enemy', 20)
        tower.update(1, [enemy], rng())
        const health = enemy.currentHealth
        tower.disable(600)
        tower.blind({ x: 20, y: 0 }, 480)
        tower.holdFire(600)
        expect(tower.disabled).toBe(false)
        expect(tower.blindTarget).toBeNull()
        expect(tower.beamEnd).toBeNull()
        expect(enemy.currentHealth).toBe(health)
    })

    it('can select enemies exactly at its range boundary', () => {
        const tower = new CannonTower(0, 0, 'tower')
        const enemy = target('enemy', tower.range)
        expect(tower.findTarget([enemy])).toBe(enemy)
    })

    it('machinegun L3 slows on impact', () => {
        const tower = new MachineGunTower(0, 0, 'tower')
        upgrade(tower)
        const enemy = target('enemy', 20)
        tower.fire(enemy, [enemy], rng())
        tower.projectiles[0]!.update(100)
        expect(enemy.slowMultiplier).toBe(0.5)
        expect(enemy.slowTimer).toBe(120)
    })

    it('laser sustains for one second, crosses secondary enemies at half damage, then recharges', () => {
        const tower = new LaserTower(0, 0, 'laser')
        const primary = target('primary', 100)
        const crossed = target('crossed', 50)
        const offBeam = target('off', 50, 30)
        // Lock the primary before a secondary walks into its beam.
        tower.update(1, [primary], rng())
        tower.update(59, [primary, crossed, offBeam], rng())
        expect(primary.currentHealth).toBe(primary.maxHealth - 120)
        expect(crossed.currentHealth).toBe(crossed.maxHealth - 59)
        expect(offBeam.currentHealth).toBe(offBeam.maxHealth)
        expect(tower.fireTimer).toBe(300)
        tower.update(299, [primary], rng())
        expect(tower.beamEnd).toBeNull()
        expect(primary.currentHealth).toBe(primary.maxHealth - 120)
        tower.update(1, [primary], rng())
        expect(primary.currentHealth).toBe(primary.maxHealth - 122)
    })

    it('laser upgrades range, recharge, then fires across the map at the strongest target', () => {
        const tower = new LaserTower(0, 0, 'laser')
        upgrade(tower, 1)
        expect(tower.range).toBe(180)
        upgrade(tower, 2)
        expect(tower.fireRate).toBe(240)
        upgrade(tower)
        const strongest = target('strong', 2000)
        strongest.maxHealth = strongest.currentHealth = 20000
        const beyond = target('beyond', 3000)
        tower.update(1, [beyond, strongest], rng())
        expect(tower.currentTarget).toBe(strongest)
        expect(tower.beamEnd).toEqual({ x: 10000, y: 0 })
        expect(strongest.currentHealth).toBe(19998)
        expect(beyond.currentHealth).toBe(9999)
        tower.update(59, [strongest, beyond], rng())
        expect(tower.fireTimer).toBe(480)
    })

    it('shock L2 improves fire rate, and L3 stuns only groups of three every ten seconds', () => {
        const tower = new ShockTower(0, 0, 'shock')
        upgrade(tower)
        expect(tower.damage).toBe(5)
        expect(tower.fireRate).toBe(60)
        const enemies = [10, 20, 30, 1000, 1010].map((x) => target(`${x}`, x))
        tower.update(599, enemies, rng())
        expect(enemies.every((enemy) => enemy.stunTimer === 0)).toBe(true)
        tower.update(1, enemies, rng())
        expect(enemies.map((enemy) => enemy.stunTimer)).toEqual([420, 420, 420, 0, 0])
        expect(enemies.every((enemy) => enemy.currentHealth < enemy.maxHealth)).toBe(true)
        enemies.forEach((enemy) => {
            enemy.stunTimer = 0
        })
        tower.update(599, enemies, rng())
        expect(enemies.every((enemy) => !enemy.stunTimer)).toBe(true)
    })

    it('confused towers target another in-range enemy, falling back to the boss when alone', () => {
        const tower = new CannonTower(0, 0, 'tower')
        const boss = new Enemy('boss', 'large', 'boss', ['confuse'])
        boss.x = 10
        boss.abilityStates.confuseTimer = 360
        const other = target('other', 60)
        expect(tower.findTarget([boss, other])).toBe(other)
        other.x = 200
        expect(tower.findTarget([boss, other])).toBe(boss)
        other.spawned = false
        other.x = 50
        expect(tower.findTarget([boss, other])).toBe(boss)
    })

    it('blind projectiles continue to a fixed point even after the boss moves out of range', () => {
        const tower = new CannonTower(0, 0, 'tower')
        const boss = target('boss', 40)
        tower.blind({ x: 40, y: 0 }, 480, boss)
        boss.x = 200
        tower.update(1, [boss], rng())
        expect(tower.projectiles[0]!.fixedTarget).toEqual({ x: 40, y: 0 })
        tower.update(20, [boss], rng())
        expect(boss.currentHealth).toBe(boss.maxHealth)
        const other = target('other', 40)
        tower.fireTimer = 0
        tower.update(1, [boss, other], rng())
        tower.update(20, [boss, other], rng())
        expect(other.currentHealth).toBe(other.maxHealth - tower.damage)
    })
})

describe('combat barricades', () => {
    it.each(['wall', 'filter'] as const)('%s L2 repairs exactly 5% every five seconds', (type) => {
        const barricade = new Barricade(type, 0, 0, 40, 40, 'b')
        barricade.active = true
        upgrade(barricade, 2)
        barricade.takeDamage(100)
        const before = barricade.currentHealth
        barricade.update(299)
        expect(barricade.currentHealth).toBe(before)
        barricade.update(1)
        expect(barricade.currentHealth).toBe(before + barricade.maxHealth * 0.05)
    })

    it('shield deals medium damage, restores at L1/L2, and only L3 limits attackers', () => {
        const barricade = new Barricade('shield', 0, 0, 40, 40, 'shield')
        barricade.active = true
        expect(barricade.damageToEnemies).toBe(10)
        expect(barricade.maxAttackers).toBe(Infinity)
        barricade.takeDamage(100)
        upgrade(barricade, 1)
        expect(barricade.currentHealth).toBe(barricade.maxHealth)
        barricade.takeDamage(100)
        barricade.level = 2
        barricade.applyUpgrade()
        expect(barricade.currentHealth).toBe(barricade.maxHealth)
        expect(barricade.damageToEnemies).toBe(16)
        barricade.level = 3
        barricade.applyUpgrade()
        for (let i = 0; i < 5; i++) barricade.registerAttacker(`${i}`)
        expect(barricade.canAcceptAttacker('next')).toBe(false)
        barricade.resetAttackers(['0', '2', '3', '4'])
        expect(barricade.canAcceptAttacker('next')).toBe(true)
    })

    it('upgrades over time using military count and keeps durability buffs through upgrades', () => {
        const barricade = new Barricade('wall', 0, 0, 40, 40, 'wall')
        barricade.active = true
        barricade.setHealthMultiplier(2)
        expect(barricade.startUpgrade()).toBe(true)
        expect(barricade.startUpgrade()).toBe(false)
        expect(barricade.updateUpgrade(10, 79)).toBe(false)
        expect(barricade.level).toBe(0)
        expect(barricade.snapshot().upgradeProgress).toBe(237)
        expect(barricade.updateUpgrade(10, 1)).toBe(true)
        expect(barricade.maxHealth).toBe(1040)
        expect(barricade.currentHealth).toBe(1040)
        expect(barricade.upgrading).toBe(false)
    })
})
