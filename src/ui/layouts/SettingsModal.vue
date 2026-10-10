<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { useSettingsStore } from '@/stores/settingsStore'
    import { useUiStore } from '@/stores/uiStore'
    import AppButton from '@/ui/components/AppButton.vue'
    import OptionGroup from '@/ui/components/OptionGroup.vue'
    import SettingsSlider from '@/ui/components/SettingsSlider.vue'

    const settingsStore = useSettingsStore()
    const { settings } = storeToRefs(settingsStore)
    const ui = useUiStore()

    const speedOptions = [
        { value: 0.7, text: 'МЕДЛЕННО' },
        { value: 1, text: 'НОРМАЛЬНО' },
        { value: 1.3, text: 'БЫСТРО' },
    ]
</script>

<template>
    <div v-if="ui.settingsOpen" class="modal" @click.self="ui.closeSettings()">
        <div class="modal__box settings-modal">
            <h3 class="modal__title">// НАСТРОЙКИ //</h3>
            <SettingsSlider v-model="settings.brightness" label="ЯРКОСТЬ:" :min="50" :max="150" />
            <SettingsSlider v-model="settings.volume" label="ГРОМКОСТЬ:" :min="0" :max="100" />
            <OptionGroup
                v-model="settings.enemySpeed"
                label="СКОРОСТЬ ВРАГОВ:"
                :options="speedOptions"
            />
            <div class="modal__footer">
                <AppButton variant="secondary" @click="settingsStore.reset()">
                    СБРОСИТЬ НАСТРОЙКИ
                </AppButton>
                <AppButton @click="ui.closeSettings()">ПРИМЕНИТЬ</AppButton>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
    .settings-modal {
        width: 500px;
    }
</style>
