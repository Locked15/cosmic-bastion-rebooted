import { describe, expect, it } from 'vitest'
import { BARRICADE_SIZE, LEVEL_IDS, createLevel, distance, projectOntoPath } from '@/domain'

// Path is drawn 35 px wide and slots 22 px in radius: keep foundations clear of it.
const SLOT_CLEARANCE = 45

describe.each(LEVEL_IDS)('%s layout', (id) => {
    const level = createLevel(id)!

    it('keeps tower foundations off every enemy track', () => {
        for (const slot of level.towerSlots) {
            for (const path of level.paths) {
                expect(projectOntoPath(slot, path)!.distance).toBeGreaterThanOrEqual(SLOT_CLEARANCE)
            }
        }
    })

    it('keeps tower foundations apart', () => {
        level.towerSlots.forEach((a, i) =>
            level.towerSlots
                .slice(i + 1)
                .forEach((b) => expect(distance(a, b)).toBeGreaterThanOrEqual(50)),
        )
    })

    it('allows barricades only on the track', () => {
        const onTrack = level.basePath[1]!
        expect(
            level.barricadePlacement({ x: onTrack.x + 10, y: onTrack.y }, BARRICADE_SIZE),
        ).not.toBeNull()
        const slot = level.towerSlots[0]!
        expect(level.barricadePlacement(slot, BARRICADE_SIZE)).toBeNull()
    })
})
