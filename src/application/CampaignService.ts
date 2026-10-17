import {
    CAMPAIGN,
    CAST,
    Campaign,
    affection,
    disposition,
    isPresent,
    playScene,
    romancePartner,
    scenesAfterMissions,
    scenesBeforeMission,
    skipScene,
    standing,
    type DifficultyRecords,
    type SceneProgress,
    type StoryScene,
    DEFAULT_DIFFICULTY,
    DIFFICULTIES,
    campaignSector,
    createLevel,
    flagsMatch,
    missionIndex,
    resolveEnding,
    type CampaignProgress,
    type CampaignSector,
    type DifficultyId,
    type EnemyAbility,
    type EventEffect,
    type Level,
    type StoryFlags,
} from '@/domain'
import { technologyUnlocks, type TechnologyUnlocks } from '@/domain/story/technology'
import type {
    CampaignResolution,
    CrewMemberView,
    LevelSummary,
    ObjectiveView,
    SceneView,
} from './dto/views'
import type { KeyValueStore } from './ports/KeyValueStore'
import type { SessionOptions } from './session/GameSession'

const CAMPAIGN_KEY = 'campaign'

// Conduit from a required sector to `sector`: its drawn route or a line between room centres.
function route(from: string, sector: CampaignSector): [number, number][] {
    const drawn = sector.routes[from]
    if (drawn) return drawn.map(([x, y]) => [x, y])
    const source = campaignSector(from)!.map
    const target = sector.map
    return [
        [source.x + source.width / 2, source.y + source.height / 2],
        [target.x + target.width / 2, target.y + target.height / 2],
    ]
}

export interface MissionReport {
    outcome: 'victory' | 'defeat'
    stars: number
    objectives: readonly ObjectiveView[]
    flags: Readonly<StoryFlags>
    survivors: number
    // Rank the mission was played on; a victory raises the level's record.
    difficulty?: DifficultyId
}

export interface CampaignOptions {
    // Whether romance is available: the profile's answer at registration (off by default
    // there); without the option it is on, for tests and tools.
    romance?: () => boolean
}

function sceneView(scene: StoryScene): SceneView {
    return {
        id: scene.id,
        speaker: scene.speaker,
        place: scene.place,
        lines: [...scene.lines],
        choices: scene.choices.map((choice) => choice.text),
    }
}

export class CampaignService {
    private campaign: Campaign

    constructor(
        private readonly storage: KeyValueStore,
        private readonly options: CampaignOptions = {},
    ) {
        this.campaign = Campaign.fromProgress(
            storage.read<CampaignProgress>(CAMPAIGN_KEY) ?? undefined,
        )
    }

    get hasProgress(): boolean {
        return (
            this.campaign.completedLevels.length > 0 || Object.keys(this.campaign.flags).length > 0
        )
    }

    get flags(): StoryFlags {
        return { ...this.campaign.flags }
    }

    get difficultyRecords(): DifficultyRecords {
        return this.campaign.difficultyRecords
    }

    get unlocks(): TechnologyUnlocks {
        const count = this.campaign.levels.filter(
            (level) => level.type === 'story' && level.completed,
        ).length
        return technologyUnlocks(count, this.campaign.flags)
    }

    // Levels as the given rank will play them.
    listLevels(difficulty: DifficultyId = DEFAULT_DIFFICULTY): LevelSummary[] {
        const rank = DIFFICULTIES[difficulty]
        return this.campaign.levels.map((entry) => {
            const level = createLevel(entry.id)!
            this.applyStartingConditions(level)
            const sector = campaignSector(entry.id)!
            return {
                id: entry.id,
                name: entry.name,
                description: entry.description,
                story: entry.type === 'story',
                locked: entry.locked,
                completed: entry.completed,
                stars: entry.stars,
                rank: entry.difficulty ? DIFFICULTIES[entry.difficulty].label : null,
                objectives: level.objectives.map((objective) => objective.text),
                sector: sector.name,
                code: sector.code,
                layer: sector.layer,
                map: { ...sector.map },
                requires: [...sector.requires],
                routes: sector.requires.map((from) => ({ from, points: route(from, sector) })),
                threat: Math.min(5, Math.max(1, Math.round((level.waveDifficulty * 10) / 3))),
                finale: entry.id === CAMPAIGN.finale,
                prerequisites: sector.requires.map(
                    (id) => this.campaign.levels.find((candidate) => candidate.id === id)!.name,
                ),
                startingMiners: level.startingMiners,
                startingMilitary: level.startingMilitary,
                startingResources: Math.round(level.startingResources * rank.startResources),
                totalWaves: level.totalWaves,
            }
        })
    }

    // Call once on a fresh level; lists and session starts use the same conditions.
    prepareLevel(level: Level): SessionOptions {
        this.applyStartingConditions(level)
        const unlocks = this.unlocks
        const flags = this.campaign.flags
        const startEffects: { effect: EventEffect; message?: string }[] = []
        const excludedAbilities: EnemyAbility[] = []
        for (const rule of level.carryOver) {
            if (rule.type === 'effect' && flagsMatch(flags, rule.when))
                startEffects.push({ effect: rule.effect, message: rule.message })
            if (rule.type === 'excludeAbility' && flagsMatch(flags, rule.when))
                excludedAbilities.push(rule.ability)
        }
        return {
            unlockedTowers: unlocks.towers,
            unlockedBarricades: unlocks.barricades,
            campaignFlags: {
                ...flags,
                mission_index: missionIndex(level.id),
                tech_upgrade_tier: unlocks.upgradeTier,
            },
            startEffects,
            excludedAbilities,
        }
    }

    isUnlocked(levelId: string): boolean {
        return this.campaign.isUnlocked(levelId)
    }

    completeLevel(levelId: string, stars: number): void {
        this.campaign.completeLevel(levelId, stars)
        this.save()
    }

    recordResult(levelId: string, report: MissionReport): CampaignResolution {
        const level = createLevel(levelId)
        if (!level || !this.isUnlocked(levelId))
            return { advanced: false, firstVictory: false, unlocks: [], ending: null }
        const before = new Set(this.unlocks.technologies.map((tech) => tech.id))
        for (const [key, value] of Object.entries(report.flags)) {
            if (key !== 'mission_index' && key !== 'tech_upgrade_tier' && Number.isFinite(value)) {
                this.campaign.flags[key] = value
            }
        }
        this.campaign.flags[`survivors_${levelId}`] = Math.max(0, Math.floor(report.survivors))
        // Only a won mission completes the level and opens the next sectors.
        const advanced = report.outcome === 'victory'
        const firstVictory =
            advanced &&
            !this.campaign.levels.some((entry) => entry.id === levelId && entry.completed)
        if (advanced) this.campaign.completeLevel(levelId, report.stars, report.difficulty)
        const unlocks = this.unlocks.technologies
            .filter((tech) => !before.has(tech.id))
            .map((tech) => tech.name)
        this.save()
        // The finale closes the story either way: a defeat there is an ending too.
        const ending =
            levelId === CAMPAIGN.finale
                ? resolveEnding(report.outcome, this.campaign.flags, {
                      difficultyRecords: this.difficultyRecords,
                      romance: this.romance,
                  })
                : null
        return { advanced, firstVictory, unlocks, ending }
    }

    // Scenes waiting on the ship map after won missions.
    scenesAfterMissions(): SceneView[] {
        return scenesAfterMissions(this.sceneProgress).map(sceneView)
    }

    // Scenes to play before the level starts (the partner choice before the finale).
    scenesBefore(levelId: string): SceneView[] {
        if (!this.isUnlocked(levelId)) return []
        return scenesBeforeMission(levelId, this.sceneProgress).map(sceneView)
    }

    // Plays a choice of an available scene; returns the character's reply, or null.
    chooseScene(sceneId: string, choice: number): string | null {
        const scene = this.findScene(sceneId)
        const result = scene ? playScene(scene, choice, this.campaign.flags) : null
        if (result) this.save()
        return result?.reply ?? null
    }

    // Every scene can be skipped without consequences (skipping the partner choice declines).
    skipScene(sceneId: string): boolean {
        const scene = this.findScene(sceneId)
        if (!scene) return false
        skipScene(scene, this.campaign.flags)
        this.save()
        return true
    }

    // Present characters in cast order with their standing toward the player.
    crew(): CrewMemberView[] {
        const flags = this.campaign.flags
        const partner = romancePartner(flags, this.romance)
        return CAST.characters
            .filter((member) => isPresent(flags, member.id))
            .map((member) => ({
                id: member.id,
                name: member.name,
                role: member.role,
                disposition: disposition(flags, member.id),
                standing: standing(disposition(flags, member.id)),
                affection: member.romance && this.romance ? affection(flags, member.id) : null,
                partner: partner === member.id,
            }))
    }

    reset(): void {
        this.campaign.reset()
        this.storage.remove(CAMPAIGN_KEY)
    }

    // Carry-over from earlier missions (supplies, survivors) is part of the level data.
    private applyStartingConditions(level: Level): void {
        const flags = this.campaign.flags
        for (const rule of level.carryOver) {
            if (rule.type !== 'start') continue
            const sum = rule.flags.reduce((total, flag) => total + (flags[flag] ?? 0), 0)
            const bonus = Math.max(0, Math.floor(sum / rule.divide))
            if (rule.stat === 'resources') level.startingResources += bonus
            if (rule.stat === 'miners') level.startingMiners += bonus
            if (rule.stat === 'military') level.startingMilitary += bonus
        }
    }

    private get romance(): boolean {
        return this.options.romance?.() ?? true
    }

    private get sceneProgress(): SceneProgress {
        return {
            flags: this.campaign.flags,
            completedLevels: this.campaign.completedLevels,
            difficultyRecords: this.difficultyRecords,
            romance: this.romance,
        }
    }

    private findScene(sceneId: string): StoryScene | null {
        const progress = this.sceneProgress
        const candidates = [
            ...scenesAfterMissions(progress),
            ...this.campaign.levels
                .filter((level) => !level.locked)
                .flatMap((level) => scenesBeforeMission(level.id, progress)),
        ]
        return candidates.find((scene) => scene.id === sceneId) ?? null
    }

    private save(): void {
        this.storage.write(CAMPAIGN_KEY, this.campaign.toProgress())
    }
}
