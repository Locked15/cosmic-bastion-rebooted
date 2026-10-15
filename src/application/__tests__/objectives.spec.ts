import { describe, expect, it } from 'vitest'
import { createLevel, createSeededRandom } from '@/domain'
import { GameSession } from '../session/GameSession'
import { presentResult, starsFor } from '../session/presenters/result'

function sessionFor(id = 'level_3') {
    const level = createLevel(id)!
    level.events = []
    return new GameSession(level, createSeededRandom(2))
}

function end(session: GameSession, outcome: 'victory' | 'defeat') {
    session.status = outcome
    session.result = { outcome, reason: outcome === 'defeat' ? 'Отсек потерян' : '' }
    return presentResult(session)!
}

describe('objectives', () => {
    it('counts active towers, excludes construction and disabled towers, and retains the reached milestone', () => {
        const session = sessionFor()
        const objective = session.objectives.all.find((objective) => objective.id === 'max_towers')!
        objective.target = 2
        session.resources = 10000
        session.buildTower(session.slots[0]!.id, 'cannon')
        session.buildTower(session.slots[1]!.id, 'cannon')
        expect(session.objectives.update(session)).toEqual([])
        for (let frame = 0; frame < 1000; frame++) session.update(1)
        expect(objective.completed).toBe(true)
        expect(session.level.objectivesCompleted.max_towers).toBe(true)
        session.slots[0]!.tower!.active = false
        session.objectives.update(session)
        expect(objective.completed).toBe(true)

        const second = sessionFor()
        second.resources = 10000
        second.buildTower(second.slots[0]!.id, 'cannon')
        for (let frame = 0; frame < 1000; frame++) second.update(1)
        const target = second.objectives.all.find((objective) => objective.id === 'max_towers')!
        target.target = 1
        second.slots[0]!.tower!.disabled = true
        second.objectives.update(second)
        expect(target.completed).toBe(false)
        second.slots[0]!.tower!.disabled = false
        expect(second.objectives.update(second)).toContain(target.text)
        expect(second.objectives.update(second)).toEqual([])
    })

    it('reads numeric targets from older custom objective text', () => {
        const session = sessionFor()
        const objective = session.objectives.all.find((objective) => objective.id === 'max_towers')!
        delete objective.target
        objective.text = 'Иметь минимум 1 активную башню'
        session.buildTower(session.slots[0]!.id, 'cannon')
        for (let frame = 0; frame < 1000; frame++) session.update(1)
        expect(objective.completed).toBe(true)
    })

    it.each([
        ['save_reactor', 'reached', 'level_4', 2],
        ['no_personnel_loss', 'lost', 'level_5', 5],
    ] as const)(
        '%s stays pending until victory, passes at N, fails at N+1',
        (id, stat, level, limit) => {
            const session = sessionFor(level)
            const objective = session.objectives.all.find((objective) => objective.id === id)!
            session.stats[stat] = limit
            session.objectives.update(session)
            expect(objective.completed).toBe(false)
            expect(
                end(session, 'victory').objectives.find((objective) => objective.id === id)
                    ?.completed,
            ).toBe(true)
            const failed = sessionFor(level)
            failed.stats[stat] = limit + 1
            failed.objectives.update(failed)
            // Once violated, a whole-mission condition cannot recover.
            failed.stats[stat] = 0
            expect(
                end(failed, 'victory').objectives.find((objective) => objective.id === id)
                    ?.completed,
            ).toBe(false)
        },
    )

    it('requires no breaches at all for the final reactor and does not award end objectives on defeat', () => {
        const clean = sessionFor('level_5')
        expect(
            end(clean, 'victory').objectives.find((objective) => objective.id === 'save_reactor')
                ?.completed,
        ).toBe(true)
        const breached = sessionFor('level_5')
        breached.stats.reached = 1
        expect(
            end(breached, 'victory').objectives.find((objective) => objective.id === 'save_reactor')
                ?.completed,
        ).toBe(false)
        const failed = sessionFor('level_5')
        const result = end(failed, 'defeat')
        expect(result.objectives.every((objective) => !objective.completed)).toBe(true)
        expect(result.stars).toBe(0)
    })

    it('waits for the actual upgrade target, not just any upgrade', () => {
        const session = sessionFor()
        session.buildTower(session.slots[0]!.id, 'cannon')
        for (let frame = 0; frame < 1000; frame++) session.update(1)
        const tower = session.slots[0]!.tower!
        const objective = session.objectives.all.find(
            (objective) => objective.id === 'upgrade_tower',
        )!
        tower.level = 1
        session.objectives.update(session)
        expect(objective.completed).toBe(false)
        tower.level = 2
        session.objectives.update(session)
        expect(objective.completed).toBe(true)
    })

    it('tracks story objectives from flags and exposes checked results', () => {
        const session = sessionFor('level_1')
        session.story.flags.engineer_saved = 1
        expect(session.objectives.update(session)).toContain('Эвакуировать инженера Чена')
        const defeat = end(session, 'defeat')
        expect(
            defeat.objectives.find((objective) => objective.id === 'save_engineer')?.completed,
        ).toBe(true)
        expect(defeat.objectives.find((objective) => objective.id === 'survive')?.completed).toBe(
            false,
        )
        const victory = sessionFor('level_5')
        victory.story.flags.archive_saved = 1
        const result = end(victory, 'victory')
        expect(result.stars).toBe(3)
        expect(starsFor(victory)).toBe(3)
        expect(JSON.parse(JSON.stringify(result))).toEqual(result)
    })
})
