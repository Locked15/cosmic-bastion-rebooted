<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { computed, nextTick, ref, useTemplateRef } from 'vue'
    import { useRouter } from 'vue-router'
    import { useCampaignStore } from '@/stores/campaignStore'
    import ShipMapFrame from '@/ui/components/ShipMapFrame.vue'
    import LevelNodeCard from '@/ui/components/LevelNodeCard.vue'
    import MissionInfo from '@/ui/layouts/MissionInfo.vue'

    const router = useRouter()
    const { levels, savedWaves } = storeToRefs(useCampaignStore())

    const selectedId = ref<string | null>(null)
    const selected = computed(
        () => levels.value.find((level) => level.id === selectedId.value) ?? null,
    )

    const info = useTemplateRef<InstanceType<typeof MissionInfo>>('info')

    // In the single-column layout the mission panel is below the map: bring it into view.
    async function select(levelId: string) {
        selectedId.value = levelId
        if (!window.matchMedia?.('(max-width: 1200px)').matches) return
        await nextTick()
        ;(info.value?.$el as HTMLElement | undefined)?.scrollIntoView?.({ behavior: 'smooth' })
    }

    function start(resume: boolean) {
        if (selected.value) {
            router.push({
                name: 'game',
                params: { levelId: selected.value.id },
                query: resume ? { resume: '1' } : {},
            })
        }
    }
</script>

<template>
    <main class="level-select">
        <h2 class="level-select__title">СХЕМА КОРАБЛЯ - ВЫБОР СЕКТОРА</h2>
        <div class="level-select__map" aria-label="Схема секторов корабля">
            <ShipMapFrame />
            <LevelNodeCard
                v-for="level in levels"
                :key="level.id"
                class="level-select__node"
                :style="{ left: `${level.mapX}%`, top: `${level.mapY}%` }"
                :sector="level.sector"
                :name="level.name"
                :description="level.description"
                :locked="level.locked"
                :completed="level.completed"
                :stars="level.stars"
                :story="level.story"
                :active="level.id === selectedId"
                @select="select(level.id)"
            />
        </div>
        <MissionInfo
            ref="info"
            class="level-select__info"
            :level="selected"
            :saved-wave="selected ? (savedWaves[selected.id] ?? null) : null"
            @start="start"
            @back="router.push({ name: 'menu' })"
        />
    </main>
</template>

<style scoped lang="scss">
    .level-select {
        display: grid;
        grid-template-rows: auto minmax(680px, 1fr);
        grid-template-columns: 2fr 1fr;
        gap: $spacing-lg;
        // The page scrolls itself: body has overflow hidden for the game screen.
        height: 100vh;
        padding: $spacing-lg;
        overflow-y: auto;

        &__title {
            grid-column: 1 / -1;
            padding: $spacing-md;
            border-bottom: 2px solid $color-primary;
            letter-spacing: 4px;
            text-align: center;
        }

        &__map {
            @include blueprint-grid(30px);

            position: relative;
            min-height: 680px;
            padding: $spacing-md;
            border: 2px solid $color-primary;
        }

        // Mission details always fit the viewport, so the start button is reachable.
        &__info {
            position: sticky;
            top: 0;
            align-self: start;
            max-height: calc(100vh - #{$spacing-lg * 2});
        }

        &__node {
            position: absolute;
            width: 42%;
            transform: translate(-50%, -50%);
        }

        @media (max-width: 1200px) {
            grid-template-columns: 1fr;

            &__info {
                position: static;
                max-height: none;
            }
        }
    }
</style>
