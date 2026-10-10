import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
    CampaignService,
    CheckpointService,
    type GameSession,
    type LevelSummary,
    type MissionReport,
} from '@/application'
import { LEVEL_IDS } from '@/domain'
import type { Level } from '@/domain'
import { useServices } from './services'

export const useCampaignStore = defineStore('campaign', () => {
    const { storage } = useServices()
    const service = new CampaignService(storage)
    const checkpoints = new CheckpointService(storage)
    const levels = ref<LevelSummary[]>(service.listLevels())
    const hasProgress = ref(service.hasProgress)
    // Wave each level can be resumed after (between-wave checkpoint), or null.
    const savedWaves = ref<Record<string, number | null>>({})

    function refresh() {
        levels.value = service.listLevels()
        hasProgress.value = service.hasProgress
        savedWaves.value = Object.fromEntries(
            LEVEL_IDS.map((id) => [id, checkpoints.savedWave(id)]),
        )
    }
    refresh()

    function saveCheckpoint(session: GameSession) {
        if (checkpoints.save(session)) refresh()
    }

    function restoreCheckpoint(session: GameSession) {
        return checkpoints.restore(session)
    }

    function clearCheckpoint(levelId: string) {
        checkpoints.clear(levelId)
        refresh()
    }

    function isUnlocked(levelId: string) {
        return service.isUnlocked(levelId)
    }

    function completeLevel(levelId: string, stars: number) {
        service.completeLevel(levelId, stars)
        refresh()
    }

    function prepareLevel(level: Level) {
        return service.prepareLevel(level)
    }

    function recordResult(levelId: string, report: MissionReport) {
        const resolution = service.recordResult(levelId, report)
        refresh()
        return resolution
    }

    function reset() {
        service.reset()
        for (const id of LEVEL_IDS) checkpoints.clear(id)
        refresh()
    }

    return {
        levels,
        hasProgress,
        savedWaves,
        isUnlocked,
        completeLevel,
        prepareLevel,
        recordResult,
        reset,
        saveCheckpoint,
        restoreCheckpoint,
        clearCheckpoint,
    }
})
