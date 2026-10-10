<script setup lang="ts">
    const { text, completed = false } = defineProps<{
        text: string
        completed?: boolean
    }>()
</script>

<template>
    <div class="objective-item" :class="{ 'objective-item--completed': completed }">
        {{ completed ? '✓' : '▸' }} {{ text }}
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
    }
</style>
