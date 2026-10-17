import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import {
    CampaignService,
    CheckpointService,
    type GameSession,
    type LevelSummary,
    type CrewDeckView,
    type FacilityView,
    type MissionReport,
    type SceneView,
} from '@/application'
import { LEVEL_IDS } from '@/domain'
import type { Level } from '@/domain'
import { useServices } from './services'
import { useSettingsStore } from './settingsStore'

export const useCampaignStore = defineStore('campaign', () => {
    const { storage, profiles } = useServices()
    const settingsStore = useSettingsStore()
    // Romance needs the officer's consent at registration and the scenes it is built in.
    const createService = () =>
        new CampaignService(storage, {
            romance: () => settingsStore.settings.crewScenes && profiles.romance,
        })
    let service = createService()
    const checkpoints = new CheckpointService(storage)
    const levels = ref<LevelSummary[]>(service.listLevels(profiles.difficulty))
    const hasProgress = ref(service.hasProgress)
    // Wave each level can be resumed after (between-wave checkpoint), or null.
    const savedWaves = ref<Record<string, number | null>>({})
    // Scenes waiting in the wardroom (none when crew scenes are off).
    const pendingScenes = ref<SceneView[]>([])
    // The wardroom's deck plan: cabins with their characters' standing and waiting scenes.
    const crewDeck = ref<CrewDeckView>(service.crewDeck([]))
    // Service rooms on the ship map; locked until their sectors are won.
    const facilities = ref<FacilityView[]>(service.facilities())
    // The scene on screen; `reply` is set once a choice was made.
    const activeScene = ref<{ scene: SceneView; reply: string | null } | null>(null)
    let sceneQueue: SceneView[] = []
    let sceneDone: (() => void) | null = null

    function refresh() {
        levels.value = service.listLevels(profiles.difficulty)
        hasProgress.value = service.hasProgress
        pendingScenes.value = settingsStore.settings.crewScenes ? service.scenesAfterMissions() : []
        crewDeck.value = service.crewDeck(pendingScenes.value)
        facilities.value = service.facilities()
        savedWaves.value = Object.fromEntries(
            LEVEL_IDS.map((id) => [id, checkpoints.savedWave(id)]),
        )
    }
    refresh()
    watch(() => settingsStore.settings.crewScenes, refresh)

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

    function isFacilityOpen(id: string) {
        return service.isFacilityOpen(id)
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

    // Re-read after the active profile changed.
    function reload() {
        service = createService()
        refresh()
    }

    function showNextScene() {
        const next = sceneQueue.shift()
        activeScene.value = next ? { scene: next, reply: null } : null
        if (!next) {
            refresh()
            sceneDone?.()
            sceneDone = null
        }
    }

    function playScenes(scenes: SceneView[]): Promise<void> {
        if (!scenes.length) return Promise.resolve()
        sceneQueue = [...scenes]
        showNextScene()
        return new Promise((resolve) => (sceneDone = resolve))
    }

    // The player opens waiting scenes in the wardroom (all of them, or one character's);
    // nothing plays by itself.
    function openPendingScenes(characterId?: string): Promise<void> {
        const scenes = settingsStore.settings.crewScenes ? service.scenesAfterMissions() : []
        return playScenes(
            characterId ? scenes.filter((scene) => scene.speakerId === characterId) : scenes,
        )
    }

    // Before a mission starts, its scenes play (each can be skipped).
    function playScenesBefore(levelId: string): Promise<void> {
        return playScenes(settingsStore.settings.crewScenes ? service.scenesBefore(levelId) : [])
    }

    function chooseScene(index: number) {
        const active = activeScene.value
        if (!active || active.reply !== null) return
        const reply = service.chooseScene(active.scene.id, index)
        if (reply !== null) activeScene.value = { ...active, reply }
    }

    function skipScene() {
        const active = activeScene.value
        if (!active) return
        if (active.reply === null) service.skipScene(active.scene.id)
        showNextScene()
    }

    // Close the reply and go on to the next scene.
    function continueScenes() {
        if (activeScene.value?.reply !== null) showNextScene()
    }

    // Leave the remaining scenes for later (they stay pending on the ship map).
    function closeScenes() {
        sceneQueue = []
        showNextScene()
    }

    return {
        crewDeck,
        facilities,
        isFacilityOpen,
        pendingScenes,
        activeScene,
        openPendingScenes,
        playScenesBefore,
        chooseScene,
        skipScene,
        continueScenes,
        closeScenes,
        levels,
        hasProgress,
        savedWaves,
        isUnlocked,
        completeLevel,
        prepareLevel,
        recordResult,
        reload,
        saveCheckpoint,
        restoreCheckpoint,
        clearCheckpoint,
    }
})
