<script setup lang="ts">
    const { text } = defineProps<{ text: string }>()
</script>

<template>
    <div class="toast-message" role="status">{{ text }}</div>
</template>

<style scoped lang="scss">
    .toast-message {
        padding: 15px 30px;
        border: 2px solid $color-primary;
        background-color: rgba(0, 0, 0, 0.9);
        color: $color-primary;
        font-size: 14px;
    }
</style>
