import * as v from 'valibot'
import endingsData from '@/content/endings.json'
import epiloguesData from '@/content/epilogues.json'
import { parseContent, text } from '../content/parse'
import type { StoryFlags } from '../levels/flags'
import { character, romancePartner } from './cast'
import { conditionsHold, storyConditionSchema, type ConditionContext } from './conditions'

const conditions = v.optional(v.array(storyConditionSchema), [])

const endingSchema = v.strictObject({
    id: text,
    title: text,
    // Result of the finale this ending needs.
    outcome: v.picklist(['victory', 'defeat']),
    // Conditions that must all hold (story/conditions.ts); an empty list matches any run.
    when: v.array(storyConditionSchema),
    text: v.pipe(v.array(text), v.nonEmpty()),
    // Extra paragraphs added when their conditions hold.
    notes: v.optional(v.array(v.strictObject({ when: conditions, text })), []),
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
        v.check(
            (endings) => new Set(endings.map((e) => e.id)).size === endings.length,
            'Ending ids must be unique',
        ),
    ),
    endingsData,
    'content/endings.json',
)

// What became of the cast: paragraphs after the ending, chosen by relationships.
const epilogueSchema = v.strictObject({
    // Endings this paragraph belongs to; any ending when empty.
    endings: v.optional(v.array(text), []),
    when: conditions,
    text,
})
export type EpilogueDefinition = v.InferOutput<typeof epilogueSchema>

export const EPILOGUES: readonly EpilogueDefinition[] = parseContent(
    v.pipe(
        v.array(epilogueSchema),
        v.check(
            (epilogues) =>
                epilogues.every((epilogue) =>
                    epilogue.endings.every((id) => ENDINGS.some((ending) => ending.id === id)),
                ),
            'Epilogues may only refer to existing endings',
        ),
    ),
    epiloguesData,
    'content/epilogues.json',
)

export interface Ending {
    id: string
    title: string
    paragraphs: string[]
    // The cast's fates, in file order.
    epilogue: string[]
    // Name of the player's partner, if any.
    partner: string | null
}

export function resolveEnding(
    outcome: 'victory' | 'defeat',
    flags: Readonly<StoryFlags>,
    options: Omit<ConditionContext, 'flags'> = {},
): Ending {
    const context: ConditionContext = { ...options, flags }
    const ending = ENDINGS.find(
        (candidate) => candidate.outcome === outcome && conditionsHold(context, candidate.when),
    )!
    const partner = romancePartner(flags, context.romance ?? true)
    return {
        id: ending.id,
        title: ending.title,
        paragraphs: [
            ...ending.text,
            ...ending.notes
                .filter((note) => conditionsHold(context, note.when))
                .map((note) => note.text),
        ],
        epilogue: EPILOGUES.filter(
            (epilogue) =>
                (!epilogue.endings.length || epilogue.endings.includes(ending.id)) &&
                conditionsHold(context, epilogue.when),
        ).map((epilogue) => epilogue.text),
        partner: partner ? character(partner)!.name : null,
    }
}
