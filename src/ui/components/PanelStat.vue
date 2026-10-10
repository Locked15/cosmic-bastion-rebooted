<script setup lang="ts">
    const {
        label,
        value,
        rate = '',
        framed = false,
    } = defineProps<{
        label: string
        value: string | number
        rate?: string
        framed?: boolean
    }>()
</script>

<template>
    <div class="panel-stat" :class="{ 'panel-stat--framed': framed }">
        <span class="panel-stat__label">{{ label }}</span>
        <span class="panel-stat__value">{{ value }}</span>
        <span v-if="rate" class="panel-stat__rate">{{ rate }}</span>
    </div>
</template>

<style scoped lang="scss">
    .panel-stat {
        display: flex;
        align-items: center;
        gap: $spacing-sm;

        &--framed {
            padding: $spacing-sm $spacing-md;
            border: 1px solid $color-border;
        }

        &__label {
            color: $color-secondary;
            font-size: 12px;
        }

        &__value {
            font-size: 18px;
            font-weight: bold;

            @include below($breakpoint-compact) {
                font-size: 13px;
            }
        }

        &__rate {
            color: $color-success;
            font-size: 12px;
        }
    }
</style>
