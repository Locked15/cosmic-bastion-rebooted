<script setup lang="ts">
    const { title, description, unlocked } = defineProps<{
        title: string
        description: string
        unlocked: boolean
    }>()
</script>

<template>
    <div class="achievement-item" :class="{ 'achievement-item--unlocked': unlocked }">
        <span class="achievement-item__icon">{{ unlocked ? '🏆' : '🔒' }}</span>
        <span class="achievement-item__body">
            <span class="achievement-item__title">{{ title }}</span>
            <span class="achievement-item__description">{{ description }}</span>
        </span>
    </div>
</template>

<style scoped lang="scss">
    .achievement-item {
        display: flex;
        gap: $spacing-md;
        align-items: center;
        margin: $spacing-sm 0;
        padding: $spacing-sm $spacing-md;
        border: 1px solid $color-border;
        opacity: 0.45;

        &--unlocked {
            border-color: $color-success;
            opacity: 1;
        }

        &__icon {
            font-size: 22px;
        }

        &__title {
            display: block;
            font-weight: bold;
        }

        &__description {
            display: block;
            color: $color-secondary;
            font-size: 12px;
        }
    }
</style>
