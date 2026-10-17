import * as v from 'valibot'
import data from '@/content/scenes.json'
import { parseContent, text } from '../content/parse'
import { flagName, type StoryFlags } from '../levels/flags'
import { CAMPAIGN } from './campaign'
import {
    RELATIONSHIP_ISSUE,
    ROMANCE_DECLINED_FLAG,
    ROMANCE_IDS,
    applyRelationship,
    character,
    characterIdSchema,
    commitmentFlag,
    needsCommitment,
    relationshipChangeSchema,
    relationshipAllowed,
    romanceCandidates,
    type RelationshipChange,
} from './cast'
import { conditionsHold, storyConditionSchema, type ConditionContext } from './conditions'

// Visual-novel scenes between missions, played from the ship map.

const levelId = v.pipe(v.string(), v.regex(/^level_\d+$/))
const sceneId = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_]*$/))

// Scenes happen off the battlefield: they change relationships and story flags only.
export type SceneEffect =
    | ({ type: 'relationship' } & RelationshipChange)
    | { type: 'flag'; name: string; value: number }

const sceneEffectSchema: v.GenericSchema<SceneEffect> = v.pipe(
    v.variant('type', [
        v.strictObject({ type: v.literal('relationship'), ...relationshipChangeSchema.entries }),
        v.strictObject({ type: v.literal('flag'), name: flagName, value: v.number() }),
    ]),
    v.check((effect) => relationshipAllowed(effect), RELATIONSHIP_ISSUE),
)

const sceneChoiceSchema = v.strictObject({
    text,
    // A romantic line: hidden when the player turned romance off in the settings.
    romantic: v.optional(v.boolean(), false),
    // Hidden unless these hold (an intimate line needs some affection first).
    when: v.optional(v.array(storyConditionSchema), []),
    // What the character answers.
    reply: text,
    effects: v.optional(v.array(sceneEffectSchema), []),
})

const sceneSchema = v.pipe(
    v.strictObject({
        id: sceneId,
        // Played once the level is won (on the ship map) or right before it starts.
        after: v.optional(levelId),
        before: v.optional(levelId),
        when: v.optional(v.array(storyConditionSchema), []),
        // The character who speaks; their name heads the scene.
        speaker: characterIdSchema,
        // Where it happens ("Каюта Кирх, третья вахта").
        place: text,
        lines: v.pipe(v.array(text), v.nonEmpty()),
        choices: v.pipe(v.array(sceneChoiceSchema), v.minLength(2)),
    }),
    v.check(
        (scene) => (scene.after === undefined) !== (scene.before === undefined),
        'A scene plays either after or before a level',
    ),
    v.check(
        (scene) =>
            scene.choices.filter((choice) => !choice.when.length && !choice.romantic).length >= 2,
        'A scene needs at least two choices that are always available',
    ),
    v.check(
        (scene) =>
            scene.choices.every(
                (choice) =>
                    choice.romantic ||
                    !choice.when.some((c) => 'kind' in c && c.kind === 'affection'),
            ),
        'A choice that needs affection is romantic',
    ),
)
export type SceneDefinition = v.InferOutput<typeof sceneSchema>

// The scene before the finale where the player commits to one partner. Its choices are made
// from the romanceable characters who qualify, so the texts are given per character.
const commitmentSchema = v.strictObject({
    place: text,
    lines: v.pipe(v.array(text), v.nonEmpty()),
    choices: v.record(characterIdSchema, v.strictObject({ text, reply: text })),
    // Affection change for each qualifying character who was not chosen.
    rejected: v.pipe(v.number(), v.integer(), v.maxValue(0)),
})

const scenesSchema = v.pipe(
    v.strictObject({
        commitment: commitmentSchema,
        scenes: v.array(sceneSchema),
    }),
    v.check(
        (content) => new Set(content.scenes.map((s) => s.id)).size === content.scenes.length,
        'Scene ids must be unique',
    ),
    v.check(
        (content) =>
            content.scenes.every((scene) =>
                [scene.after, scene.before].every(
                    (id) => id === undefined || CAMPAIGN.sectors.some((s) => s.level === id),
                ),
            ),
        'Scenes may only refer to levels on the campaign map',
    ),
    v.check(
        (content) =>
            ROMANCE_IDS.every((id) => id in content.commitment.choices) &&
            Object.keys(content.commitment.choices).every((id) => ROMANCE_IDS.includes(id)),
        'The commitment scene needs a choice for every romanceable character, and only them',
    ),
)

const CONTENT = parseContent(scenesSchema, data, 'content/scenes.json')
export const SCENES: readonly SceneDefinition[] = CONTENT.scenes
export const COMMITMENT = CONTENT.commitment
export const COMMITMENT_SCENE_ID = 'commitment'

export function sceneFlag(id: string): string {
    return `scene_${id}`
}

// A playable scene: content scenes and the generated commitment scene look the same.
export interface StoryScene {
    id: string
    // Character id of the speaker; null for the commitment scene (several speak).
    speakerId: string | null
    speaker: string
    place: string
    lines: string[]
    choices: { text: string; reply: string; effects: SceneEffect[] }[]
}

export interface SceneProgress extends ConditionContext {
    completedLevels: readonly string[]
}

function seen(flags: Readonly<StoryFlags>, id: string): boolean {
    return (flags[sceneFlag(id)] ?? 0) >= 1
}

function playable(scene: SceneDefinition, progress: SceneProgress): StoryScene {
    return {
        id: scene.id,
        speakerId: scene.speaker,
        speaker: character(scene.speaker)!.name,
        place: scene.place,
        lines: scene.lines,
        choices: scene.choices
            .filter(
                (choice) =>
                    (!choice.romantic || (progress.romance ?? true)) &&
                    conditionsHold(progress, choice.when),
            )
            .map(({ text, reply, effects }) => ({ text, reply, effects })),
    }
}

function available(scene: SceneDefinition, progress: SceneProgress): boolean {
    return !seen(progress.flags, scene.id) && conditionsHold(progress, scene.when)
}

// Scenes waiting on the ship map: their level is won and they were not played yet.
export function scenesAfterMissions(progress: SceneProgress): StoryScene[] {
    return SCENES.filter(
        (scene) =>
            scene.after !== undefined &&
            progress.completedLevels.includes(scene.after) &&
            available(scene, progress),
    ).map((scene) => playable(scene, progress))
}

// Scenes to play before the level starts. Before the finale, the commitment scene comes last
// when several characters qualify as the player's partner.
export function scenesBeforeMission(levelId: string, progress: SceneProgress): StoryScene[] {
    const scenes = SCENES.filter(
        (scene) => scene.before === levelId && available(scene, progress),
    ).map((scene) => playable(scene, progress))
    if (levelId === CAMPAIGN.finale && needsCommitment(progress.flags, progress.romance ?? true))
        scenes.push(commitmentScene(progress.flags))
    return scenes
}

export function commitmentScene(flags: Readonly<StoryFlags>): StoryScene {
    const candidates = romanceCandidates(flags)
    return {
        id: COMMITMENT_SCENE_ID,
        speakerId: null,
        speaker: candidates.map((id) => character(id)!.name).join(' · '),
        place: COMMITMENT.place,
        lines: COMMITMENT.lines,
        choices: candidates.map((id) => ({
            ...COMMITMENT.choices[id]!,
            effects: [
                { type: 'flag', name: commitmentFlag(id), value: 1 },
                ...candidates
                    .filter((other) => other !== id)
                    .map((other): SceneEffect => ({
                        type: 'relationship',
                        character: other,
                        disposition: 0,
                        affection: COMMITMENT.rejected,
                    })),
            ],
        })),
    }
}

// Applies the choice and marks the scene as played. Returns the reply, or null if the scene
// or choice is not available (already played, wrong index).
export function playScene(
    scene: StoryScene,
    choiceIndex: number,
    flags: StoryFlags,
): { reply: string } | null {
    const choice = scene.choices[choiceIndex]
    if (!choice) return null
    for (const effect of choice.effects) {
        if (effect.type === 'flag') flags[effect.name] = effect.value
        else applyRelationship(flags, effect)
    }
    flags[sceneFlag(scene.id)] = 1
    return { reply: choice.reply }
}

// Every scene is optional: skipping marks it as played without any effect. Skipping the
// commitment scene declines romance for the rest of the campaign.
export function skipScene(scene: StoryScene, flags: StoryFlags): void {
    flags[sceneFlag(scene.id)] = 1
    if (scene.id === COMMITMENT_SCENE_ID) flags[ROMANCE_DECLINED_FLAG] = 1
}
