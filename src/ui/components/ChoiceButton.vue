<script setup lang="ts">
    const {
        text,
        hint = '',
        disabled = false,
    } = defineProps<{
        text: string
        hint?: string
        disabled?: boolean
    }>()

    defineEmits<{ choose: [] }>()
</script>

<template>
    <button type="button" class="choice-button" :disabled="disabled" @click="$emit('choose')">
        <span class="choice-button__text">{{ text }}</span>
        <span v-if="hint" class="choice-button__hint">{{ hint }}</span>
    </button>
</template>

<style scoped lang="scss">
    .choice-button {
        display: block;
        width: 100%;
        padding: $spacing-md;
        border: 2px solid $color-primary;
        background-color: transparent;
        color: $color-primary;
        font-size: 14px;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s;

        &:hover:not(:disabled) {
            background-color: $color-primary;
            color: $color-bg;
        }

        &:disabled {
            opacity: 0.35;
            cursor: not-allowed;
        }

        &__hint {
            display: block;
            margin-top: $spacing-xs;
            font-size: 11px;
            opacity: 0.7;
        }
    }
</style>
