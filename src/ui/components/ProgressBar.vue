<script setup lang="ts">
    import { computed } from 'vue'

    type Tone = 'success' | 'warning' | 'danger' | 'primary'

    const {
        percent,
        label = '',
        tone = 'success',
    } = defineProps<{
        percent: number
        label?: string
        tone?: Tone
    }>()

    const width = computed(() => `${Math.max(0, Math.min(100, percent))}%`)
</script>

<template>
    <div class="progress-bar">
        <div v-if="label" class="progress-bar__label">{{ label }}</div>
        <div class="progress-bar__track">
            <div
                class="progress-bar__fill"
                :class="`progress-bar__fill--${tone}`"
                :style="{ width }"
            />
        </div>
    </div>
</template>

<style scoped lang="scss">
    .progress-bar {
        margin-top: $spacing-sm;

        &__label {
            margin-bottom: $spacing-xs;
            color: $color-secondary;
            font-size: 11px;
        }

        &__track {
            height: 8px;
            overflow: hidden;
            border: 1px solid $color-border;
            background-color: #333333;
        }

        &__fill {
            height: 100%;
            transition: width 0.1s linear;

            &--success {
                background-color: $color-success;
            }

            &--warning {
                background-color: $color-warning;
            }

            &--danger {
                background-color: $color-danger;
            }

            &--primary {
                background-color: $color-primary;
            }
        }
    }
</style>
