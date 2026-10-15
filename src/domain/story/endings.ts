import * as v from 'valibot'
import data from '@/content/endings.json'
import { parseContent, text } from '../content/parse'
import {
    flagConditionSchema,
    flagsMatch,
    type FlagCondition,
    type StoryFlags,
} from '../levels/schema'
import type { DifficultyRecords } from '../model/Campaign'
import { DIFFICULTY_IDS, type DifficultyId } from '../rules/difficulty'
import { CAMPAIGN } from './campaign'

// A story flag, or every campaign mission (training excluded) won on this rank or a harder
// one; `highest` is the last of DIFFICULTY_IDS.
export type EndingCondition =
    | FlagCondition
    | { kind: 'allLevelsAtDifficulty'; difficulty: DifficultyId | 'highest' }

const conditionSchema = v.union([
    flagConditionSchema,
    v.strictObject({
        kind: v.literal('allLevelsAtDifficulty'),
        difficulty: v.picklist([...DIFFICULTY_IDS, 'highest'] as const),
    }),
])

const endingSchema = v.strictObject({
    id: text,
    title: text,
    // Result of the finale this ending needs.
    outcome: v.picklist(['victory', 'defeat']),
    // Conditions that must all hold; an empty list matches any run.
    when: v.array(conditionSchema),
    text: v.pipe(v.array(text), v.nonEmpty()),
    // Extra paragraphs added when their conditions hold.
    notes: v.optional(v.array(v.strictObject({ when: v.array(conditionSchema), text })), []),
})
export type EndingDefinition = v.InferOutput<typeof endingSchema>

// Checked in order: the first matching ending is shown.
export const ENDINGS: readonly EndingDefinition[] = parseContent(
    v.pipe(
        v.array(endingSchema),
        v.check(
            (endings) =>
                (['victory', 'defeat'] as const).every((outcome) =>
                    endings.some((ending) => ending.outcome === outcome && !ending.when.length),
                ),
            'Each outcome needs a fallback ending without conditions',
        ),
    ),
    data,
    'content/endings.json',
)

export interface Ending {
    id: string
    title: string
    paragraphs: string[]
}

const rank = (id: DifficultyId | 'highest') =>
    id === 'highest' ? DIFFICULTY_IDS.length - 1 : DIFFICULTY_IDS.indexOf(id)

export function allLevelsAtDifficulty(
    records: DifficultyRecords,
    difficulty: DifficultyId | 'highest',
): boolean {
    return CAMPAIGN.sectors
        .filter((sector) => sector.layer !== 'training')
        .every((sector) => {
            const record = records[sector.level]
            return record !== undefined && rank(record) >= rank(difficulty)
        })
}

function conditionsHold(
    flags: Readonly<StoryFlags>,
    records: DifficultyRecords,
    conditions: readonly EndingCondition[],
): boolean {
    return conditions.every((condition) =>
        'kind' in condition
            ? allLevelsAtDifficulty(records, condition.difficulty)
            : flagsMatch(flags, [condition]),
    )
}

export function resolveEnding(
    outcome: 'victory' | 'defeat',
    flags: Readonly<StoryFlags>,
    records: DifficultyRecords = {},
): Ending {
    const ending = ENDINGS.find(
        (candidate) =>
            candidate.outcome === outcome && conditionsHold(flags, records, candidate.when),
    )!
    return {
        id: ending.id,
        title: ending.title,
        paragraphs: [
            ...ending.text,
            ...ending.notes
                .filter((note) => conditionsHold(flags, records, note.when))
                .map((note) => note.text),
        ],
    }
}
