<script setup lang="ts">
    // A physical console key: travels down when pressed.
    const {
        label,
        hint = '',
        disabled = false,
    } = defineProps<{
        label: string
        hint?: string
        disabled?: boolean
    }>()

    defineEmits<{ press: [] }>()
</script>

<template>
    <button type="button" class="keycap" :disabled="disabled" @click="$emit('press')">
        <span class="keycap__top">
            <span class="keycap__label">{{ label }}</span>
            <span v-if="hint" class="keycap__hint">{{ hint }}</span>
        </span>
    </button>
</template>

<style scoped lang="scss">
    .keycap {
        padding: 0 0 6px;
        border: none;
        border-radius: 8px;
        // The key's skirt, visible below the top.
        background: linear-gradient($color-metal-dark, #0d0d0d);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.8);
        cursor: pointer;
        transition: padding 0.08s;

        &__top {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            min-width: 150px;
            padding: 12px 18px;
            border-radius: 7px;
            background: linear-gradient(#4a4a4a, #2a2a2a);
            box-shadow:
                inset 0 1px 0 rgba($color-metal-light, 0.35),
                inset 0 -2px 0 rgba(0, 0, 0, 0.4);
            color: $color-primary;
            transform: translateY(0);
            transition: transform 0.08s;
        }

        &__label {
            font-family: $font-main;
            font-size: 14px;
            font-weight: bold;
            letter-spacing: 3px;
        }

        &__hint {
            color: $color-secondary;
            font-family: $font-main;
            font-size: 10px;
            letter-spacing: 1px;
        }

        &:active:not(:disabled) &__top {
            transform: translateY(5px);
        }

        &:focus-visible {
            outline: 2px solid $color-primary;
            outline-offset: 3px;
        }

        &:disabled {
            cursor: not-allowed;
            opacity: 0.45;
        }
    }
</style>
