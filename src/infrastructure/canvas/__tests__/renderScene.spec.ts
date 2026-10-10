import { describe, expect, it } from 'vitest'
import {
    Barricade,
    Person,
    TowerSlot,
    createLevel,
    createSeededRandom,
    generateWave,
} from '@/domain'
import type { Scene } from '@/application/session/scene'
import { renderScene } from '..'

interface RecordedCall {
    method: string
    args: unknown[]
}

function recordingContext(): { ctx: CanvasRenderingContext2D; calls: RecordedCall[] } {
    const calls: RecordedCall[] = []
    const properties: Record<string, unknown> = {}
    const ctx = new Proxy(properties, {
        get(target, key: string): unknown {
            if (key in target) return target[key]
            return (...args: unknown[]): unknown => {
                calls.push({ method: key, args })
                return key === 'measureText' ? { width: 10 } : undefined
            }
        },
        set(target, key: string, value: unknown): boolean {
            target[key] = value
            return true
        },
    }) as unknown as CanvasRenderingContext2D
    return { ctx, calls }
}

function createScene(): Scene {
    const level = createLevel('level_1')
    if (!level) throw new Error('Missing level_1')
    const slots = level.towerSlots.map(
        (slot, index) => new TowerSlot(`slot-${index}`, slot.x, slot.y, slot.type),
    )
    const slot = slots[0]!
    slot.startConstruction('cannon')
    slot.updateConstruction(5, 1000)
    const barricade = new Barricade('wall', 200, 200, 40, 40, 'barricade')
    const enemies = generateWave(1, 1, createSeededRandom(1)).slice(0, 3)
    for (const enemy of enemies) {
        enemy.setPath(level.basePath)
        enemy.spawned = true
    }
    return {
        level,
        view: 'corridor',
        slots,
        barricades: [barricade],
        enemies,
        enemiesInQuarters: enemies.slice(0, 1),
        people: [
            new Person('miner', 100, 550, 'miner'),
            new Person('military', 200, 550, 'soldier'),
        ],
        miners: 1,
        military: 1,
        inTransit: 2,
        pointer: {
            world: null,
            build: null,
            slotId: null,
            footprint: null,
            footprintValid: false,
            hoverId: slot.id,
        },
        selectedId: slot.id,
    }
}

describe('renderScene', () => {
    it('fits the living rectangle by composing with the caller transform', () => {
        const { ctx, calls } = recordingContext()
        const scene = { ...createScene(), view: 'living' as const }
        ctx.scale(2, 2)
        renderScene(ctx, scene, 600, 300)
        expect(calls.slice(0, 5)).toEqual([
            { method: 'scale', args: [2, 2] },
            { method: 'save', args: [] },
            { method: 'fillRect', args: [0, 0, 600, 300] },
            { method: 'translate', args: [0, -137.5] },
            { method: 'scale', args: [0.5, 0.5] },
        ])
        expect(calls.some((call) => ['setTransform', 'resetTransform'].includes(call.method))).toBe(
            false,
        )
        expect(calls.filter((call) => call.method === 'save')).toHaveLength(
            calls.filter((call) => call.method === 'restore').length,
        )
    })

    it('renders real domain objects in both views', () => {
        const { ctx, calls } = recordingContext()
        const scene = createScene()
        expect(() => renderScene(ctx, scene, 800, 600)).not.toThrow()
        expect(() => renderScene(ctx, { ...scene, view: 'living' }, 800, 600)).not.toThrow()
        expect(
            calls.some((call) => call.method === 'fillText' && call.args[0] === 'ЖИЛОЙ ОТСЕК'),
        ).toBe(true)
    })
})
