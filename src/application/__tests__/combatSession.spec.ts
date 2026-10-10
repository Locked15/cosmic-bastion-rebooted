import { describe, expect, it } from 'vitest'
import {
    Barricade,
    Enemy,
    CannonTower,
    RocketTower,
    MachineGunTower,
    LaserTower,
    ShockTower,
    createLevel,
    createSeededRandom,
} from '@/domain'
import { GameSession } from '../session/GameSession'
import { presentSelection } from '../session/presenters/selection'

function session() {
    const level = createLevel('level_1')!
    level.events = []
    const value = new GameSession(level, createSeededRandom(24))
    value.resources = 10000
    return value
}
const path = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 500 },
]
function enemy(
    id: string,
    size: Enemy['size'] = 'large',
    abilities: Enemy['abilities'] = [],
    type: Enemy['type'] = 'simple',
) {
    const value = new Enemy(type, size, id, abilities)
    value.setPath(path)
    value.setProgress(90)
    value.maxHealth = value.currentHealth = 10000
    return value
}
function barricade(type: Barricade['type'], level = 0) {
    const value = new Barricade(type, 100, -20, 40, 40, 'barricade')
    value.active = true
    value.broken = false
    for (let i = 1; i <= level; i++) {
        value.level = i
        value.applyUpgrade()
    }
    return value
}

describe('combat session integration', () => {
    it.each(['cannon', 'rocket', 'machinegun', 'laser', 'shock'] as const)(
        'applies story damage multipliers to %s damage',
        (type) => {
            const value = session()
            const tower = {
                cannon: CannonTower,
                rocket: RocketTower,
                machinegun: MachineGunTower,
                laser: LaserTower,
                shock: ShockTower,
            }[type]
            const slot = value.slots[0]!
            slot.tower = new tower(90, 0, slot.id)
            value.enemies = [enemy('target')]
            value.applyDamageBuff(2)
            value.applyDamageBuff(1.5)
            value.update(1)
            value.update(1)
            const expected = slot.tower.damage * 3 * (type === 'laser' ? 2 : 1)
            expect(value.enemies[0]!.currentHealth).toBeCloseTo(10000 - expected)
        },
    )

    it('applies damage buffs to already flying projectiles', () => {
        const value = session()
        const slot = value.slots[0]!
        slot.tower = new CannonTower(0, 0, slot.id)
        const target = enemy('target')
        slot.tower.fire(target, [target], value.rng)
        value.applyDamageBuff(2)
        expect(slot.tower.projectiles[0]!.damage).toBe(30)
    })

    it('applies durability buffs to existing, later-built and upgraded barricades', () => {
        const value = session()
        const wall = barricade('wall')
        value.barricades.push(wall)
        value.applyBarricadeBuff(2)
        expect(wall.maxHealth).toBe(800)
        expect(value.buildBarricade(value.level.basePath[1]!, 'filter').ok).toBe(true)
        const filter = value.barricades[1]!
        expect(filter.maxHealth).toBe(440)
        value.update(500)
        expect(filter.currentHealth).toBe(440)
        expect(value.upgrade(wall.id).ok).toBe(true)
        value.update(500)
        expect(wall.maxHealth).toBe(1040)
        expect(wall.currentHealth).toBe(1040)
    })

    it('charges once for a timed upgrade and presents its progress until completion', () => {
        const value = session()
        const wall = barricade('wall')
        value.barricades = [wall]
        value.selectedId = wall.id
        expect(value.upgrade().ok).toBe(true)
        const paid = value.resources
        expect(value.upgrade().ok).toBe(false)
        expect(value.resources).toBe(paid)
        value.update(1)
        const selection = presentSelection(value)!
        expect(selection.canUpgrade).toBe(false)
        expect(selection.status).toBe('Улучшение')
        expect(
            selection.progress.find((progress) => progress.label === 'Улучшение')!.percent,
        ).toBeGreaterThan(0)
        expect(wall.level).toBe(0)
        value.update(500)
        expect(wall.level).toBe(1)
        expect(presentSelection(value)!.canUpgrade).toBe(true)
    })

    it('uses mass proportionally for barricade damage', () => {
        const loss = (size: Enemy['size']) => {
            const value = session()
            const wall = barricade('wall')
            value.barricades = [wall]
            const target = enemy('target', size)
            target.setProgress(99.9)
            value.enemies = [target]
            value.update(1)
            return wall.maxHealth - wall.currentHealth
        }
        expect(loss('large') / loss('small')).toBeCloseTo(5)
        expect(loss('medium') / loss('small')).toBeCloseTo(2)
    })

    it('wall L3 pushes only stopped enemies every five seconds and preserves path progress', () => {
        const value = session()
        const wall = barricade('wall', 3)
        value.barricades = [wall]
        const stopped = enemy('stopped')
        stopped.setProgress(99.5)
        value.enemies = [stopped]
        value.update(1)
        expect(stopped._barricadeId).toBe(wall.id)
        for (let i = 0; i < 298; i++) value.update(1)
        expect(stopped.pathProgress).toBeCloseTo(99.5)
        value.update(1)
        expect(stopped.pathProgress).toBeCloseTo(70.3)
        value.update(1)
        expect(stopped.pathProgress).toBeCloseTo(71.1)
    })

    it('filter L3 passes small enemies slowed for five seconds and blocks larger enemies', () => {
        const value = session()
        const filter = barricade('filter', 3)
        value.barricades = [filter]
        const small = enemy('small', 'small')
        const large = enemy('large')
        small.setProgress(99)
        large.setProgress(99.5)
        value.enemies = [small, large]
        value.update(1)
        expect(small.pathProgress).toBeGreaterThan(100)
        expect(small.slowTimer).toBe(300)
        expect(small.slowMultiplier).toBe(filter.filterSlowMultiplier)
        expect(large.pathProgress).toBe(99.5)
        expect(large.currentHealth).toBeLessThan(large.maxHealth)
    })

    it('shield admits only the first five attackers and replaces one after death', () => {
        const value = session()
        const shield = barricade('shield', 3)
        value.barricades = [shield]
        const enemies = Array.from({ length: 6 }, (_, i) => enemy(`${i}`))
        enemies.forEach((target) => target.setProgress(99.5))
        value.enemies = enemies
        value.update(1)
        expect(shield.currentAttackers.size).toBe(5)
        expect(shield.currentAttackers.has('5')).toBe(false)
        enemies[0]!.alive = false
        value.update(1)
        expect(shield.currentAttackers.size).toBe(5)
        expect(shield.currentAttackers.has('5')).toBe(true)
    })

    it('boss destruction blocks construction without charging resources until cooldown expires', () => {
        const value = session()
        const slot = value.slots[0]!
        slot.tower = new CannonTower(500, 500, slot.id)
        const boss = enemy('boss', 'large', ['destroy'], 'boss')
        boss.abilityStates.bossTimer = 899
        value.enemies = [boss]
        value.update(1)
        expect(slot.tower).toBeNull()
        expect(slot.cooldown).toBe(300)
        const before = value.resources
        expect(value.buildTower(slot.id, 'cannon').ok).toBe(false)
        expect(value.resources).toBe(before)
        for (let i = 0; i < 300; i++) value.update(1)
        expect(value.buildTower(slot.id, 'cannon').ok).toBe(true)
    })

    it('boss spawning joins the live session and counts surviving offspring across ticks', () => {
        const value = session()
        const boss = enemy('boss', 'large', ['spawn'], 'boss')
        boss.speed = boss.baseSpeed = 0
        value.enemies = [boss]
        for (let spawn = 0; spawn < 6; spawn++) {
            boss.abilityStates.bossTimer = 599
            value.update(1)
        }
        const children = value.enemies.filter((target) => target.spawnedBy === boss.id)
        expect(children).toHaveLength(5)
        expect(children.every((target) => target.type === 'simple')).toBe(true)
        children[0]!.alive = false
        boss.abilityStates.bossTimer = 599
        value.update(1)
        expect(
            value.enemies.filter((target) => target.spawnedBy === boss.id && target.alive),
        ).toHaveLength(5)
    })

    it('counts living spawned enemies in the quarters against the boss spawn cap', () => {
        const value = session()
        const boss = enemy('boss', 'large', ['spawn'], 'boss')
        boss.baseSpeed = 0
        value.enemies = [boss]
        for (let spawn = 0; spawn < 5; spawn++) {
            boss.abilityStates.bossTimer = 599
            value.update(1)
        }
        const child = value.enemies.find((target) => target.spawnedBy === boss.id)!
        value.enemies = value.enemies.filter((target) => target !== child)
        value.quarters.admit(child)
        boss.abilityStates.bossTimer = 599
        value.update(1)
        expect(
            [...value.enemies, ...value.quarters.enemies].filter(
                (target) => target.spawnedBy === boss.id,
            ),
        ).toHaveLength(5)
    })

    it('rocket knockback survives the session movement and collision pass', () => {
        const value = session()
        const slot = value.slots[0]!
        const tower = new RocketTower(150, 0, slot.id)
        for (let i = 1; i <= 3; i++) {
            tower.level = i
            tower.applyUpgrade()
        }
        slot.tower = tower
        const target = enemy('target')
        target.setProgress(150)
        value.enemies = [target]
        value.update(1)
        value.update(1)
        expect(target.pathProgress).toBeCloseTo(131.6)
        expect(target.y).toBe(0)
    })
})
