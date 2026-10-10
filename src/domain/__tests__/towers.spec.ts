import { describe, it, expect } from 'vitest'
import {
    CannonTower,
    RocketTower,
    LaserTower,
    TowerSlot,
    Enemy,
    Barricade,
    Projectile,
    ExplosiveProjectile,
    createSeededRandom,
} from '../index'

describe('towers', () => {
    it('fires a cannon projectile and damages a nearby enemy through repeated updates', () => {
        const tower = new CannonTower(100, 100, 'tower')
        const enemy = new Enemy('simple', 'large', 'enemy')
        enemy.setPath([
            { x: 130, y: 100 },
            { x: 150, y: 100 },
        ])
        const health = enemy.currentHealth
        const rng = createSeededRandom(1)
        let fired = false
        for (let i = 0; i < 2000 && enemy.currentHealth === health; i++) {
            tower.update(1, [enemy], rng)
            fired ||= tower.projectiles.length > 0
        }
        expect(fired).toBe(true)
        expect(enemy.currentHealth).toBeLessThan(health)
    })
    it('constructs the selected subclass and allows demolition and reconstruction', () => {
        const slot = new TowerSlot('slot', 100, 200, 'cannon')
        expect(slot.tower).toBeNull()
        expect(slot.updateConstruction(4)).toBe(false)
        expect(slot.startConstruction('rocket')).toBe(true)
        expect(slot.startConstruction('laser')).toBe(false)
        expect(slot.updateConstruction(4, 89)).toBe(false)
        expect(slot.construction?.progress).toBe(178)
        expect(slot.updateConstruction(4)).toBe(true)
        expect(slot.tower).toBeInstanceOf(RocketTower)
        expect(slot.tower?.id).toBe('slot')
        expect(slot.tower?.active).toBe(true)
        expect(slot.construction).toBeNull()
        expect(slot.updateConstruction(4)).toBe(false)
        expect(slot.startConstruction('laser')).toBe(false)
        slot.demolish()
        expect(slot.tower).toBeNull()
        expect(slot.startConstruction('laser')).toBe(true)
        expect(slot.updateConstruction(0, 180)).toBe(true)
        expect(slot.tower).toBeInstanceOf(LaserTower)
        expect(slot.tower?.x).toBe(100)
        expect(slot.tower?.y).toBe(200)
        slot.demolish()
        slot.startConstruction('cannon')
        slot.demolish()
        expect(slot.construction).toBeNull()
    })
    it('advances upgrades and repairs with military count and frame duration', () => {
        const tower = new CannonTower(0, 0, 'tower')
        for (let level = 1; level <= 3; level++) {
            expect(tower.startUpgrade()).toBe(true)
            expect(tower.startUpgrade()).toBe(false)
            expect(tower.updateUpgrade(10, 79)).toBe(false)
            expect(tower.updateUpgrade(10)).toBe(true)
            expect(tower.level).toBe(level)
            expect(tower.abilities).toHaveLength(level)
        }
        expect(tower.damage).toBe(35)
        expect(tower.multiTarget).toBe(true)
        expect(tower.startUpgrade()).toBe(false)
        tower.setBaseStats()
        expect(tower.damage).toBe(15)
        expect(tower.abilities).toEqual([])
        tower.active = false
        tower.broken = true
        expect(tower.startRepair()).toBe(true)
        expect(tower.updateRepair(4, 90)).toBe(true)
        expect(tower.active).toBe(true)
        expect(tower.broken).toBe(false)
    })
    it('decrements disable duration in frames', () => {
        const tower = new CannonTower(0, 0, 'tower')
        const rng = createSeededRandom(1)
        tower.disable(240)
        tower.update(120, [], rng)
        expect(tower.disableTimer).toBe(120)
        expect(tower.disabled).toBe(true)
        tower.update(120, [], rng)
        expect(tower.disableTimer).toBe(0)
        expect(tower.disabled).toBe(false)
    })
    it('scales continuous laser damage by elapsed frames', () => {
        const tower = new LaserTower(0, 0, 'laser')
        const enemy = new Enemy('simple', 'large', 'enemy')
        tower.update(2, [enemy], createSeededRandom(1))
        expect(enemy.currentHealth).toBe(enemy.maxHealth - 4)
    })
    it('passes tower IDs through projectiles for adaptation', () => {
        const enemy = new Enemy('ability', 'large', 'enemy', ['adaptation'])
        const first = new Projectile(0, 0, enemy, 10, 'p1', 'cannon', false, 'tower_1')
        first.update(1)
        const health = enemy.currentHealth
        new Projectile(0, 0, enemy, 10, 'p2', 'bullet', false, 'tower_2').update(1)
        expect(enemy.currentHealth).toBe(health)
        expect(first.active).toBe(false)
    })
    it('applies projectile slows and explosion falloff and knockback', () => {
        const enemy = new Enemy('simple', 'large', 'enemy')
        new Projectile(0, 0, enemy, 5, 'p1', 'bullet', true).update(1)
        expect(enemy.slowTimer).toBe(120)
        expect(enemy.slowMultiplier).toBe(0.5)
        const edgeEnemy = new Enemy('simple', 'large', 'edge')
        edgeEnemy.x = 40
        const rocket = new ExplosiveProjectile(
            0,
            0,
            enemy,
            20,
            40,
            true,
            [enemy, edgeEnemy],
            'rocket',
        )
        rocket.update(1)
        expect(enemy.currentHealth).toBe(125)
        expect(edgeEnemy.currentHealth).toBe(140)
        expect(edgeEnemy.x).toBe(60)
        expect(rocket.active).toBe(false)
    })
})

describe('barricades', () => {
    it('builds, takes damage and repairs by frame duration', () => {
        const barricade = new Barricade('wall', 0, 0, 40, 40, 'wall')
        expect(barricade.startBuild()).toBe(true)
        expect(barricade.updateBuild(10, 35)).toBe(true)
        expect(barricade.active).toBe(true)
        barricade.takeDamage(-10)
        expect(barricade.currentHealth).toBe(400)
        barricade.level = 1
        barricade.applyUpgrade()
        expect(barricade.maxHealth).toBe(520)
        barricade.level = 2
        barricade.applyUpgrade()
        barricade.takeDamage(50)
        const health = barricade.currentHealth
        barricade.update(10)
        expect(barricade.currentHealth).toBeCloseTo(health + 8)
        barricade.takeDamage(barricade.currentHealth)
        expect(barricade.active).toBe(false)
        expect(barricade.broken).toBe(true)
    })
    it('limits distinct shield attackers and exposes upgrade benefits', () => {
        const barricade = new Barricade('shield', 0, 0, 40, 40, 'shield')
        barricade.level = 3
        barricade.applyUpgrade()
        expect(barricade.forceField).toBe(true)
        barricade.registerAttacker('a')
        barricade.registerAttacker('b')
        expect(barricade.canAcceptAttacker('a')).toBe(true)
        expect(barricade.canAcceptAttacker('c')).toBe(false)
        barricade.resetAttackers()
        expect(barricade.canAcceptAttacker('c')).toBe(true)
        const snapshot = barricade.snapshot()
        snapshot.abilities[0]!.name = 'changed'
        expect(barricade.abilities[0]!.name).not.toBe('changed')
    })
})
