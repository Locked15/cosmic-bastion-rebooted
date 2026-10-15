import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { DEFAULT_SETTINGS, type Settings } from '@/application/dto/views'
import { DIFFICULTIES, DIFFICULTY_IDS, isDifficultyId } from '@/domain'
import { useServices } from './services'

const SETTINGS_KEY = 'settings'

export const useSettingsStore = defineStore('settings', () => {
    const { deviceStorage: storage, sound, music } = useServices()
    const saved = storage.read<Partial<Settings>>(SETTINGS_KEY) ?? {}
    // Take only known keys: older saves may carry removed settings (e.g. enemy speed).
    const settings = ref<Settings>({
        brightness: saved.brightness ?? DEFAULT_SETTINGS.brightness,
        volume: saved.volume ?? DEFAULT_SETTINGS.volume,
        music: saved.music ?? DEFAULT_SETTINGS.music,
        difficulty: isDifficultyId(saved.difficulty)
            ? saved.difficulty
            : DEFAULT_SETTINGS.difficulty,
        crewScenes:
            typeof saved.crewScenes === 'boolean' ? saved.crewScenes : DEFAULT_SETTINGS.crewScenes,
        romance: typeof saved.romance === 'boolean' ? saved.romance : DEFAULT_SETTINGS.romance,
    })

    watch(settings, (value) => storage.write(SETTINGS_KEY, value), { deep: true })
    watch(
        () => settings.value.volume,
        (volume) => sound.setVolume(volume / 100),
        { immediate: true },
    )
    watch(
        () => settings.value.music,
        (volume) => music.setVolume(volume / 100),
        { immediate: true },
    )

    // Choices for the difficulty selector, in order of increasing challenge.
    const difficultyOptions = DIFFICULTY_IDS.map((id) => ({
        value: id,
        text: DIFFICULTIES[id].label,
    }))

    // Description and effects of the selected difficulty, derived from the rules.
    const difficultyDetails = computed(() => {
        const difficulty = DIFFICULTIES[settings.value.difficulty]
        return {
            description: difficulty.description,
            effects: `Здоровье врагов ×${difficulty.health} · Скорость ×${difficulty.speed} · Прорывов до поражения: ${difficulty.maxBreakthroughs}`,
        }
    })

    function reset() {
        settings.value = { ...DEFAULT_SETTINGS }
    }

    return { settings, difficultyOptions, difficultyDetails, reset }
})
