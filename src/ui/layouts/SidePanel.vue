<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { computed } from 'vue'
    import { useRouter } from 'vue-router'
    import { useGameStore } from '@/stores/gameStore'
    import { useUiStore } from '@/stores/uiStore'
    import AppButton from '@/ui/components/AppButton.vue'
    import BuildItemCard from '@/ui/components/BuildItemCard.vue'
    import ConversionControl from '@/ui/components/ConversionControl.vue'
    import ConversionItem from '@/ui/components/ConversionItem.vue'
    import PersonnelCount from '@/ui/components/PersonnelCount.vue'
    import ProgressBar from '@/ui/components/ProgressBar.vue'
    import StatItem from '@/ui/components/StatItem.vue'

    const game = useGameStore()
    const ui = useUiStore()
    const router = useRouter()
    const { snapshot, selectedBuild } = storeToRefs(game)

    const towers = computed(
        () => snapshot.value?.buildOptions.filter((o) => o.category === 'tower') ?? [],
    )
    const barricades = computed(
        () => snapshot.value?.buildOptions.filter((o) => o.category === 'barricade') ?? [],
    )
    const selection = computed(() => snapshot.value?.selection ?? null)

    function isSelected(category: string, type: string) {
        return selectedBuild.value?.category === category && selectedBuild.value.type === type
    }

    async function demolish() {
        if (await ui.confirm('Демонтировать? Вы получите 50% стоимости обратно.')) {
            game.demolishSelection()
        }
    }

    async function quit() {
        if (await ui.confirm('Выйти в меню? Прогресс уровня не сохранится.')) {
            await router.push({ name: 'levels' })
        }
    }
</script>

<template>
    <aside v-if="snapshot" class="side-panel">
        <section class="panel-block">
            <h3 class="panel-block__title">ПЕРСОНАЛ</h3>
            <PersonnelCount icon="⚒" label="Шахтёры:" :count="snapshot.personnel.miners" />
            <PersonnelCount icon="⚔" label="Военные:" :count="snapshot.personnel.military" />
            <ConversionControl
                label="Шахтёры → Военные:"
                :max="snapshot.personnel.miners"
                @convert="game.convert('miner', 'military', $event)"
            />
            <ConversionControl
                label="Военные → Шахтёры:"
                :max="snapshot.personnel.military"
                @convert="game.convert('military', 'miner', $event)"
            />
            <ConversionItem
                v-for="conversion in snapshot.conversions"
                :key="conversion.id"
                :title="conversion.title"
                :percent="conversion.percent"
            />
        </section>

        <section class="panel-block">
            <h3 class="panel-block__title">ВООРУЖЕНИЕ</h3>
            <div class="panel-block__list">
                <BuildItemCard
                    v-for="option in towers"
                    :key="option.type"
                    :name="option.name"
                    :description="option.description"
                    :cost="option.cost"
                    :affordable="option.affordable"
                    :selected="isSelected(option.category, option.type)"
                    @select="game.selectBuild(option.category, option.type)"
                />
            </div>
        </section>

        <section class="panel-block">
            <h3 class="panel-block__title">БАРРИКАДЫ</h3>
            <div class="panel-block__list">
                <BuildItemCard
                    v-for="option in barricades"
                    :key="option.type"
                    :name="option.name"
                    :description="option.description"
                    :cost="option.cost"
                    :affordable="option.affordable"
                    :selected="isSelected(option.category, option.type)"
                    @select="game.selectBuild(option.category, option.type)"
                />
            </div>
        </section>

        <section v-if="selection" class="panel-block side-panel__selection">
            <h3 class="panel-block__title">ИНФОРМАЦИЯ</h3>
            <h4 class="side-panel__selection-title">{{ selection.title }}</h4>
            <StatItem
                v-for="row in selection.stats"
                :key="row.label"
                :label="row.label"
                :value="row.value"
            />
            <StatItem label="Состояние" :value="selection.status" />
            <p v-if="selection.disabled" class="side-panel__warning">ОТКЛЮЧЕНА!</p>
            <ProgressBar
                v-for="bar in selection.progress"
                :key="bar.label"
                :label="bar.label"
                :percent="bar.percent"
            />
            <div v-if="selection.abilities.length" class="side-panel__abilities">
                <div class="side-panel__abilities-title">Активные улучшения</div>
                <p
                    v-for="ability in selection.abilities"
                    :key="ability.name"
                    class="side-panel__ability"
                >
                    <strong>{{ ability.name }}</strong> — {{ ability.description }}
                </p>
            </div>
            <div v-if="selection.nextAbility" class="side-panel__next">
                <div class="side-panel__next-name">Далее: {{ selection.nextAbility.name }}</div>
                <div class="side-panel__next-description">
                    {{ selection.nextAbility.description }}
                </div>
            </div>
            <AppButton
                v-if="selection.upgradeCost !== null"
                size="compact"
                :disabled="!selection.canUpgrade"
                @click="game.upgradeSelection()"
            >
                УЛУЧШИТЬ (💎 {{ selection.upgradeCost }})
            </AppButton>
            <AppButton
                v-if="selection.canDemolish"
                size="compact"
                variant="secondary"
                @click="demolish"
            >
                ДЕМОНТИРОВАТЬ (возврат 50%)
            </AppButton>
        </section>

        <section class="panel-block">
            <AppButton variant="secondary" @click="ui.openSettings()">НАСТРОЙКИ</AppButton>
            <AppButton variant="secondary" @click="game.togglePause()">ПАУЗА</AppButton>
            <AppButton variant="secondary" @click="quit">ВЫХОД</AppButton>
        </section>
    </aside>
</template>

<style scoped lang="scss">
    .side-panel {
        position: fixed;
        top: $top-panel-height;
        right: 0;
        width: $side-panel-width;
        height: calc(100vh - #{$top-panel-height});
        padding: $spacing-md;
        overflow-y: auto;
        border-left: 2px solid $color-primary;
        background-color: rgba(0, 0, 0, 0.95);

        &::-webkit-scrollbar {
            width: 8px;
        }

        &::-webkit-scrollbar-track {
            background: $color-bg;
        }

        &::-webkit-scrollbar-thumb {
            border: 1px solid $color-primary;
            background: $color-border;
        }

        &__selection {
            font-size: 12px;
        }

        &__selection-title {
            margin-bottom: 10px;
            font-size: 14px;
        }

        &__warning {
            color: $color-danger;
            font-weight: bold;
        }

        &__abilities {
            margin-top: 12px;
            padding-top: $spacing-sm;
            border-top: 1px solid $color-border;
        }

        &__abilities-title {
            margin-bottom: $spacing-xs;
            color: $color-secondary;
            font-size: 11px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        &__ability {
            margin: $spacing-xs 0;
            line-height: 1.4;

            strong {
                color: $color-accent;
            }
        }

        &__next {
            margin: 12px 0 $spacing-sm;
            padding: $spacing-sm;
            border: 1px dashed $color-accent;
            background: rgba(0, 255, 255, 0.05);
        }

        &__next-name {
            color: $color-accent;
            font-weight: bold;
        }

        &__next-description {
            margin-top: 2px;
            color: $color-secondary;
            font-size: 11px;
        }

        @media (max-width: 1400px) {
            width: 280px;
        }
    }
</style>
