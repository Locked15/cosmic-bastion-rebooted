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

    // Where the coming (or running) wave will walk, so the player can plan before it starts.
    const intel = computed(() => {
        const wave = snapshot.value?.wave
        if (!wave || !wave.routes.length) return null
        return {
            title: wave.inProgress
                ? `ВОЛНА ${wave.current}`
                : `РАЗВЕДКА: ВОЛНА ${wave.current + 1}`,
            routes: wave.routes,
            boss: wave.boss,
        }
    })

    const paused = computed(() => snapshot.value?.status === 'paused')
    const speed = computed(() => snapshot.value?.speed ?? 1)
</script>

<template>
    <div v-if="snapshot" class="game-controls">
        <section v-if="intel" class="game-controls__intel" aria-label="Пути следующей волны">
            <p class="game-controls__intel-title">{{ intel.title }}</p>
            <p v-for="route in intel.routes" :key="route.label" class="game-controls__route">
                ⇢ {{ route.label }}
                <span v-if="route.opening" class="game-controls__new">НОВЫЙ ПУТЬ</span>
            </p>
            <p v-if="intel.boss" class="game-controls__boss">◉ СРЕДОТОЧИЕ</p>
        </section>
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

        @include below($breakpoint-compact) {
            bottom: 15px;
            left: 15px;
        }

        &__intel {
            max-width: 260px;
            padding: $spacing-xs $spacing-sm;
            border: 1px solid $color-border;
            background-color: rgba(0, 0, 0, 0.85);
            font-size: 11px;
            line-height: 1.6;
        }

        &__intel-title {
            color: $color-secondary;
            letter-spacing: 2px;
        }

        &__route {
            color: $color-primary;
        }

        &__new,
        &__boss {
            color: $color-danger;
            letter-spacing: 1px;
        }

        &__new {
            margin-left: $spacing-xs;
        }
    }
</style>
