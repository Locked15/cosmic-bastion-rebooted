<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { useUiStore } from '@/stores/uiStore'
    import ToastMessage from '@/ui/components/ToastMessage.vue'

    const { toasts } = storeToRefs(useUiStore())
</script>

<template>
    <TransitionGroup tag="div" name="toast-stack" class="toast-stack">
        <ToastMessage v-for="toast in toasts" :key="toast.id" :text="toast.text" />
    </TransitionGroup>
</template>

<style scoped lang="scss">
    .toast-stack {
        position: fixed;
        top: 80px;
        left: 50%;
        z-index: $z-toast;
        display: flex;
        flex-direction: column;
        gap: $spacing-sm;
        align-items: center;
        transform: translateX(-50%);
        pointer-events: none;
    }

    .toast-stack-enter-active,
    .toast-stack-leave-active {
        transition: all 0.3s ease-out;
    }

    .toast-stack-enter-from,
    .toast-stack-leave-to {
        opacity: 0;
        transform: translateY(-20px);
    }
</style>
