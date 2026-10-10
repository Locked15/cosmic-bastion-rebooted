import { describe, expect, it } from 'vitest'
import {
    BARRICADE_SIZE,
    LEVEL_IDS,
    createLevel,
    distance,
    projectOntoPath,
    rectCenter,
} from '@/domain'

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

    it('puts floor breaches on the base track', () => {
        for (const breach of level.floorBreaches) {
            expect(projectOntoPath(rectCenter(breach), level.basePath)!.distance).toBeLessThan(5)
        }
    })

    it('allows barricades only on the track or a breach', () => {
        const onTrack = level.basePath[1]!
        expect(
            level.barricadePlacement({ x: onTrack.x + 10, y: onTrack.y }, BARRICADE_SIZE),
        ).not.toBeNull()
        const slot = level.towerSlots[0]!
        expect(level.barricadePlacement(slot, BARRICADE_SIZE)).toBeNull()
        const breach = level.floorBreaches[0]!
        expect(level.barricadePlacement(rectCenter(breach), BARRICADE_SIZE)).toMatchObject({
            width: breach.width,
            height: breach.height,
        })
    })
})
