import * as v from 'valibot'
import { count, point, positive, rect, text } from '../content/parse'
import { BARRICADE_TYPES, type BarricadeType } from '../rules/barricadeCatalog'
import { enemyAbilitySchema } from '../rules/enemyRules'
import { TOWER_TYPES, type TowerType } from '../rules/towerCatalog'
import {
    RELATIONSHIP_ISSUE,
    relationshipAllowed,
    relationshipChangeSchema,
    type RelationshipChange,
} from '../story/cast'
import { flagConditionSchema, flagName } from './flags'

export * from './flags'

// Schemas of level files (content/levels/*.json). Types of level data are inferred from them.

const MAX_EVENTS_PER_WAVE = 3
const MAX_EVENTS_PER_LEVEL = 10

const costSchema = v.strictObject({
    resources: v.optional(count),
    miners: v.optional(count),
    military: v.optional(count),
})
export type EventCost = v.InferOutput<typeof costSchema>

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
    // Changes a character's disposition (and affection, for romanceable ones): story/cast.ts.
    | ({ type: 'relationship' } & RelationshipChange)

export const effectSchema: v.GenericSchema<EventEffect> = v.pipe(
    v.variant('type', [
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
        v.strictObject({
            type: v.literal('emergency'),
            resources: v.number(),
            military: v.number(),
        }),
        v.strictObject({ type: v.literal('buffDamage'), value: positive }),
        v.strictObject({ type: v.literal('buffBarricades'), value: positive }),
        v.strictObject({
            type: v.literal('superWeapon'),
            military: v.number(),
            killPercent: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
        }),
        v.strictObject({ type: v.literal('relationship'), ...relationshipChangeSchema.entries }),
    ]),
    v.check((effect) => relationshipAllowed(effect), RELATIONSHIP_ISSUE),
)

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
    // One of the `events` (by id) was resolved, whatever the choice, even if time ran out.
    // A decision that never came up (its branch did not happen) counts as made on victory.
    'decision',
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
        events: v.optional(v.pipe(v.array(text), v.nonEmpty())),
        // Main objectives (the default) decide progression: the sector is completed only when
        // all of them are done. Optional ones only add stars (and requisitions).
        optional: v.optional(v.boolean(), false),
    }),
    v.check(
        (objective) => objective.kind !== 'flag' || objective.flag !== undefined,
        'A flag objective needs `flag`',
    ),
    v.check(
        (objective) => (objective.kind === 'decision') === (objective.events !== undefined),
        'A decision objective needs `events`, and only it',
    ),
    v.check(
        (objective) => objective.kind !== 'survive' || !objective.optional,
        'Surviving is always a main objective',
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

// Whether an effect takes resources or people (a cost or a negative stat change).
function hasCost(effect: EventEffect | null | undefined): boolean {
    if (!effect) return false
    switch (effect.type) {
        case 'transaction':
            return (
                Object.values(effect.cost).some((value) => (value ?? 0) > 0) ||
                effect.effects.some(hasCost)
            )
        case 'resources':
            return effect.value < 0 || (effect.military ?? 0) < 0
        case 'convert':
        case 'removeMilitary':
            return true
        case 'superWeapon':
            return effect.military < 0
        default:
            return false
    }
}

const pathSchema = v.pipe(v.array(point), v.minLength(2))

export const ROUTE_ROLES = ['fast', 'heavy', 'boss'] as const
export type RouteRole = (typeof ROUTE_ROLES)[number]

// One way enemies can walk to the living quarters.
const routeSchema = v.strictObject({
    id: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_]*$/, 'Route ids look like main or vent_2')),
    // Name shown on the map and in the wave preview.
    label: text,
    points: pathSchema,
    // First wave that uses the route; before that it is shown as a closed passage.
    opensOnWave: v.optional(v.pipe(count, v.minValue(1)), 1),
    // Enemies this route draws first: fast (small), heavy (large, nodes) or boss.
    role: v.optional(v.picklist(ROUTE_ROLES)),
    // Share of the remaining enemies; role routes take none of them by default.
    weight: v.optional(positive),
    // Route taken instead while an intact barricade blocks this one when a wave starts.
    detour: v.optional(v.string()),
    // Only a detour: never assigned directly.
    reserve: v.optional(v.boolean(), false),
})
export type RouteDefinition = v.InferOutput<typeof routeSchema>

export const levelSchema = v.pipe(
    v.strictObject({
        id: v.pipe(v.string(), v.regex(/^level_\d+$/, 'Level ids look like level_N')),
        name: text,
        description: text,
        // Story levels advance the plot even after a tactical defeat (their flags are kept).
        type: v.picklist(['story', 'normal']),
        // Track id from content/music.json.
        music: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
        width: positive,
        height: positive,
        // Everything below this line is the living quarters.
        livingQuartersY: positive,
        // The first route is the main one; every route ends in the living quarters.
        routes: v.pipe(v.array(routeSchema), v.nonEmpty()),
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
            level.routes.every(
                (route) => route.points[route.points.length - 1]!.y > level.livingQuartersY,
            ),
        'Every route must end inside the living quarters',
    ),
    v.check(
        (level) => new Set(level.routes.map((route) => route.id)).size === level.routes.length,
        'Route ids must be unique',
    ),
    v.check(
        (level) =>
            level.routes.every(
                (route) =>
                    route.detour === undefined ||
                    (route.detour !== route.id &&
                        level.routes.some((other) => other.id === route.detour)),
            ),
        'A detour must name another route of the level',
    ),
    v.check(
        (level) => level.routes.every((route) => route.opensOnWave <= level.waves.total),
        'A route opens after the last wave',
    ),
    v.check(
        (level) =>
            level.routes.some(
                (route) => route.opensOnWave === 1 && !route.reserve && route.role === undefined,
            ),
        'The first wave needs an open route for any enemy',
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
    v.check(
        (level) => level.objectives.some((objective) => objective.kind === 'survive'),
        'A level needs a survive objective',
    ),
    v.check(
        (level) =>
            level.objectives.every((objective) =>
                (objective.events ?? []).every((id) =>
                    level.events.some((event) => event.id === id),
                ),
            ),
        'A decision objective may only name events of its level',
    ),
    // A timed-out decision picks the last affordable choice: a free one guarantees a decision.
    v.check(
        (level) =>
            level.objectives.every((objective) =>
                (objective.events ?? []).every((id) => {
                    const event = level.events.find((candidate) => candidate.id === id)
                    // A missing event is reported by the check above.
                    return (
                        !event ||
                        event.dialog.choices.some(
                            (choice) => !choice.cost && !hasCost(choice.effect),
                        )
                    )
                }),
            ),
        'Every event behind a decision objective needs a free choice',
    ),
)
export type LevelDefinition = v.InferOutput<typeof levelSchema>
