<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { computed } from 'vue'
    import { useProfileStore } from '@/stores/profileStore'
    import { useSettingsStore } from '@/stores/settingsStore'
    import { useUiStore } from '@/stores/uiStore'
    import AppButton from '@/ui/components/AppButton.vue'
    import OptionGroup from '@/ui/components/OptionGroup.vue'
    import SettingsSlider from '@/ui/components/SettingsSlider.vue'

    const settingsStore = useSettingsStore()
    const { settings } = storeToRefs(settingsStore)
    const ui = useUiStore()

    // Optional story content: on/off switches shown as option buttons.
    const toggleOptions: { value: 'on' | 'off'; text: string }[] = [
        { value: 'on', text: 'ВКЛ' },
        { value: 'off', text: 'ВЫКЛ' },
    ]
    function toggle(key: 'crewScenes' | 'romance') {
        return computed({
            get: () => (settings.value[key] ? 'on' : 'off'),
            set: (value: 'on' | 'off') => (settings.value[key] = value === 'on'),
        })
    }
    const crewScenes = toggle('crewScenes')
    const romance = toggle('romance')
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
            <OptionGroup v-model="crewScenes" label="СЦЕНЫ С ЭКИПАЖЕМ:" :options="toggleOptions" />
            <OptionGroup
                v-if="settings.crewScenes"
                v-model="romance"
                label="РОМАНТИЧЕСКИЕ ЛИНИИ:"
                :options="toggleOptions"
            />
            <p class="settings-modal__hint settings-modal__story">
                Разговоры между миссиями необязательны: любую сцену можно пропустить.
            </p>
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

        &__story {
            margin: -$spacing-md 0 $spacing-lg;
        }
    }
</style>
