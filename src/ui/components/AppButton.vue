<script setup lang="ts">
    type Variant = 'primary' | 'secondary'
    type Size = 'regular' | 'compact' | 'small'

    const {
        variant = 'primary',
        size = 'regular',
        disabled = false,
    } = defineProps<{
        variant?: Variant
        size?: Size
        disabled?: boolean
    }>()

    defineEmits<{ click: [] }>()
</script>

<template>
    <button
        type="button"
        class="button"
        :class="{
            'button--secondary': variant === 'secondary',
            'button--compact': size === 'compact',
            'button--small': size === 'small',
        }"
        :disabled="disabled"
        @click="$emit('click')"
    >
        <slot />
    </button>
</template>
