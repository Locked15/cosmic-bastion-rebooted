import * as v from 'valibot'
import data from '@/content/briefings.json'
import { parseContent } from '../content/parse'
import { flagConditionSchema, flagsMatch, type StoryFlags } from '../levels/schema'

const briefingSchema = v.strictObject({
    // Levels that must be won.
    completed: v.optional(v.array(v.pipe(v.string(), v.regex(/^level_\d+$/))), []),
    when: v.optional(v.array(flagConditionSchema), []),
    // {name} becomes the profile name.
    text: v.pipe(v.string(), v.includes('{name}')),
})

// Main-menu greeting by story progress: the first matching line is used.
const BRIEFINGS = parseContent(
    v.pipe(
        v.array(briefingSchema),
        v.check(
            (lines) => lines.some((line) => !line.completed.length && !line.when.length),
            'A fallback line without conditions is required',
        ),
    ),
    data,
    'content/briefings.json',
)

export function briefingLine(
    name: string,
    progress: { completedLevels: readonly string[]; flags: Readonly<StoryFlags> },
): string {
    const line = BRIEFINGS.find(
        (candidate) =>
            candidate.completed.every((id) => progress.completedLevels.includes(id)) &&
            flagsMatch(progress.flags, candidate.when),
    )!
    return line.text.split('{name}').join(name)
}
