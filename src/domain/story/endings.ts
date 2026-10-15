import * as v from 'valibot'
import data from '@/content/endings.json'
import { parseContent, text } from '../content/parse'
import { flagConditionSchema, flagsMatch, type StoryFlags } from '../levels/schema'

const endingSchema = v.strictObject({
    id: text,
    title: text,
    // Result of the finale this ending needs.
    outcome: v.picklist(['victory', 'defeat']),
    // Story flags that must hold; an empty list matches any run.
    when: v.array(flagConditionSchema),
    text: v.pipe(v.array(text), v.nonEmpty()),
    // Extra paragraphs added when their flags hold.
    notes: v.optional(v.array(v.strictObject({ when: v.array(flagConditionSchema), text })), []),
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

export function resolveEnding(outcome: 'victory' | 'defeat', flags: Readonly<StoryFlags>): Ending {
    const ending = ENDINGS.find(
        (candidate) => candidate.outcome === outcome && flagsMatch(flags, candidate.when),
    )!
    return {
        id: ending.id,
        title: ending.title,
        paragraphs: [
            ...ending.text,
            ...ending.notes.filter((note) => flagsMatch(flags, note.when)).map((note) => note.text),
        ],
    }
}
