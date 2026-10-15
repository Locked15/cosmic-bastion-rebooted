<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { useCampaignStore } from '@/stores/campaignStore'
    import SceneScreen from '@/ui/components/SceneScreen.vue'

    const campaign = useCampaignStore()
    const { activeScene } = storeToRefs(campaign)
</script>

<template>
    <div
        v-if="activeScene"
        class="modal crew-scenes"
        role="dialog"
        aria-modal="true"
        aria-label="Сцена с экипажем"
    >
        <div class="modal__box crew-scenes__box">
            <SceneScreen
                :speaker="activeScene.scene.speaker"
                :place="activeScene.scene.place"
                :lines="activeScene.scene.lines"
                :choices="activeScene.scene.choices"
                :reply="activeScene.reply"
                @choose="campaign.chooseScene"
                @skip="campaign.skipScene()"
                @continue="campaign.continueScenes()"
                @later="campaign.closeScenes()"
            />
        </div>
    </div>
</template>

<style scoped lang="scss">
    .crew-scenes__box {
        width: 600px;
    }
</style>
