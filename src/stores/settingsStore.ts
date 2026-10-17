import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { DEFAULT_SETTINGS, type Settings } from '@/application/dto/views'
import { useServices } from './services'

const SETTINGS_KEY = 'settings'

export const useSettingsStore = defineStore('settings', () => {
    const { deviceStorage: storage, sound, music } = useServices()
    const saved = storage.read<Partial<Settings>>(SETTINGS_KEY) ?? {}
    // Take only known keys: older saves may carry removed settings (enemy speed, difficulty).
    const settings = ref<Settings>({
        brightness: saved.brightness ?? DEFAULT_SETTINGS.brightness,
        volume: saved.volume ?? DEFAULT_SETTINGS.volume,
        music: saved.music ?? DEFAULT_SETTINGS.music,
        crewScenes:
            typeof saved.crewScenes === 'boolean' ? saved.crewScenes : DEFAULT_SETTINGS.crewScenes,
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

    function reset() {
        settings.value = { ...DEFAULT_SETTINGS }
    }

    return { settings, reset }
})
