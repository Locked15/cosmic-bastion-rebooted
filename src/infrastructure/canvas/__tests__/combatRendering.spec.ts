import { describe, expect, it } from 'vitest'
import { Barricade, Enemy, LaserTower, CannonTower, TowerSlot } from '@/domain'
import { drawEnemy } from '../enemyRenderer'
import { drawTowerSlot } from '../towerRenderer'
import { drawBarricade } from '../barricadeRenderer'

function context() {
    const calls: { method: string; args: unknown[] }[] = []
    const properties: Record<string, unknown> = {}
    const ctx = new Proxy(properties, {
        get(target, key: string) {
            if (key in target) return target[key]
            return (...args: unknown[]) => {
                calls.push({ method: key, args })
            }
        },
        set(target, key: string, value: unknown) {
            target[key] = value
            return true
        },
    }) as unknown as CanvasRenderingContext2D
    return { ctx, calls }
}

describe('combat canvas states', () => {
    it('renders the beam endpoint and secondary hit markers', () => {
        const { ctx, calls } = context()
        const slot = new TowerSlot('slot', 10, 10, 'laser')
        const tower = new LaserTower(10, 10, slot.id)
        slot.tower = tower
        tower.beamEnd = { x: 300, y: 100 }
        tower.beamHits = [{ x: 200, y: 80 }]
        drawTowerSlot(ctx, slot)
        expect(calls).toContainEqual({ method: 'lineTo', args: [290, 90] })
        expect(calls).toContainEqual({ method: 'arc', args: [190, 70, 8, 0, Math.PI * 2] })
    })

    it('renders a fixed blind marker and destroyed slot cooldown', () => {
        const { ctx, calls } = context()
        const slot = new TowerSlot('slot', 10, 10, 'cannon')
        slot.tower = new CannonTower(10, 10, slot.id)
        slot.tower.blind({ x: 150, y: 120 }, 480)
        drawTowerSlot(ctx, slot)
        expect(calls).toContainEqual({ method: 'arc', args: [150, 120, 12, 0, Math.PI * 2] })
        slot.destroy()
        drawTowerSlot(ctx, slot)
        expect(calls).toContainEqual({ method: 'fillText', args: ['5 с', 0, -22] })
    })

    it('renders stunned enemies and ambush arrivals', () => {
        const { ctx, calls } = context()
        const enemy = new Enemy('boss', 'large', 'boss', ['ambush'])
        enemy.stunTimer = 420
        drawEnemy(ctx, enemy)
        expect(calls.some((call) => call.method === 'fillText' && call.args[0] === 'ОГЛУШЁН')).toBe(
            true,
        )
        enemy.stunTimer = 0
        enemy.ambushFlashTimer = 60
        drawEnemy(ctx, enemy)
        expect(calls.some((call) => call.method === 'fillText' && call.args[0] === 'ЗАСАДА')).toBe(
            true,
        )
    })

    it('renders a barricade upgrade progress bar', () => {
        const { ctx, calls } = context()
        const barricade = new Barricade('wall', 10, 20, 40, 40, 'wall')
        barricade.active = true
        barricade.broken = false
        barricade.startUpgrade()
        barricade.upgradeProgress = 120
        drawBarricade(ctx, barricade)
        expect(calls).toContainEqual({ method: 'fillRect', args: [10, 65, 20, 4] })
    })
})
