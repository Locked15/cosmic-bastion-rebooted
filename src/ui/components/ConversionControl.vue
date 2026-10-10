<script setup lang="ts">
    import { ref } from 'vue'

    const { label, max } = defineProps<{
        label: string
        max: number
    }>()

    const emit = defineEmits<{ convert: [count: number] }>()

    const count = ref(1)

    function submit() {
        const value = Math.floor(count.value)
        if (value > 0) {
            emit('convert', Math.min(value, max))
        }
    }
</script>

<template>
    <div class="conversion-control">
        <label class="conversion-control__label">{{ label }}</label>
        <div class="conversion-control__row">
            <input
                v-model.number="count"
                class="conversion-control__input"
                type="number"
                min="1"
                max="99"
                @keydown.enter="submit"
            />
            <button type="button" class="button button--small" :disabled="max < 1" @click="submit">
                ПЕРЕВЕСТИ
            </button>
        </div>
    </div>
</template>

<style scoped lang="scss">
    .conversion-control {
        margin-top: $spacing-sm;

        &__label {
            color: $color-secondary;
            font-size: 11px;
        }

        &__row {
            display: flex;
            gap: $spacing-xs;
            margin-top: $spacing-xs;
        }

        &__input {
            width: 60px;
            padding: 6px;
            border: 1px solid $color-border;
            background-color: rgba(0, 0, 0, 0.5);
            color: $color-primary;
            font-size: 14px;
            text-align: center;

            &:focus {
                border-color: $color-primary;
                outline: none;
            }
        }
    }
</style>
