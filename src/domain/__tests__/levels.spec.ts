import { describe, it, expect } from 'vitest'
import {
    LEVEL_IDS,
    createLevel,
    Level,
    Campaign,
    Barricade,
    TOWER_CATALOG,
    lineIntersectsRect,
    pointInRect,
    rectsOverlap,
    distance,
} from '../index'

describe('levels', () => {
    it('provides fresh levels with valid paths, slots and waves', () => {
        const ids = new Set<string>()
        for (const id of LEVEL_IDS) {
            const level = createLevel(id)!
            expect(level).toBeInstanceOf(Level)
            expect(ids.has(level.id)).toBe(false)
            ids.add(level.id)
            expect(level.basePath.length).toBeGreaterThanOrEqual(2)
            expect(level.totalWaves).toBeGreaterThan(0)
            for (const slot of level.towerSlots)
                expect(Object.prototype.hasOwnProperty.call(TOWER_CATALOG, slot.type)).toBe(true)
            expect(createLevel(id)).not.toBe(level)
        }
        expect(createLevel('unknown')).toBeNull()
    })
    it('switches level 2 to its alternative path when an active barricade blocks the base path', () => {
        const level = createLevel('level_2')!
        const point = level.basePath[1]!
        const barricade = new Barricade('wall', point.x - 20, point.y - 20, 40, 40, 'wall')
        expect(level.getCurrentPath([barricade])).toEqual(level.basePath)
        barricade.active = true
        expect(level.getCurrentPath([barricade])).toEqual(level.alternativePaths[0])
        barricade.destroy()
        expect(level.getCurrentPath([barricade])).toEqual(level.basePath)
    })
    it('isolates state between factory calls', () => {
        const level = createLevel('level_2')!
        const path = level.getCurrentPath([])
        path[0]!.x = -999
        expect(level.basePath[0]!.x).not.toBe(-999)
    })
})

describe('campaign', () => {
    it('opens both branches, requires both for the core, and preserves best stars', () => {
        const campaign = new Campaign()
        expect(campaign.selectLevel('level_2')).toBeNull()
        expect(campaign.isUnlocked('unknown')).toBe(false)
        campaign.completeLevel('level_1', 3)
        expect(campaign.isUnlocked('level_2')).toBe(true)
        expect(campaign.isUnlocked('level_3')).toBe(true)
        expect(campaign.isUnlocked('level_4')).toBe(false)
        campaign.completeLevel('level_3', 3)
        expect(campaign.isUnlocked('level_4')).toBe(false)
        campaign.completeLevel('level_2', 3)
        expect(campaign.isUnlocked('level_4')).toBe(true)
        campaign.completeLevel('level_4', 3)
        // The reactor also needs the engine sector, which opens after the core.
        expect(campaign.isUnlocked('level_5')).toBe(false)
        expect(campaign.isUnlocked('level_9')).toBe(true)
        campaign.completeLevel('level_9', 3)
        expect(campaign.isUnlocked('level_5')).toBe(true)
        campaign.completeLevel('level_1', 1)
        expect(campaign.levels[0]!.stars).toBe(3)
        expect(campaign.totalStars).toBe(15)
        expect(campaign.completedLevels).toHaveLength(5)
    })
    it('round-trips plain JSON progress and resets without storage', () => {
        const campaign = new Campaign()
        campaign.completeLevel('level_1', 2)
        campaign.completeLevel('level_2', 3)
        campaign.selectLevel('level_3')
        const progress = campaign.toProgress()
        const restored = Campaign.fromProgress(JSON.parse(JSON.stringify(progress)))
        expect(restored.toProgress()).toEqual(progress)
        progress.levels[0]!.stars = 0
        expect(campaign.levels[0]!.stars).toBe(2)
        restored.reset()
        expect(restored.toProgress()).toEqual(new Campaign().toProgress())
        expect(Campaign.fromProgress().toProgress()).toEqual(new Campaign().toProgress())
    })
    it('normalizes loaded star counts and derives unlocks from completions', () => {
        const campaign = new Campaign()
        campaign.completeLevel('level_1', 9)
        expect(campaign.levels[0]!.stars).toBe(3)
        const progress = campaign.toProgress()
        progress.totalStars = 999
        const finale = progress.levels.findIndex((level) => level.id === 'level_5')
        progress.levels[finale]!.locked = false
        progress.currentLevelIndex = finale
        const restored = Campaign.fromProgress(progress)
        expect(restored.totalStars).toBe(3)
        expect(restored.isUnlocked('level_5')).toBe(false)
        expect(restored.currentLevelIndex).toBe(0)
    })
})

describe('geometry', () => {
    const rect = { x: 0, y: 0, width: 10, height: 10 }
    it.each([
        ['horizontal crossing', -5, 5, 15, 5, true],
        ['vertical crossing', 5, -5, 5, 15, true],
        ['endpoint inside', 5, 5, 15, 15, true],
        ['segment inside', 2, 2, 8, 8, true],
        ['segment outside', -10, -10, -5, -5, false],
        ['parallel outside', -5, 15, 15, 15, false],
        ['diagonal misses corner despite overlapping bounds', -5, 2, 2, -5, false],
        ['edge touching', -5, 0, 15, 0, true],
        ['zero length inside', 5, 5, 5, 5, true],
        ['zero length outside', -1, -1, -1, -1, false],
    ] as const)('%s', (_name, x1, y1, x2, y2, expected) => {
        expect(lineIntersectsRect({ x: x1, y: y1 }, { x: x2, y: y2 }, rect)).toBe(expected)
    })
    it('computes distance and inclusive point and rectangle overlap', () => {
        expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
        expect(pointInRect({ x: 10, y: 10 }, rect)).toBe(true)
        expect(pointInRect({ x: 11, y: 10 }, rect)).toBe(false)
        expect(rectsOverlap(rect, { x: 10, y: 10, width: 5, height: 5 })).toBe(true)
        expect(rectsOverlap(rect, { x: 11, y: 11, width: 5, height: 5 })).toBe(false)
    })
})
