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
</script>

<template>
    <div v-if="ui.settingsOpen" class="modal" @click.self="ui.closeSettings()">
        <div class="modal__box settings-modal">
            <h3 class="modal__title">// НАСТРОЙКИ //</h3>
            <SettingsSlider v-model="settings.brightness" label="ЯРКОСТЬ:" :min="50" :max="150" />
            <SettingsSlider v-model="settings.volume" label="ЗВУКИ:" :min="0" :max="100" />
            <SettingsSlider v-model="settings.music" label="МУЗЫКА:" :min="0" :max="100" />
            <OptionGroup
                v-model="settings.difficulty"
                label="СЛОЖНОСТЬ:"
                :options="settingsStore.difficultyOptions"
            />
            <div class="settings-modal__difficulty">
                <p class="settings-modal__description">
                    {{ settingsStore.difficultyDetails.description }}
                </p>
                <p class="settings-modal__effects">{{ settingsStore.difficultyDetails.effects }}</p>
                <p class="settings-modal__hint">Применяется при запуске уровня.</p>
            </div>
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
        width: 560px;

        &__difficulty {
            margin: -$spacing-md 0 $spacing-lg;
            padding: $spacing-sm $spacing-md;
            border-left: 2px solid $color-accent;
        }

        &__description {
            color: $color-accent;
            font-size: 13px;
            line-height: 1.5;
        }

        &__effects {
            margin-top: $spacing-xs;
            color: $color-success;
            font-size: 11px;
        }

        &__hint {
            color: $color-secondary;
            font-size: 11px;
        }
    }
</style>
