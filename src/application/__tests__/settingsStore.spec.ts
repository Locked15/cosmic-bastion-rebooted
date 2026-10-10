import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { silentSoundPlayer } from '../ports/SoundPlayer'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { provideServices } from '@/stores/services'
import { useSettingsStore } from '@/stores/settingsStore'
import { createMathRandom } from '@/domain'

let storage: MemoryStore

beforeEach(() => {
    storage = new MemoryStore()
    setActivePinia(createPinia())
    provideServices({
        storage,
        sound: silentSoundPlayer,
        createRandom: createMathRandom,
        createScheduler: () => ({ start() {}, stop() {} }),
        renderScene: () => {},
    })
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
        expect(settings).toEqual({ brightness: 80, volume: 20, difficulty: 'modest' })
    })

    it('describes the selected difficulty with its effects', () => {
        const store = useSettingsStore()
        store.settings.difficulty = 'xhard'
        expect(store.difficultyDetails.description).toContain('Последний рубеж')
        expect(store.difficultyDetails.effects).toBe(
            'Здоровье врагов ×1.8 · Скорость ×1.3 · Прорывов до поражения: 3',
        )
        expect(store.difficultyOptions.map((option) => option.text)).toEqual([
            'Рядовой',
            'Лейтенант',
            'Майор',
            'Генерал',
        ])
    })
})
