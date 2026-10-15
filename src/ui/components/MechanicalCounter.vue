<script setup lang="ts">
    import { computed } from 'vue'

    // A mechanical drum counter: each digit rolls to its place when the value changes.
    const {
        value,
        digits = 5,
        label = '',
    } = defineProps<{
        value: number
        digits?: number
        label?: string
    }>()

    const drums = computed(() =>
        String(Math.max(0, Math.floor(value)))
            .padStart(digits, '0')
            .slice(-digits)
            .split('')
            .map(Number),
    )
</script>

<template>
    <figure class="mechanical-counter" role="img" :aria-label="`${label} ${value}`">
        <div class="mechanical-counter__window">
            <div v-for="(digit, index) in drums" :key="index" class="mechanical-counter__drum">
                <div
                    class="mechanical-counter__strip"
                    :style="{ transform: `translateY(${-digit * 10}%)` }"
                >
                    <span v-for="n in 10" :key="n">{{ n - 1 }}</span>
                </div>
            </div>
        </div>
        <figcaption v-if="label" class="mechanical-counter__label">{{ label }}</figcaption>
    </figure>
</template>

<style scoped lang="scss">
    .mechanical-counter {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: $spacing-xs;
        margin: 0;

        &__window {
            display: flex;
            gap: 3px;
            padding: 6px;
            border: 2px solid $color-metal;
            border-radius: 4px;
            background: linear-gradient($color-metal-dark, #111 50%, $color-metal-dark);
            box-shadow:
                inset 0 2px 6px rgba(0, 0, 0, 0.9),
                0 1px 0 rgba($color-metal-light, 0.4);
        }

        &__drum {
            position: relative;
            width: 30px;
            height: 44px;
            overflow: hidden;
            border-radius: 2px;
            background: linear-gradient(#000, $color-metal-dark 50%, #000);

            // The curve of the drum: dark top and bottom, light middle.
            &::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(
                    rgba(0, 0, 0, 0.85),
                    transparent 35%,
                    transparent 65%,
                    rgba(0, 0, 0, 0.85)
                );
                pointer-events: none;
            }
        }

        &__strip {
            display: flex;
            flex-direction: column;
            height: 1000%;
            transition: transform 0.6s cubic-bezier(0.3, 1.4, 0.5, 1);

            span {
                display: flex;
                flex: none;
                align-items: center;
                justify-content: center;
                height: 10%;
                line-height: 1;
                color: $color-primary;
                font-size: 28px;
                text-shadow: 0 0 6px rgba($color-primary, 0.5);
                font-weight: bold;
            }
        }

        &__label {
            color: $color-metal-light;
            font-size: 10px;
            letter-spacing: 3px;
        }
    }
</style>
