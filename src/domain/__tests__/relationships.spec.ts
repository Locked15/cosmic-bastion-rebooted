import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import {
    CAMPAIGN,
    CAST,
    CHARACTER_IDS,
    COMMITMENT_SCENE_ID,
    DIFFICULTY_IDS,
    LEVEL_IDS,
    ROMANCE_IDS,
    SCENES,
    affection,
    allLevelsAtDifficulty,
    applyRelationship,
    campaignMissions,
    conditionsHold,
    countAllies,
    disposition,
    effectSchema,
    levelDefinition,
    needsCommitment,
    playScene,
    resolveEnding,
    romancePartner,
    scenesAfterMissions,
    scenesBeforeMission,
    skipScene,
    standing,
    storyConditionSchema,
    type StoryFlags,
} from '@/domain'
import scenesData from '@/content/scenes.json'
import epiloguesData from '@/content/epilogues.json'
import endingsData from '@/content/endings.json'

const romanceAt = CAST.romanceAt
const highest = DIFFICULTY_IDS[DIFFICULTY_IDS.length - 1]!
const everyMission = (difficulty = highest) =>
    Object.fromEntries(campaignMissions().map((id) => [id, difficulty]))

function progress(flags: StoryFlags, completedLevels: string[] = [], romance = true) {
    return { flags, completedLevels, romance }
}

describe('relationship model', () => {
    it('changes affection together with disposition for romanceable characters', () => {
        const flags: StoryFlags = {}
        applyRelationship(flags, { character: 'kirch', disposition: 2 })
        expect(disposition(flags, 'kirch')).toBe(2)
        expect(affection(flags, 'kirch')).toBe(2)
        applyRelationship(flags, { character: 'kirch', disposition: 1, affection: 3 })
        expect([disposition(flags, 'kirch'), affection(flags, 'kirch')]).toEqual([3, 5])
        // Explicit 0 keeps a choice professional.
        applyRelationship(flags, { character: 'kirch', disposition: 1, affection: 0 })
        expect(affection(flags, 'kirch')).toBe(5)
    })

    it('changes only reputation for characters without romance', () => {
        const flags: StoryFlags = {}
        applyRelationship(flags, { character: 'voss', disposition: -2 })
        expect(disposition(flags, 'voss')).toBe(-2)
        expect(flags.aff_voss).toBeUndefined()
    })

    it('clamps both values to the range and labels the standing', () => {
        const flags: StoryFlags = {}
        applyRelationship(flags, { character: 'hale', disposition: 99 })
        expect(disposition(flags, 'hale')).toBe(CAST.range.max)
        applyRelationship(flags, { character: 'hale', disposition: -999 })
        expect(affection(flags, 'hale')).toBe(CAST.range.min)
        expect(standing(CAST.range.min)).toBe(CAST.standings[CAST.standings.length - 1]!.label)
        expect(standing(CAST.range.max)).toBe(CAST.standings[0]!.label)
    })

    it('counts only present allies', () => {
        const flags: StoryFlags = { rep_kirch: 6, rep_silva: 9, rep_voss: 4 }
        expect(countAllies(flags)).toBe(1)
        expect(countAllies({ ...flags, scientist_saved: 1 })).toBe(2)
        expect(countAllies({ ...flags, scientist_saved: 1 }, 4)).toBe(3)
    })

    it('includes Diana Korvin as a romanceable character', () => {
        expect(ROMANCE_IDS).toContain('diana')
        expect(CAST.characters.find((c) => c.id === 'diana')!.name).toContain('Диана')
    })
})

describe('romance partner selection', () => {
    it('picks nobody below the threshold', () => {
        expect(romancePartner({ aff_kirch: romanceAt - 1 })).toBeNull()
        expect(romancePartner({ aff_kirch: romanceAt })).toBe('kirch')
    })

    it('picks the highest affection by default and breaks ties by cast order', () => {
        expect(romancePartner({ aff_kirch: romanceAt, aff_hale: romanceAt + 2 })).toBe('hale')
        const [first, second] = ROMANCE_IDS
        expect(romancePartner({ [`aff_${second}`]: 7, [`aff_${first}`]: 7 })).toBe(first)
    })

    it('ignores characters who are not aboard', () => {
        expect(romancePartner({ aff_silva: 9 })).toBeNull()
        expect(romancePartner({ aff_silva: 9, scientist_saved: 1 })).toBe('silva')
    })

    it('keeps a commitment final and lets the player decline', () => {
        const flags = { aff_kirch: 8, aff_diana: romanceAt, romance_diana: 1 }
        expect(romancePartner(flags)).toBe('diana')
        // The committed partner fell below the threshold: nobody, not someone else.
        expect(romancePartner({ ...flags, aff_diana: romanceAt - 1 })).toBeNull()
        expect(romancePartner({ aff_kirch: 8, romance_declined: 1 })).toBeNull()
    })

    it('has no partner when romance is turned off', () => {
        expect(romancePartner({ aff_kirch: 8 }, false)).toBeNull()
        expect(needsCommitment({ aff_kirch: 8, aff_hale: 8 }, false)).toBe(false)
    })
})

describe('scenes', () => {
    it('waits for its level to be won and plays once', () => {
        const flags: StoryFlags = {}
        expect(scenesAfterMissions(progress(flags)).map((s) => s.id)).not.toContain('kirch_count')
        const after = scenesAfterMissions(progress(flags, ['level_2']))
        const scene = after.find((s) => s.id === 'kirch_count')!
        expect(scene.speaker).toBe('Лейтенант Ода Кирх')
        expect(playScene(scene, 0, flags)?.reply).toBeTruthy()
        expect(disposition(flags, 'kirch')).toBe(2)
        expect(scenesAfterMissions(progress(flags, ['level_2'])).map((s) => s.id)).not.toContain(
            'kirch_count',
        )
    })

    it('shows romantic lines only with enough affection and with romance on', () => {
        const ids = (flags: StoryFlags, romance = true) =>
            scenesAfterMissions(progress(flags, ['level_10'], romance)).find(
                (s) => s.id === 'kirch_bridge',
            )!.choices.length
        expect(ids({})).toBe(3)
        expect(ids({ aff_kirch: 2 })).toBe(4)
        expect(ids({ aff_kirch: 2 }, false)).toBe(3)
    })

    it('skips without consequences', () => {
        const flags: StoryFlags = {}
        const [scene] = scenesAfterMissions(progress(flags, ['level_2']))
        skipScene(scene!, flags)
        expect(flags[`scene_${scene!.id}`]).toBe(1)
        expect(Object.keys(flags).filter((key) => key.startsWith('rep_'))).toEqual([])
    })

    it('adds the commitment scene before the finale only when several qualify', () => {
        const ids = (flags: StoryFlags, romance = true) =>
            scenesBeforeMission(CAMPAIGN.finale, progress(flags, [], romance)).map((s) => s.id)
        expect(ids({ aff_kirch: 8 })).not.toContain(COMMITMENT_SCENE_ID)
        expect(ids({ aff_kirch: 8, aff_hale: romanceAt - 1 })).not.toContain(COMMITMENT_SCENE_ID)
        expect(ids({ aff_kirch: 8, aff_hale: romanceAt })).toContain(COMMITMENT_SCENE_ID)
        expect(ids({ aff_kirch: 8, aff_hale: 8 }, false)).not.toContain(COMMITMENT_SCENE_ID)
        expect(ids({ aff_kirch: 8, aff_hale: 8, romance_hale: 1 })).not.toContain(
            COMMITMENT_SCENE_ID,
        )
    })

    it('commits to the chosen partner even against higher affection', () => {
        const flags: StoryFlags = { aff_kirch: 9, aff_hale: 6, aff_diana: 5 }
        const scene = scenesBeforeMission(CAMPAIGN.finale, progress(flags)).find(
            (s) => s.id === COMMITMENT_SCENE_ID,
        )!
        // Choices follow affection: Kirch, Hale, Diana.
        expect(scene.choices).toHaveLength(3)
        playScene(scene, 2, flags)
        expect(romancePartner(flags)).toBe('diana')
        expect(affection(flags, 'kirch')).toBe(9 + scenesData.commitment.rejected)
        expect(needsCommitment(flags)).toBe(false)
    })

    it('declines romance when the commitment scene is skipped', () => {
        const flags: StoryFlags = { aff_kirch: 9, aff_hale: 9 }
        const scene = scenesBeforeMission(CAMPAIGN.finale, progress(flags)).slice(-1)[0]!
        skipScene(scene, flags)
        expect(romancePartner(flags)).toBeNull()
        expect(resolveEnding('victory', flags).partner).toBeNull()
    })
})

describe('endings with relationships', () => {
    const golden: StoryFlags = {
        engines_restored: 1,
        engineer_saved: 1,
        scientist_saved: 1,
        archive_saved: 1,
        truth_told: 1,
        ballast_dumped: 1,
        surgeon_saved: 1,
        rep_voss: 6,
        rep_kirch: 5,
        rep_hale: 5,
        rep_chen: 5,
        rep_silva: 5,
        rep_renn: 5,
    }

    it('needs every mission on the highest difficulty for the golden ending', () => {
        expect(resolveEnding('victory', golden).id).toBe('ascent')
        expect(
            resolveEnding('victory', golden, { difficultyRecords: everyMission(DIFFICULTY_IDS[0]) })
                .id,
        ).toBe('ascent')
        const missing = everyMission()
        delete missing[campaignMissions()[0]!]
        expect(resolveEnding('victory', golden, { difficultyRecords: missing }).id).toBe('ascent')
        expect(resolveEnding('victory', golden, { difficultyRecords: everyMission() }).id).toBe(
            'golden',
        )
    })

    it('needs allies and the captain for the golden ending, not a partner', () => {
        const records = { difficultyRecords: everyMission() }
        expect(resolveEnding('victory', { ...golden, rep_renn: 0 }, records).id).toBe('ascent')
        expect(resolveEnding('victory', { ...golden, rep_voss: 4 }, records).id).toBe('ascent')
        expect(resolveEnding('victory', golden, { ...records, romance: false }).id).toBe('golden')
    })

    it('ignores the training sector for the difficulty hook', () => {
        expect(campaignMissions()).not.toContain('level_0')
        expect(campaignMissions().length).toBe(LEVEL_IDS.length - 1)
        expect(allLevelsAtDifficulty(undefined, 'highest')).toBe(false)
        expect(allLevelsAtDifficulty(everyMission(), highest)).toBe(true)
    })

    it('adds the fates of allies, enemies and the partner to the epilogue', () => {
        const flags: StoryFlags = { rep_kirch: 6, aff_kirch: 6, rep_voss: -5 }
        const ending = resolveEnding('victory', flags)
        expect(ending.id).toBe('bastion')
        expect(ending.partner).toBe('Лейтенант Ода Кирх')
        expect(ending.epilogue.join(' ')).toContain('план обороны Бастиона')
        expect(ending.epilogue.join(' ')).toContain('вычеркнула имя')
        // The partner's paragraph comes last.
        expect(ending.epilogue.slice(-1)[0]).toContain('каюта с окном')
        const professional = resolveEnding('victory', flags, { romance: false })
        expect(professional.partner).toBeNull()
        expect(professional.epilogue.join(' ')).not.toContain('каюта с окном')
        expect(resolveEnding('victory', {}).epilogue).toEqual([])
    })

    it('writes a partner epilogue for every romanceable character and ending', () => {
        const endings = endingsData.map((ending) => ending.id)
        for (const id of ROMANCE_IDS) {
            const covered = epiloguesData
                .filter((e) =>
                    e.when.some((c) => 'kind' in c && c.kind === 'romance' && c.character === id),
                )
                .flatMap((e) => (e.endings.length ? e.endings : endings))
            expect(new Set(covered)).toEqual(new Set(endings))
        }
    })
})

describe('relationship content', () => {
    it('rejects affection for characters without romance and unknown characters', () => {
        const ok = (effect: unknown) => v.safeParse(effectSchema, effect).success
        expect(ok({ type: 'relationship', character: 'kirch', disposition: 1, affection: 2 })).toBe(
            true,
        )
        expect(ok({ type: 'relationship', character: 'voss', disposition: 1 })).toBe(true)
        expect(ok({ type: 'relationship', character: 'voss', disposition: 1, affection: 1 })).toBe(
            false,
        )
        expect(ok({ type: 'relationship', character: 'nobody', disposition: 1 })).toBe(false)
        expect(
            ok({
                type: 'transaction',
                cost: {},
                effects: [
                    { type: 'relationship', character: 'renn', disposition: 1, affection: 1 },
                ],
            }),
        ).toBe(false)
    })

    it('validates relationship conditions', () => {
        const ok = (condition: unknown) => v.safeParse(storyConditionSchema, condition).success
        expect(ok({ kind: 'affection', character: 'diana', atLeast: 3 })).toBe(true)
        expect(ok({ kind: 'affection', character: 'voss', atLeast: 3 })).toBe(false)
        expect(ok({ kind: 'disposition', character: 'voss' })).toBe(false)
        expect(ok({ kind: 'allLevelsAtDifficulty', difficulty: 'highest' })).toBe(true)
        expect(ok({ kind: 'anyOf', conditions: [{ kind: 'noRomance' }] })).toBe(false)
        expect(ok({ flag: 'rep_kirch', atLeast: 3 })).toBe(true)
        expect(
            conditionsHold({ flags: { rep_kirch: 3 } }, [
                {
                    kind: 'anyOf',
                    conditions: [
                        { kind: 'disposition', character: 'voss', atLeast: 1 },
                        { flag: 'rep_kirch', atLeast: 3 },
                    ],
                },
            ]),
        ).toBe(true)
    })

    it('ships scenes with two always-available choices and a reply for each', () => {
        expect(SCENES.length).toBeGreaterThanOrEqual(15)
        for (const scene of SCENES) {
            expect(scene.choices.filter((c) => !c.when.length && !c.romantic).length).toBe(
                scene.choices.filter((c) => !c.romantic).length,
            )
            for (const choice of scene.choices) expect(choice.reply.length).toBeGreaterThan(0)
        }
        // Every romanceable character can reach the threshold in scenes alone.
        for (const id of ROMANCE_IDS) {
            const best = SCENES.filter((s) => s.speaker === id)
                .map((s) =>
                    Math.max(
                        ...s.choices.map((c) =>
                            c.effects
                                .filter((e) => e.type === 'relationship' && e.character === id)
                                .reduce(
                                    (sum, e) =>
                                        sum +
                                        (e.type === 'relationship'
                                            ? (e.affection ?? e.disposition)
                                            : 0),
                                    0,
                                ),
                        ),
                    ),
                )
                .reduce((sum, value) => sum + value, 0)
            expect({ id, best: best >= romanceAt }).toEqual({ id, best: true })
        }
    })

    it('uses relationship flags of known characters only', () => {
        const text = JSON.stringify([
            scenesData,
            epiloguesData,
            endingsData,
            ...LEVEL_IDS.map((id) => levelDefinition(id)),
        ])
        for (const [, kind, id] of text.matchAll(/"(rep|aff|romance)_([a-z]+)"/g)) {
            if (kind === 'romance' && id === 'declined') continue
            expect(kind === 'rep' ? CHARACTER_IDS : ROMANCE_IDS).toContain(id)
        }
    })
})
