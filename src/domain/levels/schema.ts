import * as v from 'valibot'
import { count, point, positive, rect, text } from '../content/parse'
import { BARRICADE_TYPES, type BarricadeType } from '../rules/barricadeCatalog'
import { enemyAbilitySchema } from '../rules/enemyRules'
import { TOWER_TYPES, type TowerType } from '../rules/towerCatalog'

// Schemas of level files (content/levels/*.json). Types of level data are inferred from them.

const MAX_EVENTS_PER_WAVE = 3
const MAX_EVENTS_PER_LEVEL = 10
const flagName = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_]*$/, 'Flags are snake_case'))

const costSchema = v.strictObject({
    resources: v.optional(count),
    miners: v.optional(count),
    military: v.optional(count),
})
export type EventCost = v.InferOutput<typeof costSchema>

export type StoryFlags = Record<string, number>

// The engine knows how to apply each effect type (application/session/effects.ts).
export type EventEffect =
    | { type: 'transaction'; cost: EventCost; effects: EventEffect[] }
    | { type: 'flag'; name: string; value: number }
    | { type: 'unlockTower'; tower: TowerType }
    | { type: 'unlockBarricade'; barricade: BarricadeType }
    | { type: 'resources'; value: number; military?: number }
    | { type: 'convert'; count: number }
    | { type: 'addMilitary'; count: number }
    | { type: 'addMiners'; count: number }
    | { type: 'addPersonnel'; miners: number; military: number }
    | { type: 'removeMilitary'; count: number; resources: number }
    | { type: 'emergency'; resources: number; military: number }
    | { type: 'buffDamage'; value: number }
    | { type: 'buffBarricades'; value: number }
    | { type: 'superWeapon'; military: number; killPercent: number }

export const effectSchema: v.GenericSchema<EventEffect> = v.variant('type', [
    v.strictObject({
        type: v.literal('transaction'),
        cost: costSchema,
        effects: v.array(v.lazy(() => effectSchema)),
    }),
    v.strictObject({ type: v.literal('flag'), name: flagName, value: v.number() }),
    v.strictObject({ type: v.literal('unlockTower'), tower: v.picklist(TOWER_TYPES) }),
    v.strictObject({
        type: v.literal('unlockBarricade'),
        barricade: v.picklist(BARRICADE_TYPES),
    }),
    v.strictObject({
        type: v.literal('resources'),
        value: v.number(),
        military: v.optional(v.number()),
    }),
    v.strictObject({ type: v.literal('convert'), count }),
    v.strictObject({ type: v.literal('addMilitary'), count }),
    v.strictObject({ type: v.literal('addMiners'), count }),
    v.strictObject({ type: v.literal('addPersonnel'), miners: count, military: count }),
    v.strictObject({ type: v.literal('removeMilitary'), count, resources: v.number() }),
    v.strictObject({ type: v.literal('emergency'), resources: v.number(), military: v.number() }),
    v.strictObject({ type: v.literal('buffDamage'), value: positive }),
    v.strictObject({ type: v.literal('buffBarricades'), value: positive }),
    v.strictObject({
        type: v.literal('superWeapon'),
        military: v.number(),
        killPercent: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
    }),
])

// Holds when the flag is at least `atLeast` and below `below` (either may be omitted).
export const flagConditionSchema = v.pipe(
    v.strictObject({
        flag: flagName,
        atLeast: v.optional(v.number()),
        below: v.optional(v.number()),
    }),
    v.check(
        (condition) => condition.atLeast !== undefined || condition.below !== undefined,
        'A flag condition needs atLeast or below',
    ),
)
export type FlagCondition = v.InferOutput<typeof flagConditionSchema>

export function flagsMatch(flags: Readonly<StoryFlags>, when: readonly FlagCondition[]): boolean {
    return when.every(({ flag, atLeast, below }) => {
        const value = flags[flag] ?? 0
        return (atLeast === undefined || value >= atLeast) && (below === undefined || value < below)
    })
}

const choiceSchema = v.strictObject({
    text,
    cost: v.optional(costSchema),
    consequence: v.optional(text),
    effect: v.optional(v.nullable(effectSchema), null),
})
export type StoryChoice = v.InferOutput<typeof choiceSchema>

const dialogSchema = v.strictObject({
    // full: costs and consequences shown; partial: consequence shown after the choice;
    // unknown: nothing is shown.
    kind: v.picklist(['full', 'partial', 'unknown']),
    title: text,
    text,
    choices: v.pipe(v.array(choiceSchema), v.nonEmpty()),
    timed: v.boolean(),
    // Seconds of real time (7–15 by the brief).
    timeLimit: v.optional(v.pipe(v.number(), v.minValue(7), v.maxValue(15))),
})
export type StoryDialog = v.InferOutput<typeof dialogSchema>

const eventSchema = v.strictObject({
    id: v.optional(text),
    wave: count,
    trigger: v.picklist(['start', 'delay']),
    // Real-time frames since this wave began (60 fps); pause stops the clock.
    delay: v.optional(positive),
    // Story flags that must hold for the event to appear.
    when: v.optional(v.array(flagConditionSchema)),
    dialog: dialogSchema,
})
export type LevelEvent = v.InferOutput<typeof eventSchema>

export const OBJECTIVE_KINDS = [
    // Win the level.
    'survive',
    // A story flag is set (a character saved, the archive sent…).
    'flag',
    // At least `target` working towers at the same time.
    'activeTowers',
    // Any tower upgraded to level `target`.
    'towerLevel',
    // At most `target` breakthroughs into the quarters, judged on victory.
    'maxBreaches',
    // At most `target` people lost, judged on victory.
    'maxLosses',
    // Finish building a tower / a barricade.
    'buildTower',
    'buildBarricade',
] as const
export type ObjectiveKind = (typeof OBJECTIVE_KINDS)[number]
const TARGETED: readonly ObjectiveKind[] = [
    'activeTowers',
    'towerLevel',
    'maxBreaches',
    'maxLosses',
]

const objectiveSchema = v.pipe(
    v.strictObject({
        id: text,
        text,
        kind: v.picklist(OBJECTIVE_KINDS),
        flag: v.optional(flagName),
        target: v.optional(count),
    }),
    v.check(
        (objective) => objective.kind !== 'flag' || objective.flag !== undefined,
        'A flag objective needs `flag`',
    ),
    v.check(
        (objective) => !TARGETED.includes(objective.kind) || objective.target !== undefined,
        'This objective kind needs `target`',
    ),
)
export type ObjectiveDefinition = v.InferOutput<typeof objectiveSchema>
export type Objective = ObjectiveDefinition & { completed: boolean }

// How earlier missions change this level's start.
export const carryOverSchema = v.variant('type', [
    // Adds floor(sum of the flags / divide) to a starting stat.
    v.strictObject({
        type: v.literal('start'),
        stat: v.picklist(['resources', 'miners', 'military']),
        flags: v.pipe(v.array(flagName), v.nonEmpty()),
        divide: v.optional(v.pipe(v.number(), v.minValue(1)), 1),
    }),
    // Applies an effect when the level starts, if the flags hold (always when `when` is empty).
    v.strictObject({
        type: v.literal('effect'),
        when: v.optional(v.array(flagConditionSchema), []),
        effect: effectSchema,
        message: v.optional(text),
    }),
    // Enemies of this level never get the ability, if the flags hold (always when empty).
    v.strictObject({
        type: v.literal('excludeAbility'),
        when: v.optional(v.array(flagConditionSchema), []),
        ability: enemyAbilitySchema,
    }),
])
export type CarryOver = v.InferOutput<typeof carryOverSchema>

const pathSchema = v.pipe(v.array(point), v.minLength(2))

export const levelSchema = v.pipe(
    v.strictObject({
        id: v.pipe(v.string(), v.regex(/^level_\d+$/, 'Level ids look like level_N')),
        name: text,
        description: text,
        // Story levels advance the plot even after a tactical defeat (their flags are kept).
        type: v.picklist(['story', 'normal']),
        width: positive,
        height: positive,
        // Everything below this line is the living quarters.
        livingQuartersY: positive,
        paths: v.strictObject({
            base: pathSchema,
            // Taken while an intact barricade blocks the base path.
            alternatives: v.optional(v.array(pathSchema), []),
        }),
        corridors: v.array(rect),
        towerSlots: v.pipe(
            v.array(
                v.strictObject({ x: v.number(), y: v.number(), type: v.picklist(TOWER_TYPES) }),
            ),
            v.nonEmpty(),
        ),
        start: v.strictObject({ miners: count, military: count, resources: count }),
        waves: v.strictObject({
            total: v.pipe(count, v.minValue(1)),
            // Multiplies the number of enemies per wave.
            difficulty: positive,
        }),
        objectives: v.pipe(v.array(objectiveSchema), v.nonEmpty()),
        events: v.array(eventSchema),
        carryOver: v.optional(v.array(carryOverSchema), []),
    }),
    v.check(
        (level) => level.livingQuartersY < level.height,
        'livingQuartersY must be inside the level',
    ),
    v.check(
        (level) =>
            [level.paths.base, ...level.paths.alternatives].every(
                (path) => path[path.length - 1]!.y > level.livingQuartersY,
            ),
        'Every path must end inside the living quarters',
    ),
    v.check(
        (level) => level.events.every((event) => event.wave <= level.waves.total),
        'An event is scheduled after the last wave',
    ),
    v.check(
        (level) => level.events.length <= MAX_EVENTS_PER_LEVEL,
        `At most ${MAX_EVENTS_PER_LEVEL} events per level`,
    ),
    v.check(
        (level) =>
            level.events.every(
                (event) =>
                    level.events.filter((other) => other.wave === event.wave).length <=
                    MAX_EVENTS_PER_WAVE,
            ),
        `At most ${MAX_EVENTS_PER_WAVE} events per wave`,
    ),
    v.check(
        (level) =>
            new Set(level.objectives.map((objective) => objective.id)).size ===
            level.objectives.length,
        'Objective ids must be unique',
    ),
)
export type LevelDefinition = v.InferOutput<typeof levelSchema>
