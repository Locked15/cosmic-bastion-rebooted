<script setup lang="ts">
    const { title, percent } = defineProps<{
        title: string
        percent: number
    }>()
</script>

<template>
    <div class="conversion-item">
        <div class="conversion-item__header">
            <span>{{ title }}</span>
            <span>{{ Math.round(percent) }}%</span>
        </div>
        <div class="conversion-item__track">
            <div class="conversion-item__fill" :style="{ width: `${percent}%` }" />
        </div>
    </div>
</template>

<style scoped lang="scss">
    .conversion-item {
        margin: $spacing-sm 0;
        padding: $spacing-sm;
        border: 1px solid $color-border;
        background-color: rgba(255, 255, 255, 0.05);

        &__header {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
        }

        &__track {
            height: 8px;
            margin-top: $spacing-xs;
            overflow: hidden;
            border: 1px solid $color-primary;
        }

        &__fill {
            height: 100%;
            background-color: $color-primary;
            transition: width 0.1s linear;
        }
    }
</style>
