<script setup lang="ts">
    const { icon, label, count } = defineProps<{
        icon: string
        label: string
        count: number
    }>()
</script>

<template>
    <div class="personnel-count">
        <span class="personnel-count__icon">{{ icon }}</span>
        <span class="personnel-count__label">{{ label }}</span>
        <span class="personnel-count__value">{{ count }}</span>
    </div>
</template>

<style scoped lang="scss">
    .personnel-count {
        display: flex;
        align-items: center;
        margin: $spacing-xs 0;
        padding: $spacing-sm;
        background-color: rgba(255, 255, 255, 0.02);

        &__icon {
            margin-right: $spacing-sm;
            font-size: 20px;
        }

        &__label {
            flex-grow: 1;
            font-size: 14px;
        }

        &__value {
            min-width: 30px;
            font-size: 18px;
            font-weight: bold;
            text-align: right;
        }
    }
</style>
