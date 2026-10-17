import { describe, expect, it } from 'vitest'
import { Enemy, Level, assignRoutes, createSeededRandom, type RouteDefinition } from '../index'

const line = (x: number) => [
    { x, y: 0 },
    { x, y: 200 },
    { x, y: 500 },
]

function levelWith(routes: Partial<RouteDefinition>[]): Level {
    const level = new Level('level_test', 'Тест', 'Тест')
    level.totalWaves = 5
    level.livingQuartersY = 400
    level.routes = routes.map((route, index) => ({
        id: `r${index}`,
        label: `Путь ${index}`,
        points: line(100 + index * 200),
        opensOnWave: 1,
        reserve: false,
        ...route,
    }))
    return level
}

const crowd = (count: number, size: Enemy['size'] = 'medium', type: Enemy['type'] = 'simple') =>
    Array.from({ length: count }, (_, i) => new Enemy(type, size, `e${i}`))

const ids = (routes: RouteDefinition[]) => routes.map((route) => route.id)

describe('route assignment', () => {
    it('keeps one-route levels on that route without drawing random numbers', () => {
        const level = levelWith([{}])
        const rng = createSeededRandom(5)
        const before = createSeededRandom(5).next()
        expect(new Set(ids(assignRoutes(level, 1, crowd(10), [], rng)))).toEqual(new Set(['r0']))
        expect(rng.next()).toBe(before)
    })

    it('splits a wave between open routes by weight', () => {
        const level = levelWith([{ weight: 3 }, { weight: 1 }])
        const routes = ids(assignRoutes(level, 1, crowd(400), [], createSeededRandom(1)))
        const share = routes.filter((id) => id === 'r0').length / routes.length
        expect(share).toBeGreaterThan(0.65)
        expect(share).toBeLessThan(0.85)
    })

    it('opens routes on their wave and never sends enemies along a reserve route', () => {
        const level = levelWith([{}, { opensOnWave: 3 }, { reserve: true }])
        const rng = createSeededRandom(2)
        expect(new Set(ids(assignRoutes(level, 2, crowd(50), [], rng)))).toEqual(new Set(['r0']))
        expect(new Set(ids(assignRoutes(level, 3, crowd(50), [], rng)))).toEqual(
            new Set(['r0', 'r1']),
        )
    })

    it('sends small enemies to fast routes, large ones and nodes to heavy routes', () => {
        const level = levelWith([{}, { role: 'fast' }, { role: 'heavy' }])
        const rng = createSeededRandom(3)
        expect(new Set(ids(assignRoutes(level, 1, crowd(20, 'small'), [], rng)))).toEqual(
            new Set(['r1']),
        )
        expect(new Set(ids(assignRoutes(level, 1, crowd(20, 'large'), [], rng)))).toEqual(
            new Set(['r2']),
        )
        expect(
            new Set(ids(assignRoutes(level, 1, crowd(20, 'medium', 'miniboss'), [], rng))),
        ).toEqual(new Set(['r2']))
        // Rank-and-file without a role route share the general routes only.
        expect(new Set(ids(assignRoutes(level, 1, crowd(40), [], rng)))).toEqual(new Set(['r0']))
    })

    it('sends a boss down its own lane, or the heavy lane when there is none', () => {
        const boss = crowd(1, 'large', 'boss')
        const rng = createSeededRandom(4)
        const lanes = levelWith([{}, { role: 'heavy' }, { role: 'boss' }])
        expect(ids(assignRoutes(lanes, 1, boss, [], rng))).toEqual(['r2'])
        const heavy = levelWith([{}, { role: 'heavy' }])
        expect(ids(assignRoutes(heavy, 1, boss, [], rng))).toEqual(['r1'])
    })

    it('hands a blocked route to its detour, unless the detour is blocked as well', () => {
        const level = levelWith([{ detour: 'r1' }, { reserve: true, detour: 'r0' }])
        const onMain = { x: 80, y: 180, width: 40, height: 40 }
        const onDetour = { x: 280, y: 180, width: 40, height: 40 }
        const rng = createSeededRandom(6)
        expect(ids(assignRoutes(level, 1, crowd(3), [onMain], rng))).toEqual(['r1', 'r1', 'r1'])
        expect(ids(assignRoutes(level, 1, crowd(1), [onMain, onDetour], rng))).toEqual(['r0'])
    })
})
