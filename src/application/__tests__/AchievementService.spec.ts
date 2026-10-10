import { describe, expect, it } from 'vitest'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { AchievementService } from '../AchievementService'

const facts = {
    killed: 0,
    activeTowers: 0,
    military: 0,
    gathered: 0,
    personnelLost: 0,
    victory: false,
}

describe('AchievementService', () => {
    it('unlocks each achievement once and persists it', () => {
        const storage = new MemoryStore()
        const service = new AchievementService(storage)
        expect(service.check(facts)).toEqual([])
        expect(service.check({ ...facts, killed: 1 })).toEqual(['Первая кровь'])
        expect(service.check({ ...facts, killed: 5 })).toEqual([])

        const reloaded = new AchievementService(storage)
        expect(reloaded.list().find((a) => a.id === 'firstBlood')?.unlocked).toBe(true)
        expect(reloaded.check({ ...facts, victory: true })).toEqual(['Выживший'])
    })
})
