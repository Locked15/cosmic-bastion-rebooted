<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { computed, nextTick, ref, useTemplateRef } from 'vue'
    import { useRouter } from 'vue-router'
    import type { FacilityRoomView, FacilityView } from '@/application'
    import { useCampaignStore } from '@/stores/campaignStore'
    import { useRequisitionStore } from '@/stores/requisitionStore'
    import ShipDeckMap from '@/ui/components/ShipDeckMap.vue'
    import CrewScenes from '@/ui/layouts/CrewScenes.vue'
    import MissionInfo from '@/ui/layouts/MissionInfo.vue'

    const router = useRouter()
    const campaign = useCampaignStore()
    const { levels, savedWaves, pendingScenes } = storeToRefs(campaign)
    const { view: requisitions } = storeToRefs(useRequisitionStore())

    // Service rooms with their readouts: waiting conversations, requisitions on account.
    const facilities = computed<FacilityRoomView[]>(() =>
        campaign.facilities.map((room) =>
            room.locked
                ? { ...room, status: `ПОСЛЕ ${room.prerequisites.join(', ')}`, alert: false }
                : room.id === 'wardroom'
                  ? {
                        ...room,
                        status: pendingScenes.value.length
                            ? `РАЗГОВОРОВ: ${pendingScenes.value.length}`
                            : 'ТИШИНА',
                        alert: pendingScenes.value.length > 0,
                    }
                  : { ...room, status: `НА СЧЁТЕ: ${requisitions.value.balance}`, alert: false },
        ),
    )

    function open(id: FacilityView['id']) {
        if (campaign.isFacilityOpen(id)) router.push({ name: id })
    }

    // Start on the first open sector not won yet: the training briefing for a new officer.
    const selectedId = ref<string | null>(
        levels.value.find((level) => !level.locked && !level.completed)?.id ?? null,
    )
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

    async function start(resume: boolean) {
        const level = selected.value
        if (!level) return
        // A resumed mission already had its briefing scenes.
        if (!resume) await campaign.playScenesBefore(level.id)
        router.push({
            name: 'game',
            params: { levelId: level.id },
            query: resume ? { resume: '1' } : {},
        })
    }
</script>

<template>
    <main class="level-select">
        <h2 class="level-select__title">СХЕМА КОРАБЛЯ - ВЫБОР СЕКТОРА</h2>
        <section class="level-select__map">
            <ShipDeckMap
                :levels="levels"
                :facilities="facilities"
                :selected-id="selectedId"
                @select="select"
                @open="open"
            />
        </section>
        <CrewScenes />
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
        grid-template-rows: auto 1fr;
        grid-template-columns: 5fr 2fr;
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
            @include blueprint-grid(25px, rgba($color-border, 0.35));

            align-self: start;
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

        @media (max-width: 1200px) {
            grid-template-columns: 1fr;

            &__info {
                position: static;
                max-height: none;
            }
        }
    }
</style>
