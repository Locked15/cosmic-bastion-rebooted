<script setup lang="ts">
    import { RouterView } from 'vue-router'
    const a = { b: 1 }
</script>

<template>
    <div class="app">
        <RouterView /><span>{{ a.b }}</span>
    </div>
</template>

<style scoped lang="scss">
    .app {
        color: red;
        &__x {
            color: blue;
        }
    }
</style>
