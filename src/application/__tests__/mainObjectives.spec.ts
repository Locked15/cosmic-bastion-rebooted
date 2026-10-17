import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import {
    CAMPAIGN,
    LEVEL_IDS,
    createLevel,
    createSeededRandom,
    levelDefinition,
    levelSchema,
} from '@/domain'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { CampaignService } from '../CampaignService'
import { GameSession } from '../session/GameSession'
import { presentResult, starsFor } from '../session/presenters/result'

// Outcome flags: one branch of a choice sets them, and the story goes on without them.
const RESCUES = ['engineer_saved', 'scientist_saved', 'surgeon_saved', 'foreman_saved']
const BALANCED = ['gardens_saved', 'relic_secured', 'archive_saved']

function session(id: string, withEvents = false) {
    const level = createLevel(id)!
    if (!withEvents) level.events = []
    return new GameSession(level, createSeededRandom(3))
}

function win(value: GameSession) {
    value.status = 'victory'
    value.result = { outcome: 'victory', reason: '' }
    return presentResult(value)!
}

function objective(value: GameSession, id: string) {
    return value.objectives.all.find((candidate) => candidate.id === id)!
}

describe('main and optional objectives in content', () => {
    it.each(LEVEL_IDS)('%s has main survival, two or more optional tasks', (id) => {
        const objectives = levelDefinition(id)!.objectives
        const main = objectives.filter((o) => !o.optional)
        expect(main.map((o) => o.kind).sort()).toEqual(
            main.some((o) => o.kind === 'decision') ? ['decision', 'survive'] : ['survive'],
        )
        expect(objectives.filter((o) => o.optional).length).toBeGreaterThanOrEqual(2)
    })

    it('keeps rescues optional and never rewards a side of a balanced choice', () => {
        const all = LEVEL_IDS.flatMap((id) => levelDefinition(id)!.objectives)
        for (const flag of RESCUES) {
            const rescue = all.find((o) => o.kind === 'flag' && o.flag === flag)
            expect(rescue?.optional).toBe(true)
        }
        expect(all.filter((o) => o.kind === 'flag' && BALANCED.includes(o.flag!))).toEqual([])
        // No main objective depends on a story outcome.
        expect(all.filter((o) => !o.optional && o.kind === 'flag')).toEqual([])
    })

    it('validates decision objectives against the level events', () => {
        const level = structuredClone(levelDefinition('level_1')) as unknown as {
            objectives: Record<string, unknown>[]
            events: { id?: string; dialog: { choices: Record<string, unknown>[] } }[]
        }
        const parse = () => v.safeParse(levelSchema, level).success
        expect(parse()).toBe(true)
        const decision = level.objectives.find((o) => o.kind === 'decision')!
        decision.events = ['nope']
        expect(parse()).toBe(false)
        decision.events = ['engineer_evacuation']
        // Without a free choice a timed-out decision might change nothing.
        const event = level.events.find((e) => e.id === 'engineer_evacuation')!
        const free = event.dialog.choices.pop()!
        expect(parse()).toBe(false)
        event.dialog.choices.push(free)
        delete decision.events
        expect(parse()).toBe(false)
        level.objectives[0]!.optional = true
        decision.events = ['engineer_evacuation']
        expect(parse()).toBe(false)
    })
})

describe('stars and progression', () => {
    it('gives one star for the main tasks and one per optional task, up to three', () => {
        const value = session('level_1')
        expect(starsFor(value)).toBe(0)
        expect(win(value).stars).toBe(1)
        objective(value, 'repair_tower').completed = true
        expect(starsFor(value)).toBe(2)
        objective(value, 'build_barricade').completed = true
        objective(value, 'save_engineer').completed = true
        expect(starsFor(value)).toBe(3)
    })

    it('gives no stars while a main task is open', () => {
        const value = session('level_1')
        for (const o of value.objectives.all) if (o.optional) o.completed = true
        expect(starsFor(value)).toBe(0)
    })

    it('completes a decision whatever was chosen, and on a time-out', () => {
        const level = createLevel('level_1')!
        const event = level.events.find((e) => e.id === 'engineer_evacuation')!
        level.events = [{ ...event, wave: 0, trigger: 'start', delay: 0 }]
        const value = new GameSession(level, createSeededRandom(3))
        expect(value.story.active?.eventId).toBe('engineer_evacuation')
        // "Hold positions": Chen is not saved, but the decision is made.
        expect(value.chooseDialog(1).ok).toBe(true)
        value.objectives.update(value)
        expect(objective(value, 'decision').completed).toBe(true)
        expect(objective(value, 'save_engineer').completed).toBe(false)

        const timed = new GameSession(level, createSeededRandom(3))
        timed.advance(60 * 20)
        timed.objectives.update(timed)
        expect(objective(timed, 'decision').completed).toBe(true)
    })

    it('counts a decision that never came up as made on victory', () => {
        // M-5: neither evacuation event appears when the ward was never decided.
        const value = session('level_7')
        value.objectives.update(value)
        expect(objective(value, 'decision').completed).toBe(false)
        expect(win(value).objectives.find((o) => o.id === 'decision')!.completed).toBe(true)
    })

    it('advances the campaign without the rescue, but not without the main tasks', () => {
        const report = (completed: boolean) => ({
            outcome: 'victory' as const,
            stars: 1,
            flags: {},
            survivors: 10,
            objectives: [
                { id: 'survive', text: '', completed: true, optional: false },
                { id: 'decision', text: '', completed, optional: false },
                { id: 'save_engineer', text: '', completed: false, optional: true },
            ],
        })
        const service = new CampaignService(new MemoryStore())
        expect(service.recordResult('level_1', report(false)).advanced).toBe(false)
        expect(service.isUnlocked('level_2')).toBe(false)
        expect(service.recordResult('level_1', report(true)).advanced).toBe(true)
        expect(service.isUnlocked('level_2')).toBe(true)
        // Without Chen the engines can still be decided: the story reaches the finale.
        const engines = levelDefinition('level_9')!.events.filter((e) =>
            ['engines_with_chen', 'engines_without_chen'].includes(e.id ?? ''),
        )
        expect(engines.map((e) => e.when)).toEqual([
            [{ flag: 'engineer_saved', atLeast: 1 }],
            [{ flag: 'engineer_saved', below: 1 }],
        ])
        expect(CAMPAIGN.finale).toBe('level_5')
    })
})
