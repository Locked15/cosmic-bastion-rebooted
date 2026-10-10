<script setup lang="ts">
    import { onBeforeUnmount, watch } from 'vue'
    import { useRoute, useRouter } from 'vue-router'
    import { onKeyStroke } from '@/ui/keyboard'
    import { useGameStore } from '@/stores/gameStore'
    import GameCanvas from '@/ui/components/GameCanvas.vue'
    import GameControls from '@/ui/layouts/GameControls.vue'
    import GameMenu from '@/ui/layouts/GameMenu.vue'
    import SidePanel from '@/ui/layouts/SidePanel.vue'
    import StoryDialog from '@/ui/layouts/StoryDialog.vue'
    import TopPanel from '@/ui/layouts/TopPanel.vue'

    const { levelId } = defineProps<{ levelId: string }>()

    const game = useGameStore()
    const router = useRouter()
    const route = useRoute()

    // Unknown or locked levels go back to the level map.
    watch(
        () => levelId,
        (id) => {
            if (!game.start(id, route.query.resume === '1')) router.replace({ name: 'levels' })
        },
        { immediate: true },
    )
    onBeforeUnmount(() => game.stop())

    onKeyStroke((key) => game.handleKey(key))
</script>

<template>
    <main class="game-page">
        <TopPanel />
        <div class="game-page__field">
            <GameCanvas
                :draw="game.draw"
                @pointer-move="game.pointerMove"
                @pointer-down="game.pointerDown"
            />
        </div>
        <SidePanel />
        <GameControls />
        <StoryDialog />
        <GameMenu />
    </main>
</template>

<style scoped lang="scss">
    .game-page {
        display: flex;
        flex-direction: column;
        height: 100vh;

        &__field {
            flex-grow: 1;
            min-height: 0;
            margin-right: $side-panel-width;
            border-right: 2px solid $color-primary;
        }
    }
</style>
