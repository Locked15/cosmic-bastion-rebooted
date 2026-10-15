import * as v from 'valibot'
import { count } from '../content/parse'
import {
    flagConditionSchema,
    flagsMatch,
    inRange,
    type FlagCondition,
    type StoryFlags,
} from '../levels/flags'
import { DIFFICULTY_IDS, type DifficultyId } from '../rules/difficulty'
import { CAMPAIGN } from './campaign'
import {
    ROMANCE_IDS,
    affection,
    characterIdSchema,
    countAllies,
    disposition,
    isPresent,
    romancePartner,
} from './cast'

// Conditions of scenes and endings. A plain flag condition still works; the `kind` forms
// test relationships and campaign records, and compose with `anyOf`. Every list is "all of".

// Highest completed difficulty per level id, kept in the profile by the difficulty system.
export type DifficultyRecords = Readonly<Record<string, DifficultyId>>

export interface ConditionContext {
    flags: Readonly<StoryFlags>
    // Absent until the profile records difficulties: `allLevelsAtDifficulty` then never holds.
    difficultyRecords?: DifficultyRecords
    // The player's romance setting (default on). Off: `romance` never holds, `noRomance` does.
    romance?: boolean
}

export type StoryCondition =
    | FlagCondition
    | { kind: 'disposition'; character: string; atLeast?: number; below?: number }
    | { kind: 'affection'; character: string; atLeast?: number; below?: number }
    // The ending's partner is this character, or anyone when `character` is omitted.
    | { kind: 'romance'; character?: string }
    // Nobody qualifies as a partner.
    | { kind: 'noRomance' }
    // The character is still aboard (see `present` in content/cast.json).
    | { kind: 'present'; character: string }
    // At least `count` present characters have disposition of `atLeast` or more (cast allyAt).
    | { kind: 'allies'; count: number; atLeast?: number }
    // Hook for the difficulty system: every campaign mission (training excluded) was won on
    // this difficulty or a harder one. `highest` is the last entry of DIFFICULTY_IDS.
    | { kind: 'allLevelsAtDifficulty'; difficulty: DifficultyId | 'highest' }
    | { kind: 'anyOf'; conditions: StoryCondition[] }

const bounds = {
    atLeast: v.optional(v.number()),
    below: v.optional(v.number()),
}

export const storyConditionSchema: v.GenericSchema<StoryCondition> = v.pipe(
    v.union([
        flagConditionSchema,
        v.variant('kind', [
            v.strictObject({
                kind: v.literal('disposition'),
                character: characterIdSchema,
                ...bounds,
            }),
            v.strictObject({
                kind: v.literal('affection'),
                character: v.picklist(ROMANCE_IDS as [string, ...string[]]),
                ...bounds,
            }),
            v.strictObject({
                kind: v.literal('romance'),
                character: v.optional(v.picklist(ROMANCE_IDS as [string, ...string[]])),
            }),
            v.strictObject({ kind: v.literal('noRomance') }),
            v.strictObject({ kind: v.literal('present'), character: characterIdSchema }),
            v.strictObject({
                kind: v.literal('allies'),
                count: v.pipe(count, v.minValue(1)),
                atLeast: v.optional(v.number()),
            }),
            v.strictObject({
                kind: v.literal('allLevelsAtDifficulty'),
                difficulty: v.picklist([...DIFFICULTY_IDS, 'highest'] as const),
            }),
            v.strictObject({
                kind: v.literal('anyOf'),
                conditions: v.pipe(v.array(v.lazy(() => storyConditionSchema)), v.minLength(2)),
            }),
        ]),
    ]),
    v.check(
        (condition) =>
            !('kind' in condition) ||
            (condition.kind !== 'disposition' && condition.kind !== 'affection') ||
            condition.atLeast !== undefined ||
            condition.below !== undefined,
        'A relationship condition needs atLeast or below',
    ),
)

function difficultyRank(id: DifficultyId | 'highest'): number {
    return id === 'highest' ? DIFFICULTY_IDS.length - 1 : DIFFICULTY_IDS.indexOf(id)
}

// Missions of the campaign: the training briefing does not count.
export function campaignMissions(): string[] {
    return CAMPAIGN.sectors
        .filter((sector) => sector.layer !== 'training')
        .map((sector) => sector.level)
}

export function allLevelsAtDifficulty(
    records: DifficultyRecords | undefined,
    difficulty: DifficultyId | 'highest',
): boolean {
    if (!records) return false
    const required = difficultyRank(difficulty)
    return campaignMissions().every((id) => {
        const record = records[id]
        return record !== undefined && difficultyRank(record) >= required
    })
}

export function conditionHolds(context: ConditionContext, condition: StoryCondition): boolean {
    const { flags } = context
    if (!('kind' in condition)) return flagsMatch(flags, [condition])
    switch (condition.kind) {
        case 'disposition':
            return inRange(disposition(flags, condition.character), condition)
        case 'affection':
            return inRange(affection(flags, condition.character), condition)
        case 'romance': {
            const partner = romancePartner(flags, context.romance ?? true)
            return partner !== null && (!condition.character || partner === condition.character)
        }
        case 'noRomance':
            return romancePartner(flags, context.romance ?? true) === null
        case 'present':
            return isPresent(flags, condition.character)
        case 'allies':
            return countAllies(flags, condition.atLeast) >= condition.count
        case 'allLevelsAtDifficulty':
            return allLevelsAtDifficulty(context.difficultyRecords, condition.difficulty)
        case 'anyOf':
            return condition.conditions.some((nested) => conditionHolds(context, nested))
    }
}

export function conditionsHold(
    context: ConditionContext,
    conditions: readonly StoryCondition[],
): boolean {
    return conditions.every((condition) => conditionHolds(context, condition))
}
