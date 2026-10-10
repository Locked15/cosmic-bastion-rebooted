<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { computed, ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { useCampaignStore } from '@/stores/campaignStore'
    import ShipMapFrame from '@/ui/components/ShipMapFrame.vue'
    import LevelNodeCard from '@/ui/components/LevelNodeCard.vue'
    import MissionInfo from '@/ui/layouts/MissionInfo.vue'

    const router = useRouter()
    const { levels } = storeToRefs(useCampaignStore())

    const selectedId = ref<string | null>(null)
    const selected = computed(
        () => levels.value.find((level) => level.id === selectedId.value) ?? null,
    )

    function start() {
        if (selected.value) {
            router.push({ name: 'game', params: { levelId: selected.value.id } })
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
                @select="selectedId = level.id"
            />
        </div>
        <MissionInfo :level="selected" @start="start" @back="router.push({ name: 'menu' })" />
    </main>
</template>

<style scoped lang="scss">
    .level-select {
        display: grid;
        grid-template-rows: auto minmax(680px, 1fr);
        grid-template-columns: 2fr 1fr;
        gap: $spacing-lg;
        min-height: 100vh;
        padding: $spacing-lg;

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

        &__node {
            position: absolute;
            width: 42%;
            transform: translate(-50%, -50%);
        }

        @media (max-width: 1200px) {
            grid-template-columns: 1fr;
            overflow-y: auto;
        }
    }
</style>
