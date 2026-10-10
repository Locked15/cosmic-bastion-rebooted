import { describe, expect, it } from 'vitest'
import { createLevel, createSeededRandom } from '@/domain'
import { GameSession } from '../session/GameSession'
import { presentSession } from '../session/presenter'

function newSession(levelId = 'level_1', seed = 1) {
    return new GameSession(createLevel(levelId)!, createSeededRandom(seed))
}

// Answer every open story dialog with its first affordable option.
function answerDialogs(session: GameSession) {
    while (session.activeDialog) {
        const index = session.activeDialog.dialog.choices.findIndex((choice) =>
            session.canAfford(choice.effect),
        )
        session.chooseDialog(Math.max(0, index))
    }
}

function runUntil(session: GameSession, done: () => boolean, maxFrames = 60 * 600) {
    let frames = 0
    while (!done() && frames < maxFrames && !session.ended) {
        answerDialogs(session)
        session.advance(1)
        frames++
    }
    return frames
}

function playLevel(seed: number) {
    const session = newSession('level_1', seed)
    answerDialogs(session)
    session.buildTower(session.slots[0]!.id, 'cannon')
    session.buildTower(session.slots[1]!.id, 'machinegun')
    runUntil(session, () => session.slots[1]!.tower !== null)
    session.startWave()
    runUntil(session, () => !session.waveInProgress)
    return session
}

describe('GameSession', () => {
    it('opens the level intro dialog and applies choice effects', () => {
        const session = newSession()
        expect(session.activeDialog?.dialog.title).toBe('КОМАНДИР МАРКУС')
        session.chooseDialog(0)
        expect(session.activeDialog).toBeNull()

        session.startWave()
        expect(session.activeDialog?.dialog.title).toBe('ИНЖЕНЕР CHEN')
        const before = session.resources
        session.chooseDialog(0)
        expect(session.resources).toBeCloseTo(before + 40)
    })

    it('builds a tower in a slot over time using military personnel', () => {
        const session = newSession()
        answerDialogs(session)
        const slot = session.slots[0]!
        const before = session.resources

        expect(session.buildTower(slot.id, 'rocket').ok).toBe(true)
        expect(session.resources).toBe(before - 80)
        expect(session.buildTower(slot.id, 'cannon').ok).toBe(false)

        runUntil(session, () => slot.tower !== null)
        expect(slot.tower?.type).toBe('rocket')
        expect(session.level.objectives.find((o) => o.id === 'repair_tower')?.completed).toBe(true)
    })

    it('refunds half the cost on demolition', () => {
        const session = newSession()
        answerDialogs(session)
        const slot = session.slots[0]!
        session.buildTower(slot.id, 'cannon')
        const afterBuild = session.resources
        expect(session.demolish(slot.id).ok).toBe(true)
        expect(session.resources).toBe(afterBuild + 25)
        expect(slot.construction).toBeNull()
    })

    it('completes conversions after their duration', () => {
        const session = newSession()
        answerDialogs(session)
        const { miners, military } = session
        expect(session.convert('miner', 'military', 2).ok).toBe(true)
        expect(session.miners).toBe(miners - 2)
        runUntil(session, () => session.conversions.length === 0)
        expect(session.military).toBe(military + 2)
        expect(session.convert('miner', 'military', 999).ok).toBe(false)
    })

    it('plays a wave to completion with a deterministic outcome per seed', () => {
        const first = playLevel(7)
        const second = playLevel(7)
        expect(first.currentWave).toBe(1)
        expect(first.waveInProgress).toBe(false)
        expect(first.stats.killed).toBeGreaterThan(0)
        expect(second.stats).toEqual(first.stats)
        expect(second.resources).toBeCloseTo(first.resources)
    })

    it('ignores time while paused and speeds up when asked', () => {
        const session = newSession()
        answerDialogs(session)
        session.togglePause()
        const before = session.resources
        session.advance(60)
        expect(session.resources).toBe(before)

        session.togglePause()
        session.speedIndex = 2 // ×2
        session.advance(60)
        expect(session.resources - before).toBeCloseTo(session.miners * 0.5 * 2)
    })

    it('declares defeat when too many enemies break through', () => {
        const session = newSession()
        answerDialogs(session)
        session.stats.reached = 10
        session.update(1)
        expect(session.status).toBe('defeat')
        expect(presentSession(session).result?.outcome).toBe('defeat')
    })

    it('presents build options and selection as plain data', () => {
        const session = newSession()
        answerDialogs(session)
        session.buildTower(session.slots[0]!.id, 'cannon')
        session.pointerDown({ x: session.slots[0]!.x, y: session.slots[0]!.y })
        const snapshot = presentSession(session)
        expect(snapshot.buildOptions.map((option) => option.type)).toContain('cannon')
        expect(snapshot.selection?.kind).toBe('tower')
        expect(snapshot.selection?.progress[0]?.label).toBe('Строительство')
        expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    })
})
