<script setup lang="ts">
    import { computed } from 'vue'
    import type { LevelSummary } from '@/application'

    const { levels, selectedId = null } = defineProps<{
        levels: LevelSummary[]
        selectedId?: string | null
    }>()

    const emit = defineEmits<{ select: [id: string] }>()

    // Hull, bulkheads and engines of the cruiser, top-down, bow to the right (viewBox units).
    const HULL = 'M40 36 L800 36 L920 110 L978 280 L920 450 L800 524 L40 524 L22 470 L22 90 Z'
    const LIVING = 'M60 112 L740 112 L820 160 L845 280 L820 400 L740 448 L60 448 Z'
    const CORE = 'M70 200 L720 200 L760 280 L720 360 L70 360 Z'
    const NOZZLES = [180, 280, 380].map(
        (y) => `M22 ${y - 28} L4 ${y - 38} L4 ${y + 38} L22 ${y + 28}`,
    )
    // Frame (шпангоут) numbers along the keel.
    const FRAMES = Array.from({ length: 11 }, (_, index) => ({ x: 40 + index * 76, n: index * 10 }))
    // Hull breach and the dust outside it: [x, y, radius].
    const SWARM: [number, number, number][] = [
        [600, 22, 2],
        [622, 14, 1.5],
        [648, 24, 2.5],
        [676, 12, 1.5],
        [702, 22, 2],
        [940, 196, 2],
        [956, 222, 1.5],
    ]

    const status = (level: LevelSummary) =>
        level.completed ? 'completed' : level.locked ? 'locked' : 'available'

    const byId = computed(() => new Map(levels.map((level) => [level.id, level])))

    // A conduit is open once the sector it leads from has been won.
    const links = computed(() =>
        levels.flatMap((level) =>
            level.routes.map((route) => ({
                key: `${route.from}-${level.id}`,
                points: route.points.map(([x, y]) => `${x},${y}`).join(' '),
                open: !!byId.value.get(route.from)?.completed,
            })),
        ),
    )

    function statusText(level: LevelSummary): string {
        if (level.completed) return `${'★'.repeat(level.stars)}${'☆'.repeat(3 - level.stars)}`
        return level.locked ? 'ЗАКРЫТ' : 'ДОСТУПЕН'
    }

    // Brackets drawn on the corners of the selected room.
    function brackets(level: LevelSummary): string[] {
        const { x, y, width: w, height: h } = level.map
        const s = 10
        const o = 5
        return [
            `M${x - o} ${y - o + s} V${y - o} H${x - o + s}`,
            `M${x + w + o - s} ${y - o} H${x + w + o} V${y - o + s}`,
            `M${x + w + o} ${y + h + o - s} V${y + h + o} H${x + w + o - s}`,
            `M${x - o + s} ${y + h + o} H${x - o} V${y + h + o - s}`,
        ]
    }

    function select(level: LevelSummary) {
        if (!level.locked) emit('select', level.id)
    }
</script>

<template>
    <figure class="deck-map">
        <svg
            class="deck-map__drawing"
            viewBox="0 0 1000 560"
            role="group"
            aria-label="Схема отсеков крейсера «Тяжесть Обета»"
        >
            <defs>
                <pattern
                    id="deck-map-hatch"
                    width="8"
                    height="8"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                >
                    <line class="deck-map__hatch" x1="0" y1="0" x2="0" y2="8" />
                </pattern>
                <marker
                    id="deck-map-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path class="deck-map__arrow" d="M0 0 L10 5 L0 10 Z" />
                </marker>
            </defs>

            <!-- Frame ruler along the keel. -->
            <g class="deck-map__ruler">
                <line x1="40" y1="548" x2="800" y2="548" />
                <g v-for="frame in FRAMES" :key="frame.n">
                    <line :x1="frame.x" y1="543" :x2="frame.x" y2="553" />
                    <text :x="frame.x" y="558">шп.{{ frame.n }}</text>
                </g>
            </g>

            <!-- Hull and ship layers. -->
            <path class="deck-map__hull" :d="HULL" />
            <path
                v-for="(nozzle, index) in NOZZLES"
                :key="index"
                class="deck-map__nozzle"
                :d="nozzle"
            />
            <path class="deck-map__bulkhead" :d="LIVING" />
            <path class="deck-map__bulkhead deck-map__bulkhead--core" :d="CORE" />
            <polyline
                class="deck-map__breach"
                points="596,36 606,46 618,38 630,50 642,40 656,48 664,36"
            />
            <circle
                v-for="([x, y, r], index) in SWARM"
                :key="`dust-${index}`"
                class="deck-map__dust"
                :cx="x"
                :cy="y"
                :r="r"
                :style="{ animationDelay: `${index * 0.4}s` }"
            />
            <text class="deck-map__layer" x="48" y="62">ВНЕШНИЙ СЛОЙ // ПОВРЕЖДЁН</text>
            <text class="deck-map__layer" x="78" y="140">ЖИЛОЙ СЛОЙ</text>
            <text class="deck-map__layer" x="86" y="350">ТЕХНИЧЕСКИЙ СЛОЙ</text>
            <text class="deck-map__layer deck-map__layer--bow" x="958" y="284">НОС</text>

            <!-- Conduits between sectors: which victory opens which sector. -->
            <polyline
                v-for="link in links"
                :key="link.key"
                class="deck-map__link"
                :class="{ 'deck-map__link--open': link.open }"
                :points="link.points"
                marker-end="url(#deck-map-arrow)"
            />

            <!-- Sectors (missions). -->
            <g
                v-for="level in levels"
                :key="level.id"
                class="deck-map__room"
                :class="[
                    `deck-map__room--${status(level)}`,
                    {
                        'deck-map__room--story': level.story,
                        'deck-map__room--finale': level.finale,
                        'deck-map__room--active': level.id === selectedId,
                    },
                ]"
                role="button"
                :tabindex="level.locked ? -1 : 0"
                :aria-label="`${level.code} ${level.sector}: ${level.name}`"
                :aria-disabled="level.locked"
                :aria-pressed="level.id === selectedId"
                @click="select(level)"
                @keydown.enter.prevent="select(level)"
                @keydown.space.prevent="select(level)"
            >
                <title>{{ level.name }}</title>
                <rect
                    class="deck-map__room-body"
                    :x="level.map.x"
                    :y="level.map.y"
                    :width="level.map.width"
                    :height="level.map.height"
                />
                <rect
                    v-if="level.finale"
                    class="deck-map__room-inner"
                    :x="level.map.x + 4"
                    :y="level.map.y + 4"
                    :width="level.map.width - 8"
                    :height="level.map.height - 8"
                />
                <rect
                    v-if="level.locked"
                    class="deck-map__room-hatch"
                    :x="level.map.x"
                    :y="level.map.y"
                    :width="level.map.width"
                    :height="level.map.height"
                />
                <text class="deck-map__code" :x="level.map.x + 10" :y="level.map.y + 19">
                    {{ level.code }}
                </text>
                <polygon
                    v-if="level.story"
                    class="deck-map__story"
                    :points="`${level.map.x + 58},${level.map.y + 8} ${level.map.x + 64},${level.map.y + 14} ${level.map.x + 58},${level.map.y + 20} ${level.map.x + 52},${level.map.y + 14}`"
                />
                <text class="deck-map__name" :x="level.map.x + 10" :y="level.map.y + 33">
                    {{ level.sector }}
                </text>
                <text
                    class="deck-map__status"
                    :x="level.map.x + 10"
                    :y="level.map.y + level.map.height - 9"
                >
                    {{ statusText(level) }}
                </text>
                <rect
                    v-for="pip in 5"
                    :key="pip"
                    class="deck-map__pip"
                    :class="{ 'deck-map__pip--on': pip <= level.threat }"
                    :x="level.map.x + level.map.width - 58 + pip * 9"
                    :y="level.map.y + level.map.height - 15"
                    width="6"
                    height="6"
                />
                <path
                    v-for="(bracket, index) in level.id === selectedId ? brackets(level) : []"
                    :key="`bracket-${index}`"
                    class="deck-map__bracket"
                    :d="bracket"
                />
            </g>
        </svg>
        <figcaption class="deck-map__legend">
            <span><i class="deck-map__key deck-map__key--available" />доступен</span>
            <span><i class="deck-map__key deck-map__key--completed" />пройден</span>
            <span><i class="deck-map__key deck-map__key--locked" />закрыт</span>
            <span>◆ сюжетный</span>
            <span>▪▪▪ угроза</span>
            <span>→ проход открывается победой</span>
        </figcaption>
    </figure>
</template>

<style scoped lang="scss">
    .deck-map {
        margin: 0;

        &__drawing {
            display: block;
            width: 100%;
            height: auto;
            font-family: $font-main;
        }

        &__hull {
            fill: rgba($color-primary, 0.02);
            stroke: $color-primary;
            stroke-width: 2;
        }

        &__nozzle {
            fill: none;
            stroke: $color-secondary;
            stroke-width: 1.5;
        }

        &__bulkhead {
            fill: none;
            stroke: $color-border;
            stroke-width: 1.5;
            stroke-dasharray: 6 4;

            &--core {
                fill: rgba($color-primary, 0.03);
                stroke: $color-secondary;
            }
        }

        &__breach {
            fill: none;
            stroke: $color-danger;
            stroke-width: 2;
        }

        &__dust {
            fill: $color-secondary;
            animation: deck-map-drift 3s ease-in-out infinite alternate;
        }

        &__layer {
            fill: $color-secondary;
            font-size: 10px;
            letter-spacing: 2px;

            &--bow {
                writing-mode: vertical-rl;
                text-anchor: middle;
            }
        }

        &__ruler {
            stroke: $color-border;
            fill: $color-secondary;
            font-size: 8px;
            text-anchor: middle;

            text {
                stroke: none;
            }
        }

        &__link {
            fill: none;
            stroke: $color-border;
            stroke-width: 2;
            stroke-dasharray: 4 4;

            &--open {
                stroke: $color-primary;
                stroke-dasharray: none;
            }
        }

        &__arrow {
            fill: $color-secondary;
        }

        &__hatch {
            stroke: rgba($color-border, 0.6);
            stroke-width: 2;
        }

        &__room {
            cursor: pointer;
            outline: none;

            &--locked {
                cursor: not-allowed;
                opacity: 0.55;
            }

            &:focus-visible .deck-map__room-body,
            &:hover:not(.deck-map__room--locked) .deck-map__room-body {
                fill: rgba($color-primary, 0.12);
            }
        }

        &__room-body {
            fill: $color-bg;
            stroke: $color-secondary;
            stroke-width: 2;
            transition: fill 0.2s;

            .deck-map__room--available & {
                stroke: $color-primary;
                animation: deck-map-pulse 2s ease-in-out infinite;
            }

            .deck-map__room--completed & {
                stroke: $color-success;
            }

            .deck-map__room--active & {
                stroke: $color-primary;
                stroke-width: 3;
                animation: none;
            }
        }

        &__room-inner {
            fill: none;
            stroke: $color-secondary;
            stroke-width: 1;
        }

        &__room-hatch {
            fill: url('#deck-map-hatch');
            pointer-events: none;
        }

        &__code {
            fill: $color-primary;
            font-size: 17px;
            font-weight: bold;
        }

        &__story {
            fill: $color-accent;
        }

        &__name {
            fill: $color-accent;
            font-size: 11px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        &__status {
            fill: $color-secondary;
            font-size: 11px;
            font-weight: bold;

            .deck-map__room--available & {
                fill: $color-primary;
            }

            .deck-map__room--completed & {
                fill: $color-success;
            }

            .deck-map__room--locked & {
                fill: $color-danger;
            }
        }

        &__pip {
            fill: none;
            stroke: $color-secondary;

            &--on {
                fill: $color-secondary;
            }
        }

        &__bracket {
            fill: none;
            stroke: $color-primary;
            stroke-width: 2;
        }

        &__legend {
            display: flex;
            flex-wrap: wrap;
            gap: $spacing-sm $spacing-md;
            margin-top: $spacing-sm;
            color: $color-secondary;
            font-size: 11px;

            span {
                display: inline-flex;
                align-items: center;
                gap: $spacing-xs;
            }
        }

        &__key {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid $color-secondary;

            &--available {
                border-color: $color-primary;
            }

            &--completed {
                border-color: $color-success;
            }

            &--locked {
                background: repeating-linear-gradient(
                    45deg,
                    $color-border 0 2px,
                    transparent 2px 5px
                );
            }
        }
    }

    @keyframes deck-map-pulse {
        50% {
            stroke-opacity: 0.45;
        }
    }

    @keyframes deck-map-drift {
        to {
            transform: translateY(6px);
        }
    }
</style>
