import { describe, expect, it } from 'vitest'
import { Campaign, LEVEL_IDS, createLevel } from '@/domain'
import { refugeeEvent, choiceEffect, costText } from '../story/events'
import { technologyUnlocks } from '../story/technology'
import { CAMPAIGN } from '../story/campaign'

describe('story content', () => {
    it.each(LEVEL_IDS)(
        '%s has bounded events, mixed disclosure, frame delays and valid objectives',
        (id) => {
            const level = createLevel(id)!
            expect(level.events.length).toBeLessThanOrEqual(10)
            expect(level.events.some((event) => event.dialog.kind === 'full')).toBe(true)
            expect(level.events.some((event) => event.dialog.kind !== 'full')).toBe(true)
            expect(level.events.some((event) => (event.delay ?? 0) > 0)).toBe(true)
            for (let wave = 0; wave <= level.totalWaves; wave++) {
                expect(
                    level.events.filter((event) => event.wave === wave).length,
                ).toBeLessThanOrEqual(3)
            }
            for (const event of level.events) {
                expect(event.wave).toBeGreaterThanOrEqual(0)
                expect(event.wave).toBeLessThanOrEqual(level.totalWaves)
                for (const choice of event.dialog.choices) {
                    expect(choice.consequence).toBeTruthy()
                    // Hidden dialog labels must not leak costs or rewards.
                    expect(choice.text).not.toMatch(/[+-]\d|\d+ (ресурс|военн|шахт)/)
                }
            }
            for (const event of level.events.filter((event) => event.dialog.timed)) {
                expect(event.dialog.timeLimit).toBeGreaterThanOrEqual(7)
                expect(event.dialog.timeLimit).toBeLessThanOrEqual(15)
            }
            const numeric = level.objectives.filter((objective) =>
                ['activeTowers', 'maxBreaches', 'maxLosses', 'towerLevel'].includes(objective.kind),
            )
            for (const objective of numeric) expect(objective.target).toBeGreaterThanOrEqual(0)
        },
    )

    it('models refugee costs, shrinking groups and a free refusal', () => {
        const event = refugeeEvent(6, 3, 2)
        const [accept, redirect, refuse] = event.dialog.choices
        expect(accept?.cost?.resources).toBeGreaterThan(redirect!.cost!.resources!)
        expect(accept?.effect).toEqual({ type: 'addPersonnel', miners: 6, military: 3 })
        expect(redirect?.effect).toMatchObject({
            effects: expect.arrayContaining([
                { type: 'flag', name: 'refugees_miners', value: 4 },
                { type: 'flag', name: 'refugees_military', value: 2 },
                { type: 'flag', name: 'refugees_from', value: 2 },
            ]),
        })
        expect(choiceEffect(refuse!)).toBeNull()
        expect(costText(accept!)).toContain('80 ресурсов')
    })

    it('keeps the original refugee event aligned with its reusable template', () => {
        expect(createLevel('level_1')!.events.find((event) => event.id === 'refugees')).toEqual(
            refugeeEvent(),
        )
    })

    it('unlocks tower and barricade types linearly, with early flags', () => {
        expect(technologyUnlocks(0, {}).towers).toEqual(['cannon', 'machinegun'])
        expect(technologyUnlocks(0, {}).barricades).toEqual(['wall'])
        expect(technologyUnlocks(1, {}).towers).toContain('rocket')
        expect(technologyUnlocks(1, {}).barricades).toContain('filter')
        const all = technologyUnlocks(2, {})
        expect(all.towers).toEqual(['cannon', 'machinegun', 'rocket', 'laser', 'shock'])
        expect(all.barricades).toContain('shield')
        expect(technologyUnlocks(0, { tech_laser: 1 }).towers).toContain('laser')
        expect(technologyUnlocks(1, { tech_shield: 1 }).barricades).toContain('shield')
        expect(technologyUnlocks(0, { tech_laser: 0 }).towers).not.toContain('laser')
    })

    it('places parallel missions between hull and core and copies campaign flags', () => {
        const sector = (id: string) => CAMPAIGN.sectors.find((entry) => entry.level === id)!
        expect(sector('level_2').requires).toEqual(['level_1'])
        expect(sector('level_3').requires).toEqual(['level_1'])
        expect(sector('level_1').layer).toBe('outer')
        expect(sector(CAMPAIGN.finale).layer).toBe('core')
        const campaign = new Campaign()
        campaign.flags.refugees_pending = 1
        const saved = campaign.toProgress()
        const restored = Campaign.fromProgress(saved)
        saved.flags!.refugees_pending = 0
        expect(campaign.flags.refugees_pending).toBe(1)
        expect(restored.flags.refugees_pending).toBe(1)
        restored.reset()
        expect(restored.flags).toEqual({})
    })
})
