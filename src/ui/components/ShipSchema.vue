<script setup lang="ts">
    // Swarm particles drifting toward the hull: [x, y, delay in s].
    const swarm: [number, number, number][] = [
        [40, 268, 0],
        [90, 274, 1.2],
        [150, 270, 2.1],
        [470, 272, 0.6],
        [520, 266, 1.8],
        [560, 276, 2.7],
    ]
</script>

<template>
    <div class="ship-schema">
        <svg
            class="ship-schema__drawing"
            viewBox="0 0 600 300"
            role="img"
            aria-label="Схема крейсера"
        >
            <!-- Hostile planet: jagged ridge and ground grid. -->
            <polyline
                class="ship-schema__ridge"
                points="0,230 40,205 70,220 110,180 150,215 190,195 230,225 600,225 600,230"
            />
            <polyline
                class="ship-schema__ridge ship-schema__ridge--far"
                points="380,225 420,170 460,200 500,160 540,205 600,185"
            />
            <line
                v-for="x in 12"
                :key="`ground-${x}`"
                class="ship-schema__ground"
                :x1="x * 50 - 25"
                y1="300"
                :x2="300 + (x * 50 - 325) * 0.4"
                y2="232"
            />

            <!-- The crashed cruiser, tilted into the ground. -->
            <g class="ship-schema__ship" transform="rotate(-4 300 200)">
                <path
                    class="ship-schema__hull"
                    d="M60 230 L110 150 L470 140 L560 170 L575 205 L520 238 L95 245 Z"
                />
                <path
                    class="ship-schema__deck"
                    d="M105 165 L470 156 M100 195 L560 190 M98 222 L540 220"
                />
                <text class="ship-schema__label ship-schema__label--outer" x="300" y="162">
                    ВНЕШНИЙ СЛОЙ [ПОВРЕЖДЁН]
                </text>
                <text class="ship-schema__label" x="300" y="186">ЖИЛОЙ СЛОЙ</text>
                <text class="ship-schema__label" x="300" y="212">ТЕХНИЧЕСКИЙ СЛОЙ</text>
                <path class="ship-schema__engine" d="M60 230 L35 222 L40 248 L95 245" />
                <circle class="ship-schema__damage" cx="180" cy="152" r="6" />
                <circle
                    class="ship-schema__damage ship-schema__damage--late"
                    cx="410"
                    cy="146"
                    r="5"
                />
                <circle class="ship-schema__damage" cx="545" cy="180" r="4" />
            </g>

            <circle
                v-for="[x, y, delay] in swarm"
                :key="`${x}-${y}`"
                class="ship-schema__particle"
                :cx="x"
                :cy="y"
                r="2.5"
                :style="{ animationDelay: `${delay}s` }"
            />

            <line class="ship-schema__scan" x1="0" y1="0" x2="0" y2="300" />
        </svg>
        <div class="ship-schema__caption">
            <div>
                <div>
                    <strong>БАСТИОН «ТЯЖЕСТЬ ОБЕТА»</strong>
                </div>
                <div>СТ-БЛК·IV-0417 «ТО» / У-12 / 91,4 Мт / КП-41</div>
            </div>
            <div>
                МАССА 91,4 Мт · ДЛИНА 11 КМ · ШТАТНАЯ ЧИСЛЕННОСТЬ 40К
            </div>
            <div style="color: red">
                СТАТУС: АВАРИЙНАЯ ПОСАДКА · 92,5% ЭКИПАЖА ПОТЕРЯНО · ПОВРЕЖДЕНИЯ 87%
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
    .ship-schema {
        margin-bottom: $spacing-lg;
        padding: $spacing-md;
        border: 1px solid $color-border;

        &__drawing {
            display: block;
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            overflow: hidden;
        }

        &__ridge {
            fill: none;
            stroke: $color-secondary;
            stroke-width: 1.5;

            &--far {
                stroke: $color-border;
                stroke-dasharray: 4 3;
            }
        }

        &__ground {
            stroke: $color-border;
            stroke-width: 0.6;
        }

        &__ship {
            animation: ship-pulse 3s ease-in-out infinite;
        }

        &__hull {
            // Opaque so the ridge behind does not show through the hull.
            fill: $color-bg;
            stroke: $color-primary;
            stroke-width: 2;
        }

        &__deck,
        &__engine {
            fill: none;
            stroke: $color-secondary;
            stroke-dasharray: 6 4;
        }

        &__label {
            fill: $color-accent;
            font-family: $font-main;
            font-size: 10px;
            letter-spacing: 1px;
            text-anchor: middle;

            &--outer {
                fill: $color-danger;
            }
        }

        &__damage {
            fill: none;
            stroke: $color-danger;
            stroke-width: 1.5;
            animation: damage-flicker 1.6s steps(2) infinite;

            &--late {
                animation-delay: 0.8s;
            }
        }

        &__particle {
            fill: $color-secondary;
            animation: swarm-drift 4s linear infinite;
        }

        &__scan {
            stroke: $color-success;
            stroke-width: 1;
            opacity: 0.5;
            animation: scan 6s linear infinite;
        }

        &__caption {
            margin-top: $spacing-sm;
            color: $color-secondary;
            font-size: 10px;
            letter-spacing: 2px;
        }
    }

    @keyframes ship-pulse {
        0%,
        100% {
            opacity: 0.75;
        }

        50% {
            opacity: 1;
        }
    }

    @keyframes damage-flicker {
        50% {
            opacity: 0.2;
        }
    }

    @keyframes swarm-drift {
        from {
            opacity: 0;
            transform: translate(0, 0);
        }

        30% {
            opacity: 1;
        }

        to {
            opacity: 0;
            transform: translate(40px, -35px);
        }
    }

    @keyframes scan {
        from {
            transform: translateX(0);
        }

        to {
            transform: translateX(600px);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .ship-schema__ship,
        .ship-schema__damage,
        .ship-schema__particle,
        .ship-schema__scan {
            animation: none;
        }
    }
</style>
