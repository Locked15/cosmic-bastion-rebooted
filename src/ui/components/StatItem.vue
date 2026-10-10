<script setup lang="ts">
    const {
        label,
        value,
        emphasis = false,
    } = defineProps<{
        label: string
        value: string | number
        emphasis?: boolean
    }>()
</script>

<template>
    <div class="stat-item" :class="{ 'stat-item--emphasis': emphasis }">
        <span class="stat-item__label">{{ label }}</span>
        <span class="stat-item__value">{{ value }}</span>
        <slot />
    </div>
</template>

<style scoped lang="scss">
    .stat-item {
        display: flex;
        justify-content: space-between;
        gap: $spacing-sm;
        padding: $spacing-xs 0;
        border-bottom: 1px dotted $color-border;
        font-size: 12px;

        &:last-child {
            border-bottom: none;
        }

        &__label {
            color: $color-secondary;
        }

        &--emphasis &__value {
            font-size: 18px;
            font-weight: bold;
        }
    }
</style>
