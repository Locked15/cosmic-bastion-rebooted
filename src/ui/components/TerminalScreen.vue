<script setup lang="ts">
    // A CRT screen set into the console housing: scanlines, glow and a curved-glass vignette.
    const { title = '' } = defineProps<{ title?: string }>()
</script>

<template>
    <div class="terminal-screen">
        <div class="terminal-screen__glass">
            <p v-if="title" class="terminal-screen__title">{{ title }}</p>
            <div class="terminal-screen__content">
                <slot />
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
    .terminal-screen {
        padding: 14px;
        border-radius: 18px;
        // Bezel: dark plastic with a lit upper edge.
        background: linear-gradient(#1c1c1c, #080808);
        box-shadow:
            inset 0 1px 0 rgba($color-metal-light, 0.25),
            inset 0 -2px 6px rgba(0, 0, 0, 0.9),
            0 0 0 2px $color-metal-dark;

        &__glass {
            position: relative;
            min-height: 280px;
            padding: $spacing-md $spacing-lg;
            overflow: hidden;
            border-radius: 12px / 16px;
            background: radial-gradient(ellipse at center, #111 0%, $color-screen 75%);
            box-shadow:
                inset 0 0 40px rgba(0, 0, 0, 0.95),
                inset 0 0 4px rgba($color-primary, 0.15);
            color: $color-primary;
            text-shadow: 0 0 4px rgba($color-primary, 0.55);

            // Scanlines and a soft flicker over everything on the screen.
            &::after {
                content: '';
                position: absolute;
                inset: 0;
                background: repeating-linear-gradient(
                    transparent 0 2px,
                    rgba(0, 0, 0, 0.28) 2px 3px
                );
                pointer-events: none;
                animation: terminal-flicker 4s infinite;
            }
        }

        &__title {
            margin-bottom: $spacing-sm;
            padding-bottom: $spacing-xs;
            border-bottom: 1px solid rgba($color-primary, 0.4);
            font-size: 12px;
            letter-spacing: 2px;
        }

        &__content {
            position: relative;
            z-index: 0;
        }
    }

    @keyframes terminal-flicker {
        0%,
        96%,
        100% {
            opacity: 1;
        }

        97% {
            opacity: 0.85;
        }
    }
</style>
