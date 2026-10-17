<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { computed, ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { useCampaignStore } from '@/stores/campaignStore'
    import { useSettingsStore } from '@/stores/settingsStore'
    import CrewDeckMap from '@/ui/components/CrewDeckMap.vue'
    import CabinInfo from '@/ui/layouts/CabinInfo.vue'
    import CrewScenes from '@/ui/layouts/CrewScenes.vue'

    // The wardroom: the officers' deck with a cabin for every character.
    const router = useRouter()
    const campaign = useCampaignStore()
    const { crewDeck, pendingScenes } = storeToRefs(campaign)
    const { settings } = storeToRefs(useSettingsStore())

    // Open on whoever is waiting to talk first.
    const selectedId = ref<string | null>(
        crewDeck.value.members.find((member) => member.present && member.pendingScenes)?.id ?? null,
    )
    const selected = computed(
        () => crewDeck.value.members.find((member) => member.id === selectedId.value) ?? null,
    )
</script>

<template>
    <main class="wardroom">
        <h2 class="wardroom__title">
            {{ crewDeck.wardroom.code }} {{ crewDeck.wardroom.name.toUpperCase() }} - КАЮТЫ ЭКИПАЖА
        </h2>
        <section class="wardroom__map">
            <CrewDeckMap
                :deck="crewDeck"
                :selected-id="selectedId"
                @select="selectedId = $event"
                @table="campaign.openPendingScenes()"
            />
        </section>
        <CabinInfo
            class="wardroom__info"
            :member="selected"
            :pending="pendingScenes.length"
            :scenes-enabled="settings.crewScenes"
            @talk="campaign.openPendingScenes($event)"
            @table="campaign.openPendingScenes()"
            @back="router.push({ name: 'levels' })"
        />
        <CrewScenes />
    </main>
</template>

<style scoped lang="scss">
    .wardroom {
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
