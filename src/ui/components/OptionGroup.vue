<script setup lang="ts" generic="T extends string | number">
    const { label, options } = defineProps<{
        label: string
        options: { value: T; text: string }[]
    }>()

    const model = defineModel<T>({ required: true })
</script>

<template>
    <div class="option-group">
        <div class="option-group__label">{{ label }}</div>
        <div class="option-group__buttons">
            <button
                v-for="option in options"
                :key="option.value"
                type="button"
                class="option-group__button"
                :class="{ 'option-group__button--active': option.value === model }"
                @click="model = option.value"
            >
                {{ option.text }}
            </button>
        </div>
    </div>
</template>

<style scoped lang="scss">
    .option-group {
        margin-bottom: $spacing-lg;

        &__label {
            margin-bottom: $spacing-sm;
            color: $color-accent;
            font-size: 14px;
        }

        &__buttons {
            display: flex;
            gap: $spacing-sm;
        }

        &__button {
            flex: 1;
            padding: $spacing-sm;
            border: 1px solid $color-border;
            background-color: transparent;
            color: $color-secondary;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;

            &:hover {
                border-color: $color-primary;
                color: $color-primary;
            }

            &--active {
                border-color: $color-primary;
                background-color: $color-primary;
                color: $color-bg;

                &:hover {
                    color: $color-bg;
                }
            }
        }
    }
</style>
