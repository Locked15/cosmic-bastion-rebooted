import { defineStore } from 'pinia'
import { ref } from 'vue'
import { CampaignService, type LevelSummary } from '@/application'
import { useServices } from './services'

export const useCampaignStore = defineStore('campaign', () => {
    const service = new CampaignService(useServices().storage)
    const levels = ref<LevelSummary[]>(service.listLevels())
    const hasProgress = ref(service.hasProgress)

    function refresh() {
        levels.value = service.listLevels()
        hasProgress.value = service.hasProgress
    }

    function isUnlocked(levelId: string) {
        return service.isUnlocked(levelId)
    }

    function completeLevel(levelId: string, stars: number) {
        service.completeLevel(levelId, stars)
        refresh()
    }

    function reset() {
        service.reset()
        refresh()
    }

    return { levels, hasProgress, isUnlocked, completeLevel, reset }
})
