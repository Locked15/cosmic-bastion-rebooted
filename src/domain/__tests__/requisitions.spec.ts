import { describe, expect, it } from 'vitest'
import {
    NO_BONUSES,
    REQUISITIONS,
    bonusesFor,
    requisitionReward,
    upgradeCost,
    upgradeDefinition,
} from '@/domain'

describe('requisition rules', () => {
    it('makes every next level a little more expensive, and potent ranks pricier', () => {
        for (const upgrade of REQUISITIONS.upgrades) {
            const costs = Array.from({ length: upgrade.maxLevel }, (_, level) =>
                upgradeCost(upgrade, level),
            )
            costs.slice(1).forEach((cost, index) => expect(cost).toBeGreaterThan(costs[index]!))
            // "Slightly": never more than a third above the previous level.
            costs.slice(1).forEach((cost, index) => expect(cost / costs[index]!).toBeLessThan(1.34))
        }
        const firstCost = (rank: number) =>
            upgradeCost(
                REQUISITIONS.upgrades.find((upgrade) => upgrade.rank === rank)!,
                0,
            )
        expect(firstCost(1)).toBeLessThan(firstCost(2))
        expect(firstCost(2)).toBeLessThan(firstCost(3))
        expect(firstCost(3)).toBeLessThan(firstCost(4))
    })

    it('pays more for stars and the first victory than for replays and defeats', () => {
        const first = requisitionReward('victory', 3, true)
        const replay = requisitionReward('victory', 3, false)
        expect(first).toBe(40 + 45 + 40)
        expect(replay).toBe(Math.round(85 * 0.5))
        expect(requisitionReward('victory', 1, true)).toBeLessThan(first)
        expect(requisitionReward('defeat', 3, true)).toBe(REQUISITIONS.earning.defeat)
    })

    it('turns upgrade levels into session bonuses', () => {
        expect(bonusesFor({})).toEqual(NO_BONUSES)
        const bonuses = bonusesFor({
            mining: 2,
            start_resources: 3,
            conversion_speed: 4,
            breach_tolerance: 9,
            unknown: 5,
        })
        expect(bonuses.mining).toBeCloseTo(1.12)
        expect(bonuses.startResources).toBe(90)
        expect(bonuses.conversionSpeed).toBeCloseTo(0.6)
        // Levels above the maximum count as the maximum.
        expect(bonuses.breakthroughs).toBe(upgradeDefinition('breach_tolerance')!.maxLevel)
    })
})
