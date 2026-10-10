<script setup lang="ts">
    import type { LevelSummary } from '@/application/dto/views'
    import AppButton from '@/ui/components/AppButton.vue'
    import ObjectiveItem from '@/ui/components/ObjectiveItem.vue'
    import StatItem from '@/ui/components/StatItem.vue'

    const { level, savedWave = null } = defineProps<{
        level: LevelSummary | null
        // Wave the level can be resumed after, if a checkpoint exists.
        savedWave?: number | null
    }>()

    defineEmits<{ start: [resume: boolean]; back: [] }>()
</script>

<template>
    <aside class="mission-info">
        <h3 class="mission-info__title">{{ level?.name ?? 'ВЫБЕРИТЕ СЕКТОР' }}</h3>
        <div v-if="level" class="mission-info__details">
            <p class="mission-info__sector">{{ level.sector }}</p>
            <p v-if="level.prerequisites.length" class="mission-info__requirements">
                Доступ после: {{ level.prerequisites.join(' и ') }}
            </p>
            <p class="mission-info__description">{{ level.description }}</p>
            <div class="mission-info__objectives">
                <h4>ЗАДАЧИ:</h4>
                <ObjectiveItem
                    v-for="objective in level.objectives"
                    :key="objective"
                    :text="objective"
                />
                <div class="mission-info__start">
                    <StatItem label="⚒ Шахтёры" :value="level.startingMiners" />
                    <StatItem label="⚔ Военные" :value="level.startingMilitary" />
                    <StatItem label="💎 Ресурсы" :value="level.startingResources" />
                    <StatItem label="🌊 Волн" :value="level.totalWaves" />
                </div>
            </div>
        </div>
        <!-- Actions stay visible however long the details are. -->
        <div class="mission-info__actions">
            <AppButton
                v-if="level && savedWave !== null && !level.locked"
                @click="$emit('start', true)"
            >
                ПРОДОЛЖИТЬ (ПОСЛЕ ВОЛНЫ {{ savedWave }})
            </AppButton>
            <AppButton v-if="level" :disabled="level.locked" @click="$emit('start', false)">
                {{ savedWave !== null ? 'НАЧАТЬ ЗАНОВО' : 'НАЧАТЬ ЗАЩИТУ' }}
            </AppButton>
            <AppButton variant="secondary" @click="$emit('back')">ОТМЕНА</AppButton>
        </div>
    </aside>
</template>

<style scoped lang="scss">
    .mission-info {
        display: flex;
        flex-direction: column;
        min-height: 0;
        padding: $spacing-lg;
        border: 2px solid $color-primary;

        &__details {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
        }

        &__actions {
            flex: none;
            padding-top: $spacing-sm;
            border-top: 1px solid $color-border;
        }

        &__title {
            margin-bottom: $spacing-md;
            padding-bottom: $spacing-sm;
            border-bottom: 1px solid $color-border;
        }

        &__sector,
        &__requirements,
        &__story {
            margin-bottom: $spacing-md;
            font-size: 12px;
        }

        &__story {
            padding: $spacing-sm;
            border-left: 2px solid $color-success;
        }

        &__description {
            margin-bottom: $spacing-md;
            color: $color-secondary;
            font-size: 14px;
        }

        &__objectives {
            flex-grow: 1;
            margin: $spacing-md 0;
            padding: $spacing-md;
            border: 1px solid $color-border;
        }

        &__start {
            margin-top: 20px;
            padding: $spacing-sm;
            border-left: 2px solid $color-secondary;
        }
    }
</style>
