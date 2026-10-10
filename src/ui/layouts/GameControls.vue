<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { computed } from 'vue'
    import { useGameStore } from '@/stores/gameStore'
    import ControlButton from '@/ui/components/ControlButton.vue'

    const game = useGameStore()
    const { snapshot } = storeToRefs(game)

    const waveText = computed(() => {
        const wave = snapshot.value?.wave
        if (!wave) return ''
        if (wave.current >= wave.total) return 'ВОЛНЫ ЗАВЕРШЕНЫ'
        if (wave.inProgress) return 'ВОЛНА В ПРОЦЕССЕ'
        return `НАЧАТЬ ВОЛНУ ${wave.current + 1}`
    })

    const waveDisabled = computed(() => {
        const wave = snapshot.value?.wave
        return !wave || wave.inProgress || wave.current >= wave.total
    })

    const paused = computed(() => snapshot.value?.status === 'paused')
    const speed = computed(() => snapshot.value?.speed ?? 1)
</script>

<template>
    <div v-if="snapshot" class="game-controls">
        <ControlButton
            tone="wave"
            icon="▶"
            :text="waveText"
            :disabled="waveDisabled"
            @click="game.startWave()"
        />
        <ControlButton
            tone="pause"
            :icon="paused ? '▶' : '⏸'"
            :text="paused ? 'ПРОДОЛЖИТЬ' : 'ПАУЗА'"
            :active="paused"
            @click="game.togglePause()"
        />
        <ControlButton
            tone="speed"
            icon="⏩"
            :text="`УСКОРЕНИЕ ×${speed}`"
            :active="speed !== 1"
            @click="game.cycleSpeed()"
        />
    </div>
</template>

<style scoped lang="scss">
    .game-controls {
        position: fixed;
        bottom: 30px;
        left: 30px;
        z-index: $z-controls;
        display: flex;
        flex-direction: column;
        gap: 10px;

        @media (max-width: 768px) {
            bottom: 15px;
            left: 15px;
        }
    }
</style>
