import * as v from 'valibot'
import data from '@/content/difficulties.json'
import { ENEMY_ABILITIES } from './enemyRules'
import { count, parseContent, positive, recordOf, text } from '../content/parse'

export const DIFFICULTY_IDS = ['simple', 'modest', 'complex', 'xhard'] as const
export type DifficultyId = (typeof DIFFICULTY_IDS)[number]

const fraction = v.pipe(v.number(), v.minValue(0), v.maxValue(1))

export const difficultySchema = v.strictObject({
    // Absolute battle speed during dialogs below 1; 1 preserves the selected speed.
    // Zero also suspends the real-time dialog countdown.
    dialogSpeed: fraction,
    refundRate: fraction,
    startResources: positive,
    requisitions: positive,
    swarmMemory: fraction,
    bosses: v.strictObject({
        minDepth: v.pipe(count, v.minValue(1)),
        every: v.nullable(v.pipe(count, v.minValue(1))),
        finalWave: v.boolean(),
        abilities: count,
        banned: v.array(v.picklist(ENEMY_ABILITIES)),
    }),
    // Rank name; the difficulty is chosen as a rank at officer registration.
    label: text,
    // Shoulder board: stripes, stars, and the general's zigzag field.
    insignia: v.strictObject({
        stripes: count,
        stars: v.pipe(count, v.minValue(1)),
        general: v.boolean(),
    }),
    // Flavour text on the registration terminal and in the settings.
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
        swarmMemory: v.strictObject({ minimumKills: count, message: text, clearedMessage: text }),
        default: v.picklist(DIFFICULTY_IDS),
        levels: recordOf(DIFFICULTY_IDS, difficultySchema),
    }),
    data,
    'content/difficulties.json',
)

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = content.levels

export const SWARM_MEMORY_RULES = content.swarmMemory

export const DEFAULT_DIFFICULTY: DifficultyId = content.default

export function isDifficultyId(value: unknown): value is DifficultyId {
    return typeof value === 'string' && value in DIFFICULTIES
}
