import { defineStore } from 'pinia'
import { shallowRef, watch } from 'vue'
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
    type PersonType,
    type Viewport,
} from '@/application'
import { createLevel } from '@/domain'
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

    const snapshot = shallowRef<GameSnapshot | null>(null)
    const selectedBuild = shallowRef<{ category: BuildCategory; type: string } | null>(null)

    let session: GameSession | null = null
    let scheduler: FrameScheduler | null = null
    let viewport: Viewport | null = null
    let reported = false

    watch(
        () => settings.settings.enemySpeed,
        (value) => {
            if (session) session.enemySpeed = value
        },
    )

    function start(levelId: string): boolean {
        stop()
        const level = createLevel(levelId)
        if (!level || !campaign.isUnlocked(levelId)) return false
        session = new GameSession(level, services.createRandom())
        session.enemySpeed = settings.settings.enemySpeed
        reported = false
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

    function tick(frames: number) {
        if (!session) return
        session.advance(frames)
        sync()
    }

    // Publish session state to the UI and react to level completion.
    function sync() {
        if (!session) return
        for (const message of session.drainMessages()) ui.notify(message)
        if (session.result && !reported) {
            reported = true
            if (session.result.outcome === 'victory') {
                campaign.completeLevel(session.level.id, starsFor(session))
            }
        }
        if (!session.pointer.build) selectedBuild.value = null
        snapshot.value = presentSession(session)
    }

    function run(command: (current: GameSession) => CommandResult | void) {
        if (!session) return
        const result = command(session)
        if (result && !result.ok) ui.notify(result.error)
        sync()
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
        if (world) run((current) => current.pointerDown(world))
    }

    function draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        if (!session) return
        viewport = fitViewport(viewRect(session.level, session.view), width, height)
        services.renderScene(ctx, session, width, height)
    }

    // Keyboard shortcuts. Returns true when the key was handled.
    function handleKey(key: string): boolean {
        if (!session) return false
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
                run((current) => current.upgrade(current.selectedId ?? current.pointer.hoverId))
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
        upgradeSelection: () =>
            run((current) => current.upgrade(current.selectedId ?? current.pointer.hoverId)),
        demolishSelection: () =>
            run((current) => current.demolish(current.selectedId ?? current.pointer.hoverId)),
        convert: (from: PersonType, to: PersonType, count: number) =>
            run((current) => current.convert(from, to, count)),
        chooseDialog: (index: number) => run((current) => current.chooseDialog(index)),
    }
})
