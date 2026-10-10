<script setup lang="ts">
    import { computed } from 'vue'

    const {
        name,
        sector = '',
        description,
        locked,
        completed,
        stars,
        story,
        active = false,
    } = defineProps<{
        name: string
        sector?: string
        description: string
        locked: boolean
        completed: boolean
        stars: number
        story: boolean
        active?: boolean
    }>()

    defineEmits<{ select: [] }>()

    const status = computed(() => {
        if (completed) return { text: `★ ${stars}/3`, modifier: 'completed' }
        if (locked) return { text: '🔒 ЗАБЛОКИРОВАН', modifier: 'locked' }
        return { text: '● ДОСТУПЕН', modifier: 'available' }
    })
</script>

<template>
    <button
        type="button"
        class="level-node"
        :class="{
            'level-node--completed': completed,
            'level-node--locked': locked,
            'level-node--story': story,
            'level-node--active': active,
        }"
        :disabled="locked"
        @click="$emit('select')"
    >
        <span class="level-node__status" :class="`level-node__status--${status.modifier}`">
            {{ status.text }}
        </span>
        <span class="level-node__sector">{{ sector }}</span>
        <span class="level-node__name">{{ name }}</span>
        <span class="level-node__description">{{ description }}</span>
    </button>
</template>

<style scoped lang="scss">
    .level-node {
        position: relative;
        display: block;
        width: 100%;
        margin: 0;
        padding: $spacing-md;
        border: 2px solid $color-secondary;
        background-color: rgba($color-bg, 0.94);
        color: $color-primary;
        text-align: left;
        cursor: pointer;
        transition: all 0.3s;

        &:hover:not(:disabled) {
            border-color: $color-primary;
            background-color: rgba($color-primary, 0.1);
        }

        &--completed {
            border-color: $color-success;
            opacity: 0.6;
        }

        &--locked {
            opacity: 0.3;
            cursor: not-allowed;
        }

        &--story {
            border-left: 4px solid $color-accent;
        }

        &--active {
            border-color: $color-primary;
            box-shadow: 0 0 20px rgba($color-primary, 0.3);
            opacity: 1;
        }

        &__status {
            position: absolute;
            top: $spacing-xs;
            right: $spacing-xs;
            padding: $spacing-xs $spacing-sm;
            border: 1px solid;
            font-size: 10px;

            &--completed {
                color: $color-success;
            }

            &--locked {
                color: $color-danger;
            }

            &--available {
                color: $color-primary;
            }
        }

        &__sector {
            display: block;
            margin-bottom: $spacing-sm;
            padding-top: $spacing-md;
            color: $color-accent;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        &__name {
            display: block;
            margin-bottom: $spacing-sm;
            font-size: 16px;
            font-weight: bold;
        }

        &__description {
            display: block;
            color: $color-secondary;
            font-size: 12px;
        }
    }
</style>
