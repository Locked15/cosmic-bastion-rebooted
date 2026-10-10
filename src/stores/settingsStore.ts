import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { DEFAULT_SETTINGS, type Settings } from '@/application/dto/views'
import { useServices } from './services'

const SETTINGS_KEY = 'settings'

export const useSettingsStore = defineStore('settings', () => {
    const { storage } = useServices()
    const settings = ref<Settings>({ ...DEFAULT_SETTINGS, ...storage.read<Settings>(SETTINGS_KEY) })

    watch(settings, (value) => storage.write(SETTINGS_KEY, value), { deep: true })

    function reset() {
        settings.value = { ...DEFAULT_SETTINGS }
    }

    return { settings, reset }
})
