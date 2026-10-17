<script setup lang="ts">
    import type { CrewDeckView, CrewMemberView } from '@/application'

    // The officers' deck around the wardroom: one cabin per character, the common room in the
    // middle (viewBox units; cabin and wardroom outlines come from content/cast.json).
    const { deck, selectedId = null } = defineProps<{
        deck: CrewDeckView
        selectedId?: string | null
    }>()

    const emit = defineEmits<{ select: [id: string]; table: [] }>()

    const PIPS = 10
    // The corridor between the two rows of cabins.
    const CORRIDOR = { y1: 190, y2: 430 }

    const pending = () => deck.members.reduce((sum, member) => sum + member.pendingScenes, 0)

    // The surname on the door plate; the full name is in the dossier.
    const surname = (member: CrewMemberView) => member.name.split(' ').slice(-1)[0]!

    // Monospace text is about 7.4 units per character at 11px: squeeze what does not fit.
    function fit(text: string, width: number, perChar = 7.4) {
        return text.length * perChar > width
            ? { textLength: width, lengthAdjust: 'spacingAndGlyphs' }
            : {}
    }

    function hearts(member: CrewMemberView): string {
        const value = Math.max(0, Math.min(PIPS, member.affection ?? 0))
        return '♥'.repeat(value) + '·'.repeat(PIPS - value)
    }

    // A short passage from the cabin door to the corridor.
    function door(member: CrewMemberView): string {
        const { x, y, width, height } = member.cabin.map
        const cx = x + width / 2
        return y + height <= CORRIDOR.y1
            ? `M${cx} ${y + height} V${CORRIDOR.y1}`
            : `M${cx} ${y} V${CORRIDOR.y2}`
    }

    const tone = (member: CrewMemberView) =>
        member.disposition > 0 ? 'good' : member.disposition < 0 ? 'bad' : 'neutral'
</script>

<template>
    <figure class="crew-deck">
        <svg
            class="crew-deck__drawing"
            viewBox="0 0 1000 620"
            role="group"
            aria-label="Схема офицерской палубы: каюты экипажа и кают-компания"
        >
            <defs>
                <pattern
                    id="crew-deck-hatch"
                    width="8"
                    height="8"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                >
                    <line class="crew-deck__hatch" x1="0" y1="0" x2="0" y2="8" />
                </pattern>
            </defs>

            <rect class="crew-deck__outline" x="20" y="20" width="960" height="580" />
            <text class="crew-deck__label" x="30" y="14">ЖИЛОЙ СЛОЙ // ОФИЦЕРСКАЯ ПАЛУБА</text>
            <line
                class="crew-deck__corridor"
                x1="30"
                :y1="CORRIDOR.y1"
                x2="970"
                :y2="CORRIDOR.y1"
            />
            <line
                class="crew-deck__corridor"
                x1="30"
                :y1="CORRIDOR.y2"
                x2="970"
                :y2="CORRIDOR.y2"
            />
            <text class="crew-deck__label" x="40" y="214">КОРИДОР</text>
            <path
                v-for="member in deck.members"
                :key="`door-${member.id}`"
                class="crew-deck__door"
                :d="door(member)"
            />

            <!-- The common room: plays every waiting conversation. -->
            <g
                class="crew-deck__room crew-deck__room--wardroom"
                :class="{ 'crew-deck__room--alert': pending() > 0 }"
                role="button"
                tabindex="0"
                :aria-label="`${deck.wardroom.code} ${deck.wardroom.name}: общий стол`"
                @click="emit('table')"
                @keydown.enter.prevent="emit('table')"
                @keydown.space.prevent="emit('table')"
            >
                <rect
                    class="crew-deck__body"
                    :x="deck.wardroom.map.x"
                    :y="deck.wardroom.map.y"
                    :width="deck.wardroom.map.width"
                    :height="deck.wardroom.map.height"
                />
                <ellipse
                    class="crew-deck__table"
                    :cx="deck.wardroom.map.x + deck.wardroom.map.width / 2"
                    :cy="deck.wardroom.map.y + deck.wardroom.map.height / 2 + 10"
                    :rx="deck.wardroom.map.width / 4"
                    :ry="deck.wardroom.map.height / 5"
                />
                <text
                    class="crew-deck__code"
                    :x="deck.wardroom.map.x + 12"
                    :y="deck.wardroom.map.y + 24"
                >
                    {{ deck.wardroom.code }}
                </text>
                <text
                    class="crew-deck__name"
                    :x="deck.wardroom.map.x + 84"
                    :y="deck.wardroom.map.y + 24"
                >
                    {{ deck.wardroom.name }}
                </text>
                <text
                    class="crew-deck__status"
                    :x="deck.wardroom.map.x + deck.wardroom.map.width / 2"
                    :y="deck.wardroom.map.y + deck.wardroom.map.height / 2 + 14"
                    text-anchor="middle"
                >
                    {{ pending() ? `ОБЩИЙ СТОЛ · РАЗГОВОРОВ: ${pending()}` : 'ОБЩИЙ СТОЛ' }}
                </text>
            </g>

            <!-- Cabins. -->
            <g
                v-for="member in deck.members"
                :key="member.id"
                class="crew-deck__room"
                :class="{
                    'crew-deck__room--absent': !member.present,
                    'crew-deck__room--alert': member.present && member.pendingScenes > 0,
                    'crew-deck__room--active': member.id === selectedId,
                    'crew-deck__room--partner': member.partner,
                }"
                role="button"
                tabindex="0"
                :aria-label="`${member.cabin.code} ${member.name}${member.present ? '' : ': нет на связи'}`"
                :aria-pressed="member.id === selectedId"
                @click="emit('select', member.id)"
                @keydown.enter.prevent="emit('select', member.id)"
                @keydown.space.prevent="emit('select', member.id)"
            >
                <rect
                    class="crew-deck__body"
                    :x="member.cabin.map.x"
                    :y="member.cabin.map.y"
                    :width="member.cabin.map.width"
                    :height="member.cabin.map.height"
                />
                <rect
                    v-if="!member.present"
                    class="crew-deck__seal"
                    :x="member.cabin.map.x"
                    :y="member.cabin.map.y"
                    :width="member.cabin.map.width"
                    :height="member.cabin.map.height"
                />
                <text
                    class="crew-deck__code"
                    :x="member.cabin.map.x + 10"
                    :y="member.cabin.map.y + 22"
                >
                    {{ member.cabin.code }}
                </text>
                <text
                    v-if="member.present && member.pendingScenes"
                    class="crew-deck__badge"
                    :x="member.cabin.map.x + member.cabin.map.width - 10"
                    :y="member.cabin.map.y + 22"
                    text-anchor="end"
                >
                    ● {{ member.pendingScenes }}
                </text>
                <text
                    class="crew-deck__name"
                    :x="member.cabin.map.x + 10"
                    :y="member.cabin.map.y + 46"
                    v-bind="fit(surname(member), member.cabin.map.width - 20, 8.4)"
                >
                    {{ surname(member) }}
                </text>
                <text
                    class="crew-deck__role"
                    :x="member.cabin.map.x + 10"
                    :y="member.cabin.map.y + 64"
                    v-bind="fit(member.role, member.cabin.map.width - 20, 6.2)"
                >
                    {{ member.role }}
                </text>
                <text
                    class="crew-deck__status"
                    :class="`crew-deck__status--${member.present ? tone(member) : 'absent'}`"
                    :x="member.cabin.map.x + 10"
                    :y="member.cabin.map.y + 94"
                >
                    {{ member.present ? member.standing : 'НЕТ НА СВЯЗИ' }}
                </text>
                <text
                    v-if="member.present && member.affection !== null"
                    class="crew-deck__hearts"
                    :x="member.cabin.map.x + 10"
                    :y="member.cabin.map.y + 116"
                >
                    {{ hearts(member) }}
                </text>
            </g>
        </svg>
        <figcaption class="crew-deck__legend">
            <span>● ждёт разговора</span>
            <span><i class="crew-deck__key crew-deck__key--sealed" />нет на связи</span>
            <span>Общий стол — все разговоры по очереди</span>
        </figcaption>
    </figure>
</template>

<style scoped lang="scss">
    .crew-deck {
        margin: 0;

        &__drawing {
            display: block;
            width: 100%;
            height: auto;
            font-family: $font-main;
        }

        &__outline {
            fill: rgba($color-primary, 0.02);
            stroke: $color-primary;
            stroke-width: 2;
        }

        &__label {
            fill: $color-secondary;
            font-size: 10px;
            letter-spacing: 2px;
        }

        &__corridor {
            stroke: $color-border;
            stroke-width: 1.5;
            stroke-dasharray: 6 4;
        }

        &__door {
            stroke: $color-secondary;
            stroke-width: 2;
        }

        &__hatch {
            stroke: rgba($color-border, 0.6);
            stroke-width: 2;
        }

        &__room {
            cursor: pointer;
            outline: none;

            &:focus-visible .crew-deck__body,
            &:hover .crew-deck__body {
                fill: rgba($color-primary, 0.12);
            }

            &--absent {
                opacity: 0.55;
            }
        }

        &__body {
            fill: $color-bg;
            stroke: $color-secondary;
            stroke-width: 2;
            transition: fill 0.2s;

            .crew-deck__room--wardroom & {
                stroke: $color-accent;
                stroke-dasharray: 2 3;
            }

            .crew-deck__room--partner & {
                stroke: $color-accent;
            }

            .crew-deck__room--alert & {
                stroke: $color-primary;
                animation: crew-deck-pulse 2s ease-in-out infinite;
            }

            .crew-deck__room--active & {
                stroke: $color-primary;
                stroke-width: 3;
                animation: none;
            }
        }

        &__seal {
            fill: url('#crew-deck-hatch');
            pointer-events: none;
        }

        &__table {
            fill: none;
            stroke: $color-secondary;
            stroke-width: 1.5;
        }

        &__code {
            fill: $color-primary;
            font-size: 17px;
            font-weight: bold;
        }

        &__badge {
            fill: $color-primary;
            font-size: 13px;
            font-weight: bold;
        }

        &__name {
            fill: $color-accent;
            font-size: 14px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        &__role {
            fill: $color-secondary;
            font-size: 10px;
        }

        &__status {
            fill: $color-accent;
            font-size: 12px;
            font-weight: bold;

            &--good {
                fill: $color-success;
            }

            &--bad {
                fill: $color-danger;
            }

            &--absent {
                fill: $color-secondary;
            }
        }

        &__hearts {
            fill: $color-accent;
            font-size: 11px;
            letter-spacing: 1px;
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

            &--sealed {
                background: repeating-linear-gradient(
                    45deg,
                    $color-border 0 2px,
                    transparent 2px 5px
                );
            }
        }
    }

    @keyframes crew-deck-pulse {
        50% {
            stroke-opacity: 0.45;
        }
    }
</style>
