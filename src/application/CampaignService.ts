import {
    CAMPAIGN,
    Campaign,
    campaignSector,
    createLevel,
    flagsMatch,
    missionIndex,
    resolveEnding,
    type CampaignProgress,
    type CampaignSector,
    type EnemyAbility,
    type EventEffect,
    type Level,
    type StoryFlags,
} from '@/domain'
import { technologyUnlocks, type TechnologyUnlocks } from '@/domain/story/technology'
import type { CampaignResolution, LevelSummary, ObjectiveView } from './dto/views'
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
}

export class CampaignService {
    private campaign: Campaign

    constructor(private readonly storage: KeyValueStore) {
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

    get unlocks(): TechnologyUnlocks {
        const count = this.campaign.levels.filter(
            (level) => level.type === 'story' && level.completed,
        ).length
        return technologyUnlocks(count, this.campaign.flags)
    }

    listLevels(): LevelSummary[] {
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
                startingResources: level.startingResources,
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
            return { advanced: false, unlocks: [], ending: null }
        const before = new Set(this.unlocks.technologies.map((tech) => tech.id))
        for (const [key, value] of Object.entries(report.flags)) {
            if (key !== 'mission_index' && key !== 'tech_upgrade_tier' && Number.isFinite(value)) {
                this.campaign.flags[key] = value
            }
        }
        this.campaign.flags[`survivors_${levelId}`] = Math.max(0, Math.floor(report.survivors))
        // Only a won mission completes the level and opens the next sectors.
        const advanced = report.outcome === 'victory'
        if (advanced) this.campaign.completeLevel(levelId, report.stars)
        const unlocks = this.unlocks.technologies
            .filter((tech) => !before.has(tech.id))
            .map((tech) => tech.name)
        this.save()
        // The finale closes the story either way: a defeat there is an ending too.
        const ending =
            levelId === CAMPAIGN.finale ? resolveEnding(report.outcome, this.campaign.flags) : null
        return { advanced, unlocks, ending }
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

    private save(): void {
        this.storage.write(CAMPAIGN_KEY, this.campaign.toProgress())
    }
}
