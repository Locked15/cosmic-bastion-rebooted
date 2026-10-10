import { describe, expect, it, vi } from 'vitest'
import { createLevel, createSeededRandom, type LevelEvent, type StoryDialog } from '@/domain'
import { refugeeEvent } from '@/domain/story/events'
import { GameSession } from '../session/GameSession'
import { StoryDirector } from '../session/story'
import { presentDialog } from '../session/presenters/dialog'
import { applyEffect } from '../session/effects'

function dialog(kind: StoryDialog['kind'] = 'full'): StoryDialog {
    return {
        kind,
        title: 'Событие',
        text: 'Решите',
        timed: true,
        timeLimit: 10,
        choices: [
            {
                text: 'Принять',
                cost: { resources: 50 },
                consequence: 'Секретный результат',
                effect: { type: 'addMiners', count: 2 },
            },
            { text: 'Отказать', effect: null, consequence: 'Без изменений' },
        ],
    }
}

function sessionWith(dialogs: LevelEvent[]) {
    const level = createLevel('level_1')!
    level.events = dialogs
    return new GameSession(level, createSeededRandom(1))
}

describe('story choices and consequences', () => {
    it.each(['full', 'partial', 'unknown'] as const)(
        '%s applies effects exactly once with the right disclosure',
        (kind) => {
            const session = sessionWith([{ wave: 0, trigger: 'start', dialog: dialog(kind) }])
            const view = presentDialog(session)!
            expect(view.choices[0]?.hint).toBe(
                kind === 'full' ? 'Стоимость: 50 ресурсов · Секретный результат' : '',
            )
            const resources = session.resources
            const miners = session.miners
            expect(session.chooseDialog(0)).toEqual({ ok: true })
            expect(session.resources).toBe(resources - 50)
            expect(session.miners).toBe(miners + 2)
            expect(session.story.active?.phase ?? null).toBe(
                kind === 'unknown' ? null : 'consequence',
            )
        },
    )

    it.each(['full', 'partial'] as const)(
        '%s keeps consequences open until acknowledgement without repeating effects',
        (kind) => {
            const session = sessionWith([{ wave: 0, trigger: 'start', dialog: dialog(kind) }])
            session.chooseDialog(0)
            expect(session.story.active?.phase).toBe('consequence')
            expect(presentDialog(session)).toMatchObject({
                text: 'Секретный результат',
                choices: [],
                secondsLeft: null,
            })
            session.story.tick(60 * 100)
            expect(session.story.active?.phase).toBe('consequence')
            expect(session.story.choose(1)).toBeTruthy()
            expect(session.resources).toBe(200)
            expect(session.story.acknowledge()).toBeNull()
            expect(session.story.active).toBeNull()
            expect(session.story.acknowledge()).toBeTruthy()
        },
    )

    it('keeps x0.5 through the consequence window then restores player speed', () => {
        const session = sessionWith([{ wave: 0, trigger: 'start', dialog: dialog() }])
        session.speedIndex = 4
        let before = session.resources
        session.advance(60)
        expect(session.resources - before).toBeCloseTo(session.miners * 0.5 * 0.5)
        session.chooseDialog(1)
        before = session.resources
        session.advance(60)
        expect(session.resources - before).toBeCloseTo(session.miners * 0.5 * 0.5)
        session.story.acknowledge()
        before = session.resources
        session.advance(60)
        expect(session.resources - before).toBeCloseTo(session.miners * 0.5 * 8)
        expect(session.speed).toBe(8)
    })

    it.each(['resources', 'miners', 'military'] as const)(
        'blocks unaffordable %s costs even for hidden choices',
        (cost) => {
            const event = dialog('partial')
            event.choices[0]!.cost = { [cost]: 9999 }
            const session = sessionWith([{ wave: 0, trigger: 'start', dialog: event }])
            expect(presentDialog(session)?.choices[0]?.disabled).toBe(true)
            const before = [session.resources, session.miners, session.military]
            expect(session.chooseDialog(0).ok).toBe(false)
            expect(session.story.active?.phase).toBe('choice')
            expect([session.resources, session.miners, session.military]).toEqual(before)
        },
    )

    it('checks nested costs as a single transaction and charges them only once', () => {
        const event = dialog()
        event.choices[0]!.effect = { type: 'transaction', cost: { resources: 220 }, effects: [] }
        const session = sessionWith([{ wave: 0, trigger: 'start', dialog: event }])
        expect(session.chooseDialog(0).ok).toBe(false) // 50 + 220 > 250
        session.resources = 300
        expect(session.chooseDialog(0).ok).toBe(true)
        expect(session.resources).toBe(30)
        session.story.acknowledge()
        expect(session.resources).toBe(30)
    })

    it('checks conversion and superweapon personnel requirements', () => {
        const session = sessionWith([])
        expect(session.canAfford({ type: 'convert', count: session.miners + 1 })).toBe(false)
        expect(session.canAfford({ type: 'superWeapon', military: -99, killPercent: 0.6 })).toBe(
            false,
        )
    })

    it('applies both existing story buffs and persists early technology flags', () => {
        const session = sessionWith([])
        applyEffect(session, { type: 'buffDamage', value: 1.3 })
        applyEffect(session, { type: 'buffBarricades', value: 1.6 })
        applyEffect(session, { type: 'unlockTower', tower: 'laser' })
        applyEffect(session, { type: 'unlockBarricade', barricade: 'shield' })
        expect(session.damageMultiplier).toBeCloseTo(1.3)
        expect(session.barricadeMultiplier).toBeCloseTo(1.6)
        expect(session.story.flags).toMatchObject({ tech_laser: 1, tech_shield: 1 })
    })
})

describe('story scheduling', () => {
    it('opens delayed events once, after the specified frames, and pauses with the game', () => {
        const session = sessionWith([{ wave: 1, trigger: 'delay', delay: 120, dialog: dialog() }])
        session.startWave()
        session.advance(119)
        expect(session.story.active).toBeNull()
        session.togglePause()
        session.advance(1000)
        expect(session.story.active).toBeNull()
        session.togglePause()
        session.advance(1)
        expect(session.story.active?.phase).toBe('choice')
        session.chooseDialog(1)
        session.story.acknowledge()
        session.advance(120)
        expect(session.story.active).toBeNull()
    })

    it('never schedules more than three per wave or ten per level', () => {
        const events = Array.from({ length: 20 }, (_, index) => ({
            wave: Math.floor(index / 4),
            trigger: 'start' as const,
            dialog: dialog('unknown'),
        }))
        const apply = vi.fn()
        const story = new StoryDirector(events, { canAfford: () => true, applyEffect: apply })
        for (let wave = 0; wave < 5; wave++) {
            const before = apply.mock.calls.length
            story.onWaveStart(wave)
            story.onWaveStart(wave)
            while (story.active) story.choose(1)
            expect(apply.mock.calls.length - before).toBeLessThanOrEqual(3)
        }
        expect(apply).toHaveBeenCalledTimes(10)
    })

    it.each([1, 30])(
        'clamps timer %s into the brief range and falls back to an affordable choice',
        (seconds) => {
            const event = dialog('partial')
            event.timeLimit = seconds
            event.choices[1]!.cost = { resources: 9999 }
            const session = sessionWith([{ wave: 0, trigger: 'start', dialog: event }])
            const frames = Math.min(15, Math.max(7, seconds)) * 60
            expect(session.story.active?.framesLeft).toBe(frames)
            session.story.tick(frames)
            expect(session.story.active?.phase).toBe('consequence')
            expect(session.resources).toBe(200)
        },
    )

    it('keeps condition-dependent events pending until a prior choice sets the flag', () => {
        const session = sessionWith([
            {
                wave: 0,
                trigger: 'start',
                dialog: {
                    ...dialog('unknown'),
                    choices: [
                        { text: 'Сигнал', effect: { type: 'flag', name: 'signal', value: 1 } },
                    ],
                },
            },
            {
                wave: 0,
                trigger: 'delay',
                delay: 10,
                condition: { flag: 'signal', atLeast: 1 },
                dialog: dialog(),
            },
        ])
        session.story.tick(10)
        session.chooseDialog(0)
        expect(session.story.active).toBeNull()
        session.story.tick(1)
        expect(session.story.active?.dialog.title).toBe('Событие')
    })
})

describe('refugees', () => {
    it('accepts with resource payment and both personnel rewards', () => {
        const event = { ...refugeeEvent(), wave: 0, trigger: 'start' as const, delay: 0 }
        const session = sessionWith([event])
        session.chooseDialog(0)
        expect(session.resources).toBe(170)
        expect(session.miners).toBe(18)
        expect(session.military).toBe(9)
    })

    it('redirects a smaller group to a different next sector, consumes the pending flag and can refuse for free', () => {
        const source = sessionWith([{ ...refugeeEvent(), wave: 0, delay: 0 }])
        source.chooseDialog(1)
        expect(source.resources).toBe(220)
        expect(source.story.flags).toMatchObject({
            refugees_pending: 1,
            refugees_miners: 4,
            refugees_military: 2,
        })
        const same = new StoryDirector(
            [],
            { canAfford: () => true, applyEffect: () => {} },
            { ...source.story.flags, mission_index: 1 },
        )
        same.onWaveStart(0)
        expect(same.active).toBeNull()
        const level = createLevel('level_3')!
        level.events = []
        const next = new GameSession(level, createSeededRandom(2), {
            campaignFlags: { ...source.story.flags, mission_index: 3 },
        })
        expect(next.story.active?.dialog.text).toContain('4 шахтёра и 2 военных')
        expect(next.story.flags.refugees_pending).toBe(0)
        expect(source.story.flags.refugees_pending).toBe(1)
        const before = [next.resources, next.miners, next.military]
        next.chooseDialog(2)
        expect([next.resources, next.miners, next.military]).toEqual(before)
    })
})
