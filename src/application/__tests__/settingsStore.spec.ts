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
    it('drops the removed enemy speed setting and unknown difficulties from old saves', () => {
        storage.write('settings', {
            brightness: 80,
            volume: 20,
            enemySpeed: 1.3,
            difficulty: 'nope',
        })
        const { settings } = useSettingsStore()
        expect(settings).toEqual({ brightness: 80, volume: 20, music: 40, difficulty: 'modest' })
    })

    it('describes the selected difficulty with its effects', () => {
        const store = useSettingsStore()
        store.settings.difficulty = 'xhard'
        expect(store.difficultyDetails.description).toContain('Последний рубеж')
        expect(store.difficultyDetails.effects).toBe(
            'Здоровье врагов ×1.8 · Скорость ×1.3 · Прорывов до поражения: 3',
        )
        expect(store.difficultyOptions.map((option) => option.text)).toEqual([
            'Младший лейтенант',
            'Лейтенант',
            'Майор',
            'Генерал',
        ])
    })
})
