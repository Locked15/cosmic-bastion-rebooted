import { describe, expect, it } from 'vitest'
import { createLevel, createSeededRandom } from '@/domain'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { CheckpointService } from '../CheckpointService'
import { GameSession } from '../session/GameSession'

const newSession = () => new GameSession(createLevel('level_1')!, createSeededRandom(5))

function settle(session: GameSession, maxFrames = 60 * 600) {
    for (let frame = 0; frame < maxFrames; frame++) {
        while (session.activeDialog) {
            if (session.activeDialog.phase === 'consequence') session.story.acknowledge()
            else session.chooseDialog(0)
        }
        const busy =
            session.waveInProgress ||
            session.slots.some((slot) => slot.construction || slot.tower?.upgrading) ||
            session.barricades.some((barricade) => barricade.building || barricade.upgrading)
        if (!busy) return
        session.advance(1)
    }
}

describe('CheckpointService', () => {
    it('saves between waves and restores towers, barricades, resources and wave', () => {
        const storage = new MemoryStore()
        const service = new CheckpointService(storage)
        const session = newSession()
        session.resources = 5_000
        settle(session)
        session.buildTower(session.slots[0]!.id, 'cannon')
        const vertex = session.level.basePath[2]!
        session.buildBarricade(vertex, 'wall')
        settle(session)
        session.upgrade(session.slots[0]!.id)
        settle(session)

        // Before the first wave: everything built so far comes back.
        expect(service.save(session)).toBe(true)
        const early = newSession()
        expect(service.restore(early)).toBe(true)
        expect(early.activeDialog).toBeNull()
        expect(early.resources).toBeCloseTo(session.resources)
        expect(early.slots[0]!.tower).toMatchObject({ type: 'cannon', level: 1 })
        expect(early.barricades).toHaveLength(1)
        expect(early.barricades[0]!.active).toBe(true)
        expect(early.miners + early.military).toBe(session.miners + session.military)

        // After a wave: the wave counter and surviving defences are kept.
        session.startWave()
        settle(session)
        expect(service.save(session)).toBe(true)
        expect(service.savedWave('level_1')).toBe(1)
        const later = newSession()
        service.restore(later)
        expect(later.currentWave).toBe(1)
        expect(later.barricades.length).toBe(session.barricades.filter((b) => b.active).length)

        service.clear('level_1')
        expect(service.savedWave('level_1')).toBeNull()
    })

    it('refuses to save during a wave', () => {
        const session = newSession()
        settle(session)
        session.startWave()
        expect(new CheckpointService(new MemoryStore()).save(session)).toBe(false)
    })
})
