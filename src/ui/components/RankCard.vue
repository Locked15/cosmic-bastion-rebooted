<script setup lang="ts">
    // One rank on the registration terminal: a shoulder board with its insignia and rules.
    const {
        label,
        description,
        effects,
        stripes,
        stars,
        general = false,
        selected = false,
    } = defineProps<{
        label: string
        description: string
        effects: string[]
        stripes: number
        stars: number
        general?: boolean
        selected?: boolean
    }>()

    defineEmits<{ select: [] }>()
</script>

<template>
    <button
        type="button"
        class="rank-card"
        :class="{ 'rank-card--selected': selected }"
        role="radio"
        :aria-checked="selected"
        @click="$emit('select')"
    >
        <span
            class="rank-card__board"
            :class="{ 'rank-card__board--general': general }"
            aria-hidden="true"
        >
            <span v-for="stripe in stripes" :key="`s${stripe}`" class="rank-card__stripe" />
            <span class="rank-card__stars">
                <span
                    v-for="star in stars"
                    :key="`t${star}`"
                    class="rank-card__star"
                    :class="{ 'rank-card__star--large': general || stripes > 1 }"
                    >★</span
                >
            </span>
            <span class="rank-card__button" />
        </span>
        <span class="rank-card__label">{{ label }}</span>
        <span class="rank-card__description">{{ description }}</span>
        <span class="rank-card__effects">
            <span v-for="effect in effects" :key="effect" class="rank-card__effect">
                {{ effect }}
            </span>
        </span>
    </button>
</template>

<style scoped lang="scss">
    .rank-card {
        display: flex;
        flex-direction: column;
        gap: $spacing-xs;
        padding: $spacing-sm;
        border: 1px solid $color-border;
        background-color: $color-bg;
        color: $color-primary;
        font-family: $font-main;
        text-align: left;
        cursor: pointer;

        &:hover,
        &:focus-visible {
            border-color: $color-secondary;
            outline: none;
        }

        &--selected {
            border-color: $color-primary;
            box-shadow:
                0 0 12px rgba($color-primary, 0.25),
                inset 0 0 0 1px $color-primary;
        }

        // The shoulder board: a dark strap with a button, stripes and stars.
        &__board {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            height: 44px;
            margin-bottom: $spacing-xs;
            border: 1px solid $color-secondary;
            border-radius: 4px 22px 22px 4px;
            background: repeating-linear-gradient(
                90deg,
                rgba($color-primary, 0.06) 0 2px,
                transparent 2px 5px
            );

            &--general {
                background: repeating-linear-gradient(
                    135deg,
                    rgba($color-primary, 0.18) 0 4px,
                    transparent 4px 9px
                );
            }
        }

        &__stripe {
            width: 3px;
            align-self: stretch;
            background-color: $color-secondary;
        }

        &__stars {
            display: flex;
            gap: 4px;
            margin: 0 $spacing-xs;
        }

        &__star {
            font-size: 12px;
            line-height: 1;

            &--large {
                font-size: 22px;
            }
        }

        &__button {
            position: absolute;
            right: 10px;
            width: 10px;
            height: 10px;
            border: 1px solid $color-secondary;
            border-radius: 50%;
        }

        &__label {
            font-size: 14px;
            font-weight: bold;
            letter-spacing: 1px;
        }

        &__description {
            color: $color-accent;
            font-size: 11px;
            line-height: 1.5;
        }

        &__effects {
            display: grid;
            gap: 2px;
            margin-top: auto;
            padding-top: $spacing-xs;
            border-top: 1px dashed $color-border;
        }

        &__effect {
            color: $color-success;
            font-size: 10px;
            line-height: 1.4;
        }
    }
</style>
