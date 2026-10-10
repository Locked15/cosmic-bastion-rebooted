<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { computed } from 'vue'
    import { useGameStore } from '@/stores/gameStore'
    import AppButton from '@/ui/components/AppButton.vue'
    import PanelStat from '@/ui/components/PanelStat.vue'

    const game = useGameStore()
    const { snapshot } = storeToRefs(game)

    const viewLabel = computed(() =>
        snapshot.value?.view === 'living' ? '🔧 ЖИЛ. ОТСЕК' : '🏢 КОРИДОР',
    )
</script>

<template>
    <header v-if="snapshot" class="top-panel">
        <PanelStat label="УРОВЕНЬ:" :value="snapshot.levelName" />
        <PanelStat label="ВОЛНА:" :value="`${snapshot.wave.current}/${snapshot.wave.total}`" />
        <PanelStat
            label="РЕСУРСЫ:"
            :value="Math.floor(snapshot.resources)"
            :rate="`+${snapshot.resourceRate.toFixed(1)}/с`"
            framed
        />
        <AppButton size="small" @click="game.toggleView()">{{ viewLabel }}</AppButton>
    </header>
</template>

<style scoped lang="scss">
    .top-panel {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: $top-panel-height;
        padding: 0 $spacing-lg;
        border-bottom: 2px solid $color-primary;
        background-color: rgba(0, 0, 0, 0.9);

        @include below($breakpoint-compact) {
            gap: $spacing-sm;
            padding: 0 $spacing-sm;
        }
    }
</style>
