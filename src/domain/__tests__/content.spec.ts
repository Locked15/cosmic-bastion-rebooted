import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import {
    CAMPAIGN,
    ENDINGS,
    LEVEL_IDS,
    flagsMatch,
    levelDefinition,
    levelSchema,
    resolveEnding,
} from '@/domain'

const files = import.meta.glob<unknown>('@/content/levels/*.json', {
    eager: true,
    import: 'default',
})

function withLevel(change: (level: Record<string, unknown>) => void) {
    const level = structuredClone(levelDefinition('level_1')) as unknown as Record<string, unknown>
    change(level)
    return v.safeParse(levelSchema, level)
}

describe('content files', () => {
    it('puts every level file on the campaign map', () => {
        expect(Object.keys(files)).toHaveLength(LEVEL_IDS.length)
        expect(LEVEL_IDS).toContain(CAMPAIGN.finale)
    })

    it('accepts the shipped level and rejects malformed ones', () => {
        expect(withLevel(() => {}).success).toBe(true)
        expect(withLevel((level) => (level.typo = 1)).success).toBe(false)
        expect(withLevel((level) => (level.type = 'boss')).success).toBe(false)
        expect(
            withLevel((level) => {
                const paths = level.paths as { base: { x: number; y: number }[] }
                paths.base = [
                    { x: 0, y: 0 },
                    { x: 100, y: 100 },
                ]
            }).success,
        ).toBe(false)
        expect(
            withLevel((level) => {
                const events = level.events as unknown[]
                level.events = [...events, ...events].map((event) => ({
                    ...(event as object),
                    wave: 1,
                }))
            }).success,
        ).toBe(false)
        expect(
            withLevel((level) => {
                level.objectives = [{ id: 'x', text: 'Флаг', kind: 'flag' }]
            }).success,
        ).toBe(false)
    })

    it('rejects unknown effect types and fields in nested transactions', () => {
        const event = (effect: unknown) =>
            withLevel((level) => {
                const [first] = level.events as { dialog: { choices: { effect: unknown }[] } }[]
                first!.dialog.choices[0]!.effect = effect
            }).success
        expect(
            event({
                type: 'transaction',
                cost: {},
                effects: [{ type: 'flag', name: 'a_b', value: 1 }],
            }),
        ).toBe(true)
        expect(event({ type: 'transaction', cost: {}, effects: [{ type: 'nuke' }] })).toBe(false)
        expect(event({ type: 'flag', name: 'Bad Name', value: 1 })).toBe(false)
    })
})

describe('flag conditions and endings', () => {
    it('checks lower and upper bounds', () => {
        expect(flagsMatch({ a: 2 }, [{ flag: 'a', atLeast: 2 }])).toBe(true)
        expect(flagsMatch({ a: 2 }, [{ flag: 'a', below: 2 }])).toBe(false)
        expect(flagsMatch({}, [{ flag: 'a', below: 1 }])).toBe(true)
        expect(flagsMatch({}, [])).toBe(true)
    })

    it('picks the first matching ending and appends notes', () => {
        expect(resolveEnding('defeat', { engines_restored: 1 }).id).toBe('communion')
        expect(resolveEnding('victory', {}).id).toBe('bastion')
        expect(resolveEnding('victory', { engines_restored: 1 }).id).toBe('bastion')
        const ascent = resolveEnding('victory', {
            engines_restored: 1,
            engineer_saved: 1,
            archive_saved: 1,
        })
        expect(ascent.id).toBe('ascent')
        expect(ascent.paragraphs.length).toBe(
            ENDINGS.find((e) => e.id === 'ascent')!.text.length + 1,
        )
        expect(resolveEnding('victory', { ending_renunciation: 1, engines_restored: 1 }).id).toBe(
            'renunciation',
        )
    })
})
