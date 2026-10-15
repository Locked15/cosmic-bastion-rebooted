import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { CAMPAIGN, DIFFICULTIES, DIFFICULTY_IDS, requisitionReward, sectorDepth } from '@/domain'
import { difficultySchema } from '../rules/difficulty'

describe('difficulty content', () => {
    it.each(DIFFICULTY_IDS)('validates all %s knobs', (id) => {
        const rank = DIFFICULTIES[id]
        expect(v.safeParse(difficultySchema, rank).success).toBe(true)
        for (const field of ['dialogSpeed', 'refundRate', 'swarmMemory'] as const) {
            expect(v.safeParse(difficultySchema, { ...rank, [field]: 1.01 }).success).toBe(false)
            expect(v.safeParse(difficultySchema, { ...rank, [field]: -0.01 }).success).toBe(false)
        }
        expect(
            v.safeParse(difficultySchema, { ...rank, bosses: { ...rank.bosses, every: 0 } })
                .success,
        ).toBe(false)
    })

    it('loads the prescribed rank values', () => {
        expect(
            DIFFICULTY_IDS.map((id) => {
                const d = DIFFICULTIES[id]
                return [
                    d.dialogSpeed,
                    d.refundRate,
                    d.startResources,
                    d.requisitions,
                    d.swarmMemory,
                ]
            }),
        ).toEqual([
            [0, 0.9, 1.5, 0.6, 0],
            [0.5, 0.5, 1, 1, 0],
            [0.75, 0.5, 1, 1.3, 0.15],
            [1, 0.3, 0.85, 1.6, 0.25],
        ])
    })
})

describe('campaign depth', () => {
    it('uses the longest prerequisite chain and gives training zero depth', () => {
        expect(
            Object.fromEntries(
                CAMPAIGN.sectors.map((sector) => [sector.level, sectorDepth(sector.level)]),
            ),
        ).toEqual({
            level_0: 0,
            level_1: 1,
            level_2: 2,
            level_3: 2,
            level_6: 2,
            level_10: 2,
            level_7: 3,
            level_8: 3,
            level_11: 3,
            level_4: 3,
            level_12: 4,
            level_13: 4,
            level_9: 4,
            level_14: 4,
            level_15: 5,
            level_5: 6,
        })
        expect(sectorDepth('unknown')).toBe(0)
    })
})

describe('requisition multiplier', () => {
    it.each(['victory', 'defeat'] as const)(
        'scales the final %s reward and preserves the default',
        (outcome) => {
            for (const stars of [0, 1, 2, 3]) {
                for (const first of [true, false]) {
                    for (const id of DIFFICULTY_IDS) {
                        const base = requisitionReward(outcome, stars, first)
                        expect(
                            requisitionReward(outcome, stars, first, DIFFICULTIES[id].requisitions),
                        ).toBe(Math.round(base * DIFFICULTIES[id].requisitions))
                    }
                }
            }
        },
    )
})
