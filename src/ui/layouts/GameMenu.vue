<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { computed } from 'vue'
    import { useRouter } from 'vue-router'
    import { useGameStore } from '@/stores/gameStore'
    import { useUiStore } from '@/stores/uiStore'
    import AppButton from '@/ui/components/AppButton.vue'
    import ObjectiveItem from '@/ui/components/ObjectiveItem.vue'
    import StatItem from '@/ui/components/StatItem.vue'

    const game = useGameStore()
    const ui = useUiStore()
    const router = useRouter()
    const { snapshot } = storeToRefs(game)

    const result = computed(() => snapshot.value?.result ?? null)
    const visible = computed(() => !!result.value || snapshot.value?.status === 'paused')

    const title = computed(() => {
        if (result.value?.outcome === 'victory') return '// СЕКТОР ЗАЩИЩЁН //'
        if (result.value?.outcome === 'defeat') return '// КРИТИЧЕСКИЙ ПРОВАЛ //'
        return '// ПАУЗА //'
    })

    async function restart() {
        if (result.value || (await ui.confirm('Перезапустить уровень?'))) {
            game.restart()
        }
    }

    async function quit() {
        if (result.value || (await ui.confirm('Выйти в меню? Прогресс уровня не сохранится.'))) {
            await router.push({ name: 'levels' })
        }
    }
</script>

<template>
    <div v-if="visible" class="game-menu">
        <h3 class="game-menu__title">{{ title }}</h3>
        <div v-if="result" class="game-menu__stats">
            <p v-if="result.outcome === 'defeat'" class="game-menu__reason">{{ result.reason }}</p>
            <StatItem
                v-for="row in result.stats"
                :key="row.label"
                :label="row.label"
                :value="row.value"
            />
            <div class="game-menu__objectives">
                <h4>ЗАДАЧИ МИССИИ</h4>
                <ObjectiveItem
                    v-for="objective in result.objectives"
                    :key="objective.id"
                    :text="objective.text"
                    :completed="objective.completed"
                />
            </div>
            <p
                v-if="result.outcome === 'defeat' && result.campaignAdvanced"
                class="game-menu__advance"
            >
                Ключевая задача выполнена. История продолжается, новые секторы доступны.
            </p>
            <div v-if="result.unlocks.length" class="game-menu__unlocks">
                <h4>НОВЫЕ ТЕХНОЛОГИИ</h4>
                <ul>
                    <li v-for="tech in result.unlocks" :key="tech">{{ tech }}</li>
                </ul>
            </div>
            <div v-if="result.outcome === 'victory'" class="game-menu__stars">
                {{ '★'.repeat(result.stars) }}{{ '☆'.repeat(3 - result.stars) }}
            </div>
        </div>
        <AppButton v-if="!result" @click="game.togglePause()">ПРОДОЛЖИТЬ</AppButton>
        <AppButton v-if="result?.campaignAdvanced" @click="quit">К СХЕМЕ КОРАБЛЯ</AppButton>
        <AppButton v-if="result?.outcome === 'defeat'" @click="restart">ПОВТОРИТЬ</AppButton>
        <AppButton v-if="!result" variant="secondary" @click="restart">ПЕРЕЗАПУСТИТЬ</AppButton>
        <AppButton variant="secondary" @click="quit">ВЫХОД В МЕНЮ</AppButton>
    </div>
</template>

<style scoped lang="scss">
    .game-menu {
        position: fixed;
        top: 50%;
        left: 50%;
        z-index: $z-menu;
        width: min(500px, calc(100vw - 32px));
        max-height: 90vh;
        overflow-y: auto;
        max-width: 500px;
        padding: 30px;
        border: 3px solid $color-primary;
        background-color: rgba($color-bg, 0.98);
        box-shadow: 0 0 50px rgba(255, 255, 255, 0.5);
        transform: translate(-50%, -50%);

        &__title {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid $color-primary;
            font-size: 24px;
            letter-spacing: 3px;
            text-align: center;
        }

        &__stats {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid $color-border;
            font-size: 14px;
        }

        &__reason {
            margin-bottom: 15px;
            color: $color-danger;
            text-align: center;
        }

        &__objectives,
        &__unlocks {
            margin-top: $spacing-md;
            padding-top: $spacing-md;
            border-top: 1px solid $color-border;
        }

        &__unlocks ul {
            padding-left: $spacing-lg;
            margin-top: $spacing-sm;
        }

        &__advance,
        &__unlocks {
            color: $color-success;
        }

        &__stars {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid $color-border;
            font-size: 20px;
            text-align: center;
        }
    }
</style>
