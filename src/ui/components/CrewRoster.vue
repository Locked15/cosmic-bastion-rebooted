<script setup lang="ts">
    import type { CrewMemberView } from '@/application/dto/views'

    // Personnel files: each character's standing with the player, and affection if any.
    const { members } = defineProps<{ members: CrewMemberView[] }>()

    const PIPS = 10
</script>

<template>
    <section class="crew-roster" aria-label="Личные дела экипажа">
        <h3 class="crew-roster__title">ЛИЧНЫЕ ДЕЛА</h3>
        <ul class="crew-roster__list">
            <li
                v-for="member in members"
                :key="member.id"
                class="crew-roster__member"
                :class="{ 'crew-roster__member--partner': member.partner }"
            >
                <span class="crew-roster__name">{{ member.name }}</span>
                <span class="crew-roster__role">{{ member.role }}</span>
                <span
                    class="crew-roster__standing"
                    :class="{
                        'crew-roster__standing--good': member.disposition > 0,
                        'crew-roster__standing--bad': member.disposition < 0,
                    }"
                >
                    {{ member.standing }}
                </span>
                <span
                    v-if="member.affection !== null"
                    class="crew-roster__affection"
                    :aria-label="`Привязанность: ${Math.max(0, member.affection)} из ${PIPS}`"
                >
                    {{ '♥'.repeat(Math.max(0, Math.min(PIPS, member.affection)))
                    }}{{ '·'.repeat(PIPS - Math.max(0, Math.min(PIPS, member.affection))) }}
                </span>
            </li>
        </ul>
    </section>
</template>

<style scoped lang="scss">
    .crew-roster {
        margin-top: $spacing-md;
        padding: $spacing-md;
        border: 1px solid $color-border;
        background-color: rgba($color-bg, 0.85);

        &__title {
            margin-bottom: $spacing-sm;
            font-size: 14px;
            letter-spacing: 3px;
        }

        &__list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: $spacing-sm;
            list-style: none;
        }

        &__member {
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding: $spacing-xs $spacing-sm;
            border-left: 2px solid $color-border;
            font-size: 12px;

            &--partner {
                border-left-color: $color-primary;
            }
        }

        &__name {
            color: $color-primary;
        }

        &__role {
            color: $color-secondary;
            font-size: 11px;
        }

        &__standing {
            color: $color-accent;

            &--good {
                color: $color-success;
            }

            &--bad {
                color: $color-danger;
            }
        }

        &__affection {
            color: $color-accent;
            letter-spacing: 2px;
        }
    }
</style>
