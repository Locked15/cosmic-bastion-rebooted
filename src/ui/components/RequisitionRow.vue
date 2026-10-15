<script setup lang="ts">
    import { computed } from 'vue'

    // One requisition record on the terminal: code, name, segment bar, effect and price.
    const {
        code,
        name,
        level,
        maxLevel,
        current,
        next = null,
        cost = null,
        affordable = false,
        selected = false,
        flash = false,
    } = defineProps<{
        code: string
        name: string
        level: number
        maxLevel: number
        current: string
        next?: string | null
        cost?: number | null
        affordable?: boolean
        selected?: boolean
        // Briefly blinks after a purchase.
        flash?: boolean
    }>()

    defineEmits<{ select: [] }>()

    const bar = computed(() => '■'.repeat(level) + '□'.repeat(Math.max(0, maxLevel - level)))
    const price = computed(() => (cost === null ? 'ИСПОЛНЕНО' : `${cost} реквизиций`))
</script>

<template>
    <button
        type="button"
        class="requisition-row"
        :class="{
            'requisition-row--selected': selected,
            'requisition-row--short': cost !== null && !affordable,
            'requisition-row--complete': cost === null,
            'requisition-row--flash': flash,
        }"
        role="option"
        :aria-selected="selected"
        :aria-label="`${name}: ${level} из ${maxLevel}, ${price}`"
        @click="$emit('select')"
    >
        <span class="requisition-row__cursor">{{ selected ? '▶' : ' ' }}</span>
        <span class="requisition-row__code">[{{ code }}]</span>
        <span class="requisition-row__name">{{ name }}</span>
        <span class="requisition-row__bar">{{ bar }}</span>
        <span class="requisition-row__effect">{{ current }}{{ next ? ` → ${next}` : '' }}</span>
        <span class="requisition-row__price">
            <template v-if="cost === null">ИСПОЛНЕНО</template>
            <template v-else>
                {{ cost }} <span class="requisition-icon" aria-hidden="true" />
            </template>
        </span>
    </button>
</template>

<style scoped lang="scss">
    .requisition-row {
        display: grid;
        grid-template-columns: 1.2em 6.5em minmax(0, 1fr) 5.5em 14em 6.5em;
        align-items: center;
        gap: $spacing-sm;
        width: 100%;
        padding: 3px $spacing-xs;
        border: none;
        background: none;
        color: inherit;
        font-family: $font-main;
        font-size: 13px;
        text-align: left;
        text-shadow: inherit;
        cursor: pointer;

        &:hover {
            background: rgba($color-primary, 0.08);
        }

        &:focus-visible {
            outline: 1px dashed $color-primary;
        }

        // Inverse video for the line under the cursor.
        &--selected,
        &--selected:hover {
            background: $color-primary;
            color: $color-screen;
            text-shadow: none;
        }

        &--short:not(&--selected) &__price {
            color: $color-secondary;
        }

        &--complete:not(&--selected) {
            color: $color-secondary;
        }

        &--flash {
            animation: requisition-row-flash 0.15s steps(1) 4;
        }

        &__name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-transform: uppercase;
        }

        &__bar {
            letter-spacing: 1px;
        }

        &__price {
            text-align: right;
        }
    }

    @keyframes requisition-row-flash {
        50% {
            background: transparent;
            color: $color-primary;
        }
    }
</style>
