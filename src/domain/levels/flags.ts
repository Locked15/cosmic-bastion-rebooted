import * as v from 'valibot'

// Story flags: numbers kept by the campaign and tested by `when` conditions everywhere.

export type StoryFlags = Record<string, number>

export const flagName = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_]*$/, 'Flags are snake_case'))

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

export function inRange(value: number, bounds: { atLeast?: number; below?: number }): boolean {
    return (
        (bounds.atLeast === undefined || value >= bounds.atLeast) &&
        (bounds.below === undefined || value < bounds.below)
    )
}

export function flagsMatch(flags: Readonly<StoryFlags>, when: readonly FlagCondition[]): boolean {
    return when.every((condition) => inRange(flags[condition.flag] ?? 0, condition))
}
