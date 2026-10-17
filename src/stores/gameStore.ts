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
import { findDirective } from '@/application/session/directives'
import { DIFFICULTIES, createLevel } from '@/domain'
import { useAchievementsStore } from './achievementsStore'
import { useCampaignStore } from './campaignStore'
import { useProfileStore } from './profileStore'
import { useRequisitionStore } from './requisitionStore'
import { useServices } from './services'
import { useUiStore } from './uiStore'

// Bridges the running GameSession and the UI. The session itself is not reactive;
// the UI reads `snapshot`, refreshed after every simulated tick.
export const useGameStore = defineStore('game', () => {
    const services = useServices()
    const ui = useUiStore()
    const campaign = useCampaignStore()
    const achievements = useAchievementsStore()
    const requisitions = useRequisitionStore()
    const { sound } = services

    const snapshot = shallowRef<GameSnapshot | null>(null)
    const selectedBuild = shallowRef<{ category: BuildCategory; type: string } | null>(null)

    let session: GameSession | null = null
    let scheduler: FrameScheduler | null = null
    let viewport: Viewport | null = null
    let reported = false
    let resolution: CampaignResolution | null = null
    let reward: number | null = null
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
            // The rank of the profile, fixed at registration.
            difficulty: services.profiles.difficulty,
            bonuses: requisitions.bonuses(),
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
        reward = null
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
            if (!current.overrides.used) achievements.check(current)
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
            if (!session.overrides.used) achievements.check(session)
            campaign.clearCheckpoint(session.level.id)
            session.objectives.update(session)
            resolution = campaign.recordResult(session.level.id, {
                outcome: session.result.outcome,
                stars: starsFor(session),
                flags: session.story.flags,
                objectives: session.objectives.all,
                survivors: session.personnel.total + session.personnel.inTransit,
                difficulty: session.difficulty,
            })
            if (!session.overrides.used) {
                const won = session.result.outcome === 'victory'
                reward = requisitions.award(
                    session.level.id,
                    {
                        outcome: session.result.outcome,
                        stars: starsFor(session),
                        wavesHeld: Math.max(0, session.currentWave - (won ? 0 : 1)),
                    },
                    DIFFICULTIES[session.difficulty].requisitions,
                )
            }
        }
        if (!session.pointer.build) selectedBuild.value = null
        const next = presentSession(session)
        if (next.result && resolution) {
            next.result.unlocks = resolution.unlocks
            next.result.ending = resolution.ending
            next.result.advanced = resolution.advanced
            next.result.requisitions = reward
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

    // Dev console directives; compiled out of production builds.
    function enter(input: string): string {
        if (!import.meta.env.DEV) return ''
        const directive = findDirective(input)
        if (!directive) return 'Неизвестная команда'
        if (directive.kind === 'rank') {
            const label = DIFFICULTIES[directive.difficulty].label
            void useProfileStore()
                .overrideRank(directive.difficulty)
                .then((done) => done && ui.notify(`Код принят: звание «${label}»`))
            return `Звание «${label}» — со следующей миссии`
        }
        if (directive.kind === 'flag') {
            const value = campaign.setFlag(directive.flag, directive.value)
            // The mission writes its flags back when it ends: keep its copy in step.
            if (session) session.story.flags[directive.flag] = value
            const text = `Код принят: ${directive.label} — ${value ? 'вкл' : 'выкл'}`
            ui.notify(text)
            return text
        }
        if (!session) return 'Нет активной миссии'
        const result = run(directive.run)
        if (!result?.ok) return result?.error ?? ''
        const state = 'state' in result ? result.state : undefined
        const text = state === undefined ? 'Код принят' : `Код принят: ${state ? 'вкл' : 'выкл'}`
        ui.notify(text)
        return text
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
        enter,
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
