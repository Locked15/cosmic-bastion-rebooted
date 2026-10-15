import * as v from 'valibot'
import data from '@/content/difficulties.json'
import { count, parseContent, positive, recordOf, text } from '../content/parse'

export const DIFFICULTY_IDS = ['simple', 'modest', 'complex', 'xhard'] as const
export type DifficultyId = (typeof DIFFICULTY_IDS)[number]

const difficultySchema = v.strictObject({
    label: text,
    // Flavour text shown in the settings for the selected level.
    description: text,
    // Multiplies every enemy's health.
    health: positive,
    // Multiplies every enemy's movement speed.
    speed: positive,
    // Enemies that may break into the living quarters before the level is lost.
    maxBreakthroughs: v.pipe(count, v.minValue(1)),
})
export type Difficulty = v.InferOutput<typeof difficultySchema>

const content = parseContent(
    v.strictObject({
        default: v.picklist(DIFFICULTY_IDS),
        levels: recordOf(DIFFICULTY_IDS, difficultySchema),
    }),
    data,
    'content/difficulties.json',
)

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = content.levels

export const DEFAULT_DIFFICULTY: DifficultyId = content.default

export function isDifficultyId(value: unknown): value is DifficultyId {
    return typeof value === 'string' && value in DIFFICULTIES
}
