<script setup lang="ts">
    import type { LevelSummary } from '@/application/dto/views'
    import AppButton from '@/ui/components/AppButton.vue'
    import ObjectiveItem from '@/ui/components/ObjectiveItem.vue'
    import StatItem from '@/ui/components/StatItem.vue'

    const { level } = defineProps<{ level: LevelSummary | null }>()

    defineEmits<{ start: []; back: [] }>()
</script>

<template>
    <aside class="mission-info">
        <h3 class="mission-info__title">{{ level?.name ?? 'ВЫБЕРИТЕ СЕКТОР' }}</h3>
        <template v-if="level">
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
            <AppButton @click="$emit('start')">НАЧАТЬ ЗАЩИТУ</AppButton>
        </template>
        <AppButton variant="secondary" @click="$emit('back')">ОТМЕНА</AppButton>
    </aside>
</template>

<style scoped lang="scss">
    .mission-info {
        display: flex;
        flex-direction: column;
        padding: $spacing-lg;
        border: 2px solid $color-primary;

        &__title {
            margin-bottom: $spacing-md;
            padding-bottom: $spacing-sm;
            border-bottom: 1px solid $color-border;
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
