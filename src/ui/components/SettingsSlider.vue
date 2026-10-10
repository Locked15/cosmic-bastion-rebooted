<script setup lang="ts">
    const {
        label,
        min,
        max,
        suffix = '%',
    } = defineProps<{
        label: string
        min: number
        max: number
        suffix?: string
    }>()

    const model = defineModel<number>({ required: true })
</script>

<template>
    <div class="settings-slider">
        <label class="settings-slider__label">
            <span>{{ label }}</span>
            <span>{{ model }}{{ suffix }}</span>
        </label>
        <input
            v-model.number="model"
            class="settings-slider__input"
            type="range"
            :min="min"
            :max="max"
        />
    </div>
</template>

<style scoped lang="scss">
    @mixin thumb {
        width: 20px;
        height: 20px;
        border: 2px solid $color-bg;
        background: $color-primary;
        cursor: pointer;
    }

    .settings-slider {
        margin-bottom: $spacing-lg;

        &__label {
            display: flex;
            justify-content: space-between;
            margin-bottom: $spacing-sm;
            color: $color-accent;
            font-size: 14px;
        }

        &__input {
            width: 100%;
            height: 8px;
            border: 1px solid $color-primary;
            outline: none;
            background: $color-border;
            appearance: none;

            &::-webkit-slider-thumb {
                @include thumb;

                appearance: none;
            }

            &::-moz-range-thumb {
                @include thumb;
            }
        }
    }
</style>
