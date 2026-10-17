import { describe, expect, it } from 'vitest'
import {
    CAMPAIGN,
    LEVEL_IDS,
    createLevel,
    distance,
    projectOntoPath,
    type Level,
    type Point,
    type RouteDefinition,
} from '@/domain'

// Reach of an ordinary tower (machine gun 100, cannon 120) with a little upgrade margin.
const REACH = 115
// Where a route may enter the map: within this distance of an edge.
const EDGE = 40

const live = (level: Level) => level.routes.filter((route) => !route.reserve)

// The part of a route enemies walk before the living quarters.
function corridorPart(level: Level, route: RouteDefinition): Point[] {
    const points = route.points.filter((point) => point.y < level.livingQuartersY)
    const end = route.points.find((point) => point.y >= level.livingQuartersY)
    return end ? [...points, { x: end.x, y: level.livingQuartersY }] : points
}

function covers(level: Level, slot: Point, route: RouteDefinition): boolean {
    const part = corridorPart(level, route)
    return part.length >= 2 && projectOntoPath(slot, part)!.distance <= REACH
}

describe.each(LEVEL_IDS)('%s design', (id) => {
    const level = createLevel(id)!

    it('covers every route with at least two foundations', () => {
        for (const route of level.routes) {
            const covering = level.towerSlots.filter((slot) => covers(level, slot, route))
            expect(covering.length, `route ${route.id}`).toBeGreaterThanOrEqual(2)
        }
    })

    it('lets enemies enter at the edge of the map and stay inside it', () => {
        for (const route of live(level)) {
            const start = route.points[0]!
            const atEdge =
                start.x <= EDGE ||
                start.y <= EDGE ||
                start.x >= level.width - EDGE ||
                start.y >= level.height - EDGE
            expect(atEdge, `route ${route.id} starts at ${start.x},${start.y}`).toBe(true)
            for (const point of route.points) {
                expect(point.x).toBeGreaterThanOrEqual(0)
                expect(point.x).toBeLessThanOrEqual(level.width)
                expect(point.y).toBeGreaterThanOrEqual(0)
                expect(point.y).toBeLessThanOrEqual(level.height)
            }
        }
    })

    it('has a bridge foundation when several routes are open', () => {
        if (live(level).length < 2) return
        const bridges = level.towerSlots.filter(
            (slot) => live(level).filter((route) => covers(level, slot, route)).length >= 2,
        )
        expect(bridges.length).toBeGreaterThanOrEqual(1)
        // …but not everywhere: most foundations still serve one lane.
        expect(bridges.length).toBeLessThan(level.towerSlots.length)
    })

    it('spreads foundations instead of one kill-box cluster', () => {
        for (const slot of level.towerSlots) {
            const near = level.towerSlots.filter((other) => distance(slot, other) <= 150)
            expect(near.length).toBeLessThanOrEqual(4)
        }
    })
})

describe('campaign route curve', () => {
    const levels = CAMPAIGN.sectors.map((sector) => createLevel(sector.level)!)
    const byId = (id: string) => levels.find((level) => level.id === id)!
    const routesOf = (level: Level) => live(level)

    it('teaches one route first, then a breach that opens on a later wave', () => {
        expect(routesOf(byId('level_0'))).toHaveLength(1)
        const hull = routesOf(byId('level_1'))
        expect(hull.length).toBe(2)
        expect(hull.some((route) => route.opensOnWave > 1)).toBe(true)
    })

    it('gives every other sector at least two ways in', () => {
        const narrow = levels
            .filter((l) => !['level_0', 'level_1'].includes(l.id))
            .filter((level) => routesOf(level).length < 2)
            .map((level) => level.id)
        expect(narrow).toEqual([])
    })

    it('uses every routing idea somewhere in the campaign', () => {
        const all = levels.flatMap((level) => level.routes)
        expect(all.some((route) => route.role === 'fast')).toBe(true)
        expect(all.some((route) => route.role === 'heavy')).toBe(true)
        expect(all.some((route) => route.role === 'boss')).toBe(true)
        expect(
            levels.filter((l) => l.routes.some((r) => r.opensOnWave > 1)).length,
        ).toBeGreaterThanOrEqual(5)
        expect(levels.filter((l) => l.routes.some((r) => r.detour)).length).toBeGreaterThanOrEqual(
            3,
        )
        expect(levels.filter((l) => routesOf(l).length >= 3).length).toBeGreaterThanOrEqual(4)
    })

    it('ends with the widest front at the reactor', () => {
        const finale = byId(CAMPAIGN.finale)
        expect(routesOf(finale).length).toBeGreaterThanOrEqual(4)
        expect(finale.routes.some((route) => route.role === 'boss')).toBe(true)
    })
})
