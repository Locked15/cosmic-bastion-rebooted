<script setup lang="ts">
    import { computed } from 'vue'

    // One requisition form in a tree column: code, name, step bar and price.
    const {
        code,
        name,
        level,
        maxLevel,
        cost = null,
        affordable = false,
        blocked = false,
        selected = false,
        flash = false,
    } = defineProps<{
        code: string
        name: string
        level: number
        maxLevel: number
        cost?: number | null
        affordable?: boolean
        // Closed tier or tree, or a missing requirement.
        blocked?: boolean
        selected?: boolean
        // Briefly blinks after a purchase.
        flash?: boolean
    }>()

    defineEmits<{ select: [] }>()

    const bar = computed(() => '■'.repeat(level) + '□'.repeat(Math.max(0, maxLevel - level)))
    const price = computed(() =>
        cost === null ? 'исполнено' : blocked ? 'закрыто' : `${cost} реквизиций`,
    )
</script>

<template>
    <button
        type="button"
        class="requisition-node"
        :class="{
            'requisition-node--selected': selected,
            'requisition-node--short': cost !== null && !affordable,
            'requisition-node--blocked': blocked,
            'requisition-node--complete': cost === null,
            'requisition-node--flash': flash,
        }"
        role="option"
        :aria-selected="selected"
        :aria-label="`${name}: ${level} из ${maxLevel}, ${price}`"
        @click="$emit('select')"
    >
        <span class="requisition-node__code">{{ selected ? '▶' : '' }}[{{ code }}]</span>
        <span class="requisition-node__name">{{ name }}</span>
        <span class="requisition-node__foot">
            <span class="requisition-node__bar">{{ bar }}</span>
            <span class="requisition-node__price">
                <template v-if="cost === null">ИСП.</template>
                <template v-else-if="blocked">▒▒</template>
                <template v-else>
                    {{ cost }} <span class="requisition-icon" aria-hidden="true" />
                </template>
            </span>
        </span>
    </button>
</template>

<style scoped lang="scss">
    .requisition-node {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 100%;
        padding: 4px 6px;
        border: 1px solid rgba($color-primary, 0.35);
        background: none;
        color: inherit;
        font-family: $font-main;
        font-size: 12px;
        text-align: left;
        text-shadow: inherit;
        cursor: pointer;

        &:hover {
            background: rgba($color-primary, 0.08);
        }

        &:focus-visible {
            outline: 1px dashed $color-primary;
        }

        // Inverse video for the form under the cursor.
        &--selected,
        &--selected:hover {
            background: $color-primary;
            color: $color-screen;
            text-shadow: none;
        }

        &--short:not(&--selected) &__price,
        &--complete:not(&--selected) {
            color: $color-secondary;
        }

        &--blocked:not(&--selected) {
            border-style: dashed;
            color: $color-secondary;
            opacity: 0.6;
        }

        &--flash {
            animation: requisition-node-flash 0.15s steps(1) 4;
        }

        &__code {
            font-size: 10px;
            letter-spacing: 1px;
        }

        &__name {
            min-height: 2.6em;
            text-transform: uppercase;
            line-height: 1.3;
        }

        &__foot {
            display: flex;
            justify-content: space-between;
            gap: 4px;
        }

        &__bar {
            letter-spacing: 1px;
        }

        &__price {
            white-space: nowrap;
        }
    }

    @keyframes requisition-node-flash {
        50% {
            background: transparent;
            color: $color-primary;
        }
    }
</style>
