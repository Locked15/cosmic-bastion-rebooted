import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import {
    GameSession,
    fitViewport,
    presentSession,
    screenToWorld,
    starsFor,
    viewRect,
    type BuildCategory,
    type CommandResult,
    type FrameScheduler,
    type GameSnapshot,
    type CampaignResolution,
    type PersonType,
    type Viewport,
} from '@/application'
import { createLevel } from '@/domain'
import { useAchievementsStore } from './achievementsStore'
import { useCampaignStore } from './campaignStore'
import { useServices } from './services'
import { useSettingsStore } from './settingsStore'
import { useUiStore } from './uiStore'

// Bridges the running GameSession and the UI. The session itself is not reactive;
// the UI reads `snapshot`, refreshed after every simulated tick.
export const useGameStore = defineStore('game', () => {
    const services = useServices()
    const ui = useUiStore()
    const campaign = useCampaignStore()
    const settings = useSettingsStore()
    const achievements = useAchievementsStore()
    const { sound } = services

    const snapshot = shallowRef<GameSnapshot | null>(null)
    const selectedBuild = shallowRef<{ category: BuildCategory; type: string } | null>(null)

    let session: GameSession | null = null
    let scheduler: FrameScheduler | null = null
    let viewport: Viewport | null = null
    let reported = false
    let resolution: CampaignResolution | null = null
    // Previous values used to turn state changes into sounds and saves.
    let seen = { wave: 0, inProgress: false, dialog: false, reached: 0 }
    let ticksSinceAchievementCheck = 0

    // `resume` continues from the level's between-wave checkpoint if there is one.
    function start(levelId: string, resume = false): boolean {
        stop()
        const level = createLevel(levelId)
        if (!level || !campaign.isUnlocked(levelId)) return false
        session = new GameSession(level, services.createRandom(), {
            ...campaign.prepareLevel(level),
            difficulty: settings.settings.difficulty,
        })
        if (!resume || !campaign.restoreCheckpoint(session)) campaign.clearCheckpoint(levelId)
        seen = {
            wave: session.currentWave,
            inProgress: false,
            dialog: !!session.activeDialog,
            reached: session.stats.reached,
        }
        reported = false
        resolution = null
        scheduler = services.createScheduler()
        scheduler.start((frames) => tick(frames))
        sync()
        return true
    }

    function stop() {
        scheduler?.stop()
        scheduler = null
        session = null
        snapshot.value = null
        selectedBuild.value = null
    }

    function restart() {
        if (session) start(session.level.id)
    }

    // Sounds, checkpoints and achievements driven by changes in the session.
    function react(current: GameSession) {
        if (current.currentWave > seen.wave) sound.play('waveStart')
        if (seen.inProgress && !current.waveInProgress && !current.ended) {
            sound.play('waveClear')
            campaign.saveCheckpoint(current)
        }
        if (!seen.dialog && current.activeDialog) sound.play('dialog')
        if (current.stats.reached > seen.reached) sound.play('breach')
        seen = {
            wave: current.currentWave,
            inProgress: current.waveInProgress,
            dialog: !!current.activeDialog,
            reached: current.stats.reached,
        }
        if (++ticksSinceAchievementCheck >= 60) {
            ticksSinceAchievementCheck = 0
            achievements.check(current)
        }
    }

    function tick(frames: number) {
        if (!session) return
        session.advance(frames)
        sync()
    }

    // Publish session state to the UI and react to level completion.
    function sync() {
        if (!session) return
        for (const message of session.drainMessages()) ui.notify(message)
        react(session)
        if (session.result && !reported) {
            reported = true
            sound.play(session.result.outcome)
            achievements.check(session)
            campaign.clearCheckpoint(session.level.id)
            session.objectives.update(session)
            resolution = campaign.recordResult(session.level.id, {
                outcome: session.result.outcome,
                stars: starsFor(session),
                flags: session.story.flags,
                objectives: session.objectives.all,
                survivors: session.personnel.total + session.personnel.inTransit,
            })
        }
        if (!session.pointer.build) selectedBuild.value = null
        const next = presentSession(session)
        if (next.result && resolution) {
            next.result.unlocks = resolution.unlocks
        }
        snapshot.value = next
    }

    function run(command: (current: GameSession) => CommandResult | void): CommandResult | void {
        if (!session) return
        const result = command(session)
        if (result && !result.ok) ui.notify(result.error)
        sync()
        return result
    }

    function upgradeSelection() {
        run((current) => current.upgrade(current.selectedId ?? current.pointer.hoverId))
    }

    function selectBuild(category: BuildCategory, type: string) {
        const same = selectedBuild.value?.category === category && selectedBuild.value.type === type
        run((current) => (same ? current.clearBuildMode() : current.setBuildMode(category, type)))
        selectedBuild.value = same ? null : { category, type }
    }

    function toWorld(x: number, y: number) {
        return viewport ? screenToWorld(viewport, x, y) : null
    }

    function pointerMove(x: number, y: number) {
        run((current) => current.pointerMove(toWorld(x, y)))
    }

    function pointerDown(x: number, y: number) {
        const world = toWorld(x, y)
        if (!world || !session) return
        const building = !!session.pointer.build
        const result = run((current) => current.pointerDown(world))
        if (building && result?.ok) sound.play('build')
    }

    function draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        if (!session) return
        viewport = fitViewport(viewRect(session.level, session.view), width, height)
        services.renderScene(ctx, session, width, height)
    }

    // Keyboard shortcuts. Returns true when the key was handled.
    function handleKey(key: string): boolean {
        if (!session) return false
        if (session.story.active) {
            if (key === 'Enter' && session.story.active.phase === 'consequence') {
                run((current) => {
                    current.story.acknowledge()
                })
            }
            return true
        }
        switch (key) {
            case 'Escape':
                if (session.pointer.build) run((current) => current.clearBuildMode())
                else if (session.selectedId) run((current) => current.deselect())
                else run((current) => current.togglePause())
                return true
            case ' ':
                run((current) => current.startWave())
                return true
            case 'v':
            case 'V':
            case 'м':
            case 'М':
                run((current) => current.toggleView())
                return true
            case 'u':
            case 'U':
            case 'г':
            case 'Г':
                upgradeSelection()
                return true
            default:
                return false
        }
    }

    return {
        snapshot,
        selectedBuild,
        start,
        stop,
        restart,
        draw,
        pointerMove,
        pointerDown,
        handleKey,
        selectBuild,
        startWave: () => run((current) => current.startWave()),
        togglePause: () => run((current) => current.togglePause()),
        cycleSpeed: () => run((current) => current.cycleSpeed()),
        toggleView: () => run((current) => current.toggleView()),
        upgradeSelection,
        repairSelection: () =>
            run((current) => current.repair(current.selectedId ?? current.pointer.hoverId)),
        demolishSelection: () =>
            run((current) => current.demolish(current.selectedId ?? current.pointer.hoverId)),
        convert: (from: PersonType, to: PersonType, count: number) =>
            run((current) => current.convert(from, to, count)),
        acknowledgeDialog: () =>
            run((current) => {
                const error = current.story.acknowledge()
                return error ? { ok: false, error } : { ok: true }
            }),
        chooseDialog: (index: number) => run((current) => current.chooseDialog(index)),
    }
})
