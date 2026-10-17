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
    const mainObjectives = computed(() => result.value?.objectives.filter((o) => !o.optional) ?? [])
    const optionalObjectives = computed(
        () => result.value?.objectives.filter((o) => o.optional) ?? [],
    )
    // A victory counts for the campaign only with every main objective done.
    const held = computed(() => mainObjectives.value.every((objective) => objective.completed))
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
        <section v-if="result?.ending" class="game-menu__ending" aria-label="Финал кампании">
            <p class="game-menu__ending-label">ФИНАЛ КАМПАНИИ</p>
            <h4 class="game-menu__ending-title">{{ result.ending.title }}</h4>
            <p v-for="(paragraph, index) in result.ending.paragraphs" :key="index">
                {{ paragraph }}
            </p>
            <template v-if="result.ending.epilogue.length">
                <p class="game-menu__ending-label game-menu__epilogue">ЭКИПАЖ</p>
                <p v-for="(paragraph, index) in result.ending.epilogue" :key="`crew-${index}`">
                    {{ paragraph }}
                </p>
            </template>
        </section>
        <div v-if="result" class="game-menu__stats">
            <p v-if="result.outcome === 'defeat'" class="game-menu__reason">{{ result.reason }}</p>
            <p v-if="result.outcome === 'defeat' && result.advanced" class="game-menu__onward">
                Сектор потерян, но кампания продолжается: Сонм прорвался вглубь корабля.
            </p>
            <StatItem
                v-for="row in result.stats"
                :key="row.label"
                :label="row.label"
                :value="row.value"
            />
            <div class="game-menu__objectives">
                <h4>ОСНОВНЫЕ ЗАДАЧИ</h4>
                <ObjectiveItem
                    v-for="objective in mainObjectives"
                    :key="objective.id"
                    :text="objective.text"
                    :completed="objective.completed"
                />
                <h4 v-if="optionalObjectives.length" class="game-menu__optional">ДОПОЛНИТЕЛЬНО</h4>
                <ObjectiveItem
                    v-for="objective in optionalObjectives"
                    :key="objective.id"
                    :text="objective.text"
                    :completed="objective.completed"
                    optional
                />
                <p v-if="result.outcome === 'victory' && !held" class="game-menu__reason">
                    Основные задачи не выполнены: сектор не засчитан.
                </p>
            </div>
            <p v-if="result.requisitions" class="game-menu__requisitions">
                Начислено: + {{ result.requisitions }}
                <span class="requisition-icon" role="img" aria-label="реквизиций" />
                · Интендантство
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
        <AppButton v-if="result?.outcome === 'victory' || result?.advanced" @click="quit">
            К СХЕМЕ КОРАБЛЯ
        </AppButton>
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

        &__onward {
            margin-bottom: 15px;
            color: $color-warning;
            text-align: center;
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

        &__optional {
            margin-top: $spacing-sm;
        }

        &__unlocks ul {
            padding-left: $spacing-lg;
            margin-top: $spacing-sm;
        }

        &__advance,
        &__unlocks {
            color: $color-success;
        }

        &__ending {
            margin-bottom: $spacing-md;
            padding: $spacing-md;
            border: 1px solid $color-accent;
            font-size: 14px;
            line-height: 1.5;

            p + p {
                margin-top: $spacing-sm;
            }
        }

        &__ending-label {
            color: $color-accent;
            font-size: 10px;
            letter-spacing: 2px;
        }

        &__epilogue {
            margin-top: $spacing-md;
            padding-top: $spacing-sm;
            border-top: 1px solid $color-border;
        }

        &__ending-title {
            margin: $spacing-xs 0 $spacing-sm;
            font-size: 18px;
            letter-spacing: 2px;
        }

        &__requisitions {
            margin-top: $spacing-md;
            padding: $spacing-sm;
            border: 1px dashed $color-accent;
            color: $color-accent;
            text-align: center;
            letter-spacing: 1px;
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
