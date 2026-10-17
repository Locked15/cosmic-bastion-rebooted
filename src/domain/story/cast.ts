import * as v from 'valibot'
import data from '@/content/cast.json'
import { parseContent, rect, text } from '../content/parse'
import { flagConditionSchema, flagsMatch, inRange, type StoryFlags } from '../levels/flags'

// The cast and their relationship with the player. Values live in the campaign's story flags
// (`rep_<id>` for disposition, `aff_<id>` for affection), so they are saved per profile with
// the campaign and every `when` condition can test them like any other flag.

const characterSchema = v.strictObject({
    id: v.pipe(v.string(), v.regex(/^[a-z]+$/)),
    name: text,
    role: text,
    // Romanceable characters also have affection.
    romance: v.boolean(),
    // Flags that keep the character aboard (saved, not left behind); always present when empty.
    present: v.optional(v.array(flagConditionSchema), []),
    // The character's cabin on the crew deck plan (ui/components/CrewDeckMap.vue units).
    cabin: v.strictObject({ code: text, map: rect }),
})
export type CharacterDefinition = v.InferOutput<typeof characterSchema>

const castSchema = v.pipe(
    v.strictObject({
        // Both values are clamped to this range; everyone starts at 0.
        range: v.strictObject({ min: v.number(), max: v.number() }),
        // Disposition from which a character counts as an ally (ending conditions).
        allyAt: v.number(),
        // Affection from which a romanceable character can be the player's partner.
        romanceAt: v.number(),
        // Disposition labels, highest first; the last one covers the bottom of the range.
        standings: v.pipe(
            v.array(v.strictObject({ atLeast: v.number(), label: text })),
            v.nonEmpty(),
        ),
        // The common room in the middle of the crew deck plan.
        wardroom: v.strictObject({ code: text, name: text, map: rect }),
        // Listed order breaks ties between partners with equal affection.
        characters: v.pipe(v.array(characterSchema), v.nonEmpty()),
    }),
    v.check((cast) => cast.range.min < 0 && cast.range.max > 0, 'The range must include 0'),
    v.check(
        (cast) => cast.romanceAt > 0 && cast.romanceAt <= cast.range.max,
        'romanceAt must be reachable',
    ),
    v.check(
        (cast) => new Set(cast.characters.map((c) => c.id)).size === cast.characters.length,
        'Character ids must be unique',
    ),
    v.check(
        (cast) => new Set(cast.characters.map((c) => c.cabin.code)).size === cast.characters.length,
        'Every character has a cabin of their own',
    ),
    v.check(
        (cast) =>
            cast.standings.every(
                (standing, index) =>
                    index === 0 || standing.atLeast < cast.standings[index - 1]!.atLeast,
            ) && cast.standings[cast.standings.length - 1]!.atLeast <= cast.range.min,
        'Standings go from highest to lowest and cover the whole range',
    ),
)

export const CAST = parseContent(castSchema, data, 'content/cast.json')
export const CHARACTER_IDS: readonly string[] = CAST.characters.map((c) => c.id)
export const ROMANCE_IDS: readonly string[] = CAST.characters
    .filter((c) => c.romance)
    .map((c) => c.id)

export const characterIdSchema = v.picklist(CHARACTER_IDS as [string, ...string[]])

// A change of standing with one character. For a romanceable character the choice changes
// both values: affection follows disposition unless set explicitly (0 keeps it professional).
// For everyone else only disposition exists.
export const relationshipChangeSchema = v.strictObject({
    character: characterIdSchema,
    disposition: v.pipe(v.number(), v.integer()),
    affection: v.optional(v.pipe(v.number(), v.integer())),
})
export type RelationshipChange = v.InferOutput<typeof relationshipChangeSchema>

// Valibot variants take plain objects, so effect schemas run this check on the whole effect.
export function relationshipAllowed(effect: {
    type: string
    character?: string
    affection?: number
}): boolean {
    return (
        effect.type !== 'relationship' ||
        effect.affection === undefined ||
        ROMANCE_IDS.includes(effect.character ?? '')
    )
}
export const RELATIONSHIP_ISSUE = 'Only romanceable characters have affection'

export function dispositionFlag(id: string): string {
    return `rep_${id}`
}
export function affectionFlag(id: string): string {
    return `aff_${id}`
}
// Set to 1 when the player commits to this partner before the finale.
export function commitmentFlag(id: string): string {
    return `romance_${id}`
}
// Set when the player skips the commitment scene: no partner in this campaign.
export const ROMANCE_DECLINED_FLAG = 'romance_declined'

export function character(id: string): CharacterDefinition | null {
    return CAST.characters.find((c) => c.id === id) ?? null
}

export function disposition(flags: Readonly<StoryFlags>, id: string): number {
    return flags[dispositionFlag(id)] ?? 0
}

export function affection(flags: Readonly<StoryFlags>, id: string): number {
    return flags[affectionFlag(id)] ?? 0
}

export function isPresent(flags: Readonly<StoryFlags>, id: string): boolean {
    const definition = character(id)
    return !!definition && flagsMatch(flags, definition.present)
}

function clamp(value: number): number {
    return Math.max(CAST.range.min, Math.min(CAST.range.max, value))
}

export function applyRelationship(flags: StoryFlags, change: RelationshipChange): void {
    const definition = character(change.character)
    if (!definition) return
    const rep = dispositionFlag(definition.id)
    flags[rep] = clamp((flags[rep] ?? 0) + change.disposition)
    if (!definition.romance) return
    const aff = affectionFlag(definition.id)
    flags[aff] = clamp((flags[aff] ?? 0) + (change.affection ?? change.disposition))
}

export function standing(value: number): string {
    return (
        CAST.standings.find((s) => value >= s.atLeast) ?? CAST.standings[CAST.standings.length - 1]!
    ).label
}

// Present characters whose disposition is in the bounds (ally count for endings).
export function countAllies(flags: Readonly<StoryFlags>, atLeast = CAST.allyAt): number {
    return CHARACTER_IDS.filter(
        (id) => isPresent(flags, id) && inRange(disposition(flags, id), { atLeast }),
    ).length
}

// Present romanceable characters with enough affection, highest first; ties keep cast order.
export function romanceCandidates(flags: Readonly<StoryFlags>): string[] {
    return ROMANCE_IDS.filter(
        (id) => isPresent(flags, id) && affection(flags, id) >= CAST.romanceAt,
    ).sort((a, b) => affection(flags, b) - affection(flags, a))
}

export function committedPartner(flags: Readonly<StoryFlags>): string | null {
    return ROMANCE_IDS.find((id) => (flags[commitmentFlag(id)] ?? 0) >= 1) ?? null
}

// Several characters qualify and the player has not chosen yet: the choice scene must play.
// `enabled` is the player's romance setting; with it off there is never a partner.
export function needsCommitment(flags: Readonly<StoryFlags>, enabled = true): boolean {
    return (
        enabled &&
        !flags[ROMANCE_DECLINED_FLAG] &&
        !committedPartner(flags) &&
        romanceCandidates(flags).length > 1
    )
}

// The partner of the ending. A commitment is final: if that partner no longer qualifies,
// there is nobody (no falling back to someone else). Without a commitment the eligible
// character with the highest affection is chosen.
export function romancePartner(flags: Readonly<StoryFlags>, enabled = true): string | null {
    if (!enabled || flags[ROMANCE_DECLINED_FLAG]) return null
    const candidates = romanceCandidates(flags)
    const committed = committedPartner(flags)
    if (committed) return candidates.includes(committed) ? committed : null
    return candidates[0] ?? null
}
