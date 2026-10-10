import { describe, expect, it } from 'vitest'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { CampaignService } from '../CampaignService'

describe('CampaignService', () => {
    it('unlocks the next level and persists progress', () => {
        const storage = new MemoryStore()
        const service = new CampaignService(storage)
        expect(service.isUnlocked('level_2')).toBe(false)

        service.completeLevel('level_1', 2)

        const reloaded = new CampaignService(storage)
        expect(reloaded.isUnlocked('level_2')).toBe(true)
        expect(reloaded.listLevels()[0]).toMatchObject({ completed: true, stars: 2 })
        expect(reloaded.hasProgress).toBe(true)

        reloaded.reset()
        expect(new CampaignService(storage).isUnlocked('level_2')).toBe(false)
    })
})
