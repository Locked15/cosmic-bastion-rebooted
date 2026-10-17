import * as v from 'valibot'
import data from '@/content/enemies.json'
import { count, parseContent, positive, recordOf, text } from '../content/parse'

export const ENEMY_SIZES = ['small', 'medium', 'large'] as const
export type EnemySize = (typeof ENEMY_SIZES)[number]
export const ENEMY_KINDS = ['simple', 'ability', 'miniboss', 'boss'] as const
export type EnemyKind = (typeof ENEMY_KINDS)[number]
export const ENEMY_ABILITIES = [
    'ambush',
    'split',
    'accelerate',
    'teleport',
    'adaptation',
    'sabotage',
    'absorb',
    'weakImmunity',
    'dodge',
    'confuse',
    'blind',
    'destroy',
    'spawn',
] as const
export type EnemyAbility = (typeof ENEMY_ABILITIES)[number]
export const enemyAbilitySchema = v.picklist(ENEMY_ABILITIES)

const statsSchema = v.strictObject({
    maxHealth: positive,
    speed: positive,
    damage: positive,
    reward: count,
    mass: positive,
})
export type EnemyStats = v.InferOutput<typeof statsSchema>

// Chance that grows by `perWave` each wave, capped at `max`.
const chanceSchema = v.strictObject({ base: positive, perWave: positive, max: positive })
export type WaveChance = v.InferOutput<typeof chanceSchema>

const wavesSchema = v.strictObject({
    baseCount: count,
    countPerWave: count,
    // Frames between two spawns.
    spawnInterval: positive,
    largeChance: chanceSchema,
    // Share of the remaining roll that becomes medium; the rest is small.
    mediumShare: positive,
    abilityChance: chanceSchema,
    abilityFromWave: count,
    miniBossChance: chanceSchema,
    miniBossFromWave: count,
    // Frames after the last regular spawn.
    bossDelay: positive,
    regularAbilities: v.pipe(v.array(enemyAbilitySchema), v.nonEmpty()),
    bossAbilities: v.pipe(v.array(enemyAbilitySchema), v.nonEmpty()),
})
export type WaveRules = v.InferOutput<typeof wavesSchema>

const rules = parseContent(
    v.strictObject({
        sizes: recordOf(ENEMY_SIZES, statsSchema),
        kinds: recordOf(
            ENEMY_KINDS,
            v.strictObject({ health: positive, reward: positive, mass: positive }),
        ),
        abilities: recordOf(ENEMY_ABILITIES, text),
        waves: wavesSchema,
    }),
    data,
    'content/enemies.json',
)

export const ENEMY_BASE_STATS: Record<EnemySize, EnemyStats> = rules.sizes
export const ENEMY_KIND_MODIFIERS: Record<
    EnemyKind,
    { health: number; reward: number; mass: number }
> = rules.kinds
export const ABILITY_DESCRIPTIONS: Record<EnemyAbility, string> = rules.abilities
export const WAVE_RULES: WaveRules = rules.waves

// Abilities only bosses get.
export const BOSS_ABILITIES: readonly EnemyAbility[] = WAVE_RULES.bossAbilities
