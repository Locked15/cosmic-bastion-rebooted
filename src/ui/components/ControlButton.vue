<script setup lang="ts">
    type Tone = 'wave' | 'pause' | 'speed'

    const {
        icon,
        text,
        tone,
        active = false,
        disabled = false,
    } = defineProps<{
        icon: string
        text: string
        tone: Tone
        active?: boolean
        disabled?: boolean
    }>()

    defineEmits<{ click: [] }>()
</script>

<template>
    <button
        type="button"
        class="control-button"
        :class="[`control-button--${tone}`, { 'control-button--active': active }]"
        :disabled="disabled"
        @click="$emit('click')"
    >
        <span class="control-button__icon">{{ icon }}</span>
        <span class="control-button__text">{{ text }}</span>
    </button>
</template>

<style scoped lang="scss">
    .control-button {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 200px;
        padding: 12px 24px;
        border: 2px solid $color-primary;
        background-color: rgba(0, 0, 0, 0.9);
        color: $color-primary;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s;

        &:hover:not(:disabled) {
            background-color: $color-primary;
            color: $color-bg;
            transform: translateX(5px);
        }

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            animation: none;
        }

        &__icon {
            font-size: 20px;
        }

        &--wave {
            border-color: $color-success;
            color: $color-success;
            animation: wave-pulse 2s infinite;

            &:hover:not(:disabled) {
                background-color: $color-success;
            }
        }

        &--pause {
            border-color: $color-secondary;
            color: $color-secondary;

            &:hover:not(:disabled) {
                background-color: $color-secondary;
            }
        }

        &--pause#{&}--active {
            border-color: $color-success;
            color: $color-success;
        }

        &--speed#{&}--active {
            border-color: $color-accent;
            color: $color-accent;
            box-shadow: 0 0 18px rgba(0, 255, 255, 0.35);
        }

        @include below($breakpoint-compact) {
            min-width: 150px;
            padding: 10px 15px;
            font-size: 14px;
        }
    }

    @keyframes wave-pulse {
        0%,
        100% {
            box-shadow: 0 0 10px $color-success;
        }

        50% {
            box-shadow: 0 0 25px $color-success;
        }
    }
</style>
