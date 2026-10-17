<script setup lang="ts">
    const {
        text,
        completed = false,
        optional = false,
    } = defineProps<{
        text: string
        completed?: boolean
        // Optional objectives give a star; main ones decide whether the sector is held.
        optional?: boolean
    }>()
</script>

<template>
    <div
        class="objective-item"
        :class="{
            'objective-item--completed': completed,
            'objective-item--optional': optional,
        }"
    >
        {{ completed ? '✓' : '○' }} {{ text }}
        <span v-if="optional" class="objective-item__star" aria-label="даёт звезду">★</span>
        <slot />
    </div>
</template>

<style scoped lang="scss">
    .objective-item {
        margin: $spacing-sm 0;
        padding: $spacing-sm $spacing-sm $spacing-sm $spacing-md;
        border-left: 2px solid $color-accent;

        &--completed {
            border-left-color: $color-success;
            color: $color-success;
        }

        &--optional {
            border-left-style: dashed;
        }

        &__star {
            margin-left: $spacing-xs;
            color: $color-secondary;
            font-size: 11px;
        }
    }
</style>
