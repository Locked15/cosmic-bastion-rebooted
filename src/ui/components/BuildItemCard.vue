<script setup lang="ts">
    const {
        name,
        description,
        cost,
        selected = false,
        affordable = true,
    } = defineProps<{
        name: string
        description: string
        cost: number
        selected?: boolean
        affordable?: boolean
    }>()

    defineEmits<{ select: [] }>()
</script>

<template>
    <button
        type="button"
        class="build-item"
        :class="{ 'build-item--selected': selected, 'build-item--unaffordable': !affordable }"
        @click="$emit('select')"
    >
        <span class="build-item__header">
            <span class="build-item__name">{{ name }}</span>
            <span class="build-item__cost">💎 {{ cost }}</span>
        </span>
        <span class="build-item__description">{{ description }}</span>
    </button>
</template>

<style scoped lang="scss">
    .build-item {
        display: block;
        width: 100%;
        padding: $spacing-sm;
        border: 1px solid $color-border;
        background-color: rgba(255, 255, 255, 0.02);
        color: $color-primary;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
            border-color: $color-primary;
            background-color: rgba(255, 255, 255, 0.05);
        }

        &--selected {
            border-color: $color-primary;
            background-color: rgba(255, 255, 255, 0.1);
            box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.2);
        }

        &--unaffordable {
            opacity: 0.5;
        }

        &__header {
            display: flex;
            justify-content: space-between;
            margin-bottom: $spacing-xs;
        }

        &__name {
            font-size: 14px;
            font-weight: bold;
        }

        &__cost {
            color: $color-accent;
            font-size: 12px;
        }

        &__description {
            display: block;
            color: $color-secondary;
            font-size: 11px;
            line-height: 1.4;
        }
    }
</style>
