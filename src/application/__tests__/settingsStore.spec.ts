import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { provideTestServices } from './testServices'

let storage: MemoryStore

beforeEach(async () => {
    storage = new MemoryStore()
    setActivePinia(createPinia())
    await provideTestServices({ deviceStorage: storage })
})

describe('settingsStore', () => {
    it('drops removed settings (enemy speed, difficulty) from old saves', () => {
        storage.write('settings', {
            brightness: 80,
            volume: 20,
            enemySpeed: 1.3,
            difficulty: 'xhard',
        })
        const { settings } = useSettingsStore()
        expect(settings).toEqual({
            brightness: 80,
            volume: 20,
            music: 40,
            crewScenes: true,
            romance: true,
        })
    })
})
