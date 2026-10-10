import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { DEFAULT_SETTINGS, type Settings } from '@/application/dto/views'
import { DIFFICULTIES, DIFFICULTY_IDS, isDifficultyId } from '@/domain'
import { useServices } from './services'

const SETTINGS_KEY = 'settings'

export const useSettingsStore = defineStore('settings', () => {
    const { storage, sound } = useServices()
    const saved = storage.read<Partial<Settings>>(SETTINGS_KEY) ?? {}
    const settings = ref<Settings>({
        ...DEFAULT_SETTINGS,
        ...saved,
        // Ignore unknown values from older saves.
        difficulty: isDifficultyId(saved.difficulty)
            ? saved.difficulty
            : DEFAULT_SETTINGS.difficulty,
    })

    watch(settings, (value) => storage.write(SETTINGS_KEY, value), { deep: true })
    watch(
        () => settings.value.volume,
        (volume) => sound.setVolume(volume / 100),
        { immediate: true },
    )

    // Choices for the difficulty selector, in order of increasing challenge.
    const difficultyOptions = DIFFICULTY_IDS.map((id) => ({
        value: id,
        text: DIFFICULTIES[id].label,
    }))

    function reset() {
        settings.value = { ...DEFAULT_SETTINGS }
    }

    return { settings, difficultyOptions, reset }
})
