import * as v from 'valibot'
import data from '@/content/achievements.json'
import { parseContent, text } from '../content/parse'

// Facts about a finished or running level that achievements are judged on.
export interface AchievementFacts {
    killed: number
    activeTowers: number
    military: number
    gathered: number
    personnelLost: number
    victory: boolean
}

const FACTS = [
    'killed',
    'activeTowers',
    'military',
    'gathered',
    'personnelLost',
    'victory',
] as const satisfies readonly (keyof AchievementFacts)[]

// A bound on one fact; `victory` counts as 1 when won and 0 otherwise.
const conditionSchema = v.pipe(
    v.strictObject({
        fact: v.picklist(FACTS),
        atLeast: v.optional(v.number()),
        atMost: v.optional(v.number()),
    }),
    v.check(
        (condition) => condition.atLeast !== undefined || condition.atMost !== undefined,
        'A condition needs atLeast or atMost',
    ),
)
export type AchievementCondition = v.InferOutput<typeof conditionSchema>

const achievementSchema = v.strictObject({
    id: text,
    title: text,
    description: text,
    // Every condition must hold.
    when: v.pipe(v.array(conditionSchema), v.nonEmpty()),
})
export type AchievementDefinition = v.InferOutput<typeof achievementSchema>

export const ACHIEVEMENTS: readonly AchievementDefinition[] = parseContent(
    v.array(achievementSchema),
    data,
    'content/achievements.json',
)

export function isEarned(achievement: AchievementDefinition, facts: AchievementFacts): boolean {
    return achievement.when.every(({ fact, atLeast, atMost }) => {
        const value = Number(facts[fact])
        return (
            (atLeast === undefined || value >= atLeast) && (atMost === undefined || value <= atMost)
        )
    })
}

// Achievements earned by `facts` that are not in `unlocked` yet.
export function newAchievements(
    facts: AchievementFacts,
    unlocked: ReadonlySet<string>,
): AchievementDefinition[] {
    return ACHIEVEMENTS.filter(
        (achievement) => !unlocked.has(achievement.id) && isEarned(achievement, facts),
    )
}
