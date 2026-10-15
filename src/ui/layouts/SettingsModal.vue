<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { useProfileStore } from '@/stores/profileStore'
    import { useSettingsStore } from '@/stores/settingsStore'
    import { useUiStore } from '@/stores/uiStore'
    import AppButton from '@/ui/components/AppButton.vue'
    import SettingsSlider from '@/ui/components/SettingsSlider.vue'

    const settingsStore = useSettingsStore()
    const { settings } = storeToRefs(settingsStore)
    const ui = useUiStore()
    const profiles = useProfileStore()
</script>

<template>
    <div v-if="ui.settingsOpen" class="modal" @click.self="ui.closeSettings()">
        <div class="modal__box settings-modal">
            <h3 class="modal__title">// НАСТРОЙКИ //</h3>
            <SettingsSlider v-model="settings.brightness" label="ЯРКОСТЬ:" :min="50" :max="150" />
            <SettingsSlider v-model="settings.volume" label="ЗВУКИ:" :min="0" :max="100" />
            <SettingsSlider v-model="settings.music" label="МУЗЫКА:" :min="0" :max="100" />
            <div class="settings-modal__difficulty">
                <p class="settings-modal__rank">ЗВАНИЕ: {{ profiles.activeRank.label }}</p>
                <p class="settings-modal__description">{{ profiles.activeRank.description }}</p>
                <p
                    v-for="effect in profiles.activeRank.effects"
                    :key="effect"
                    class="settings-modal__effects"
                >
                    {{ effect }}
                </p>
                <p class="settings-modal__hint">
                    Звание закреплено в личном деле. Для другого звания заведите новое личное дело.
                </p>
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
            margin: 0 0 $spacing-lg;
            padding: $spacing-sm $spacing-md;
            border-left: 2px solid $color-accent;
        }

        &__rank {
            margin-bottom: $spacing-xs;
            color: $color-primary;
            font-size: 13px;
            letter-spacing: 2px;
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
            margin-top: $spacing-xs;
            color: $color-secondary;
            font-size: 11px;
        }
    }
</style>
