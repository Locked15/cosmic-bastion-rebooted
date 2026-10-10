import { Campaign, createLevel, type CampaignProgress, type Level, type StoryFlags } from '@/domain'
import { MISSION_SECTORS } from '@/domain/story/missions'
import { technologyUnlocks, type TechnologyUnlocks } from '@/domain/story/technology'
import type { CampaignResolution, LevelSummary, ObjectiveView } from './dto/views'
import type { KeyValueStore } from './ports/KeyValueStore'
import type { SessionOptions } from './session/GameSession'

const CAMPAIGN_KEY = 'campaign'

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
            const sector = MISSION_SECTORS.find((mission) => mission.id === entry.id)!
            return {
                id: entry.id,
                name: entry.name,
                description: entry.description,
                story: entry.type === 'story',
                locked: entry.locked,
                completed: entry.completed,
                stars: entry.stars,
                objectives: level.objectives.map((objective) => objective.text),
                sector: sector.sector,
                mapX: sector.x,
                mapY: sector.y,
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
        return {
            unlockedTowers: unlocks.towers,
            unlockedBarricades: unlocks.barricades,
            campaignFlags: {
                ...this.campaign.flags,
                mission_index: Number(level.id.split('_')[1]),
                tech_upgrade_tier: unlocks.upgradeTier,
            },
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
        if (!level || !this.isUnlocked(levelId)) return { advanced: false, unlocks: [] }
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
        return { advanced, unlocks }
    }

    reset(): void {
        this.campaign.reset()
        this.storage.remove(CAMPAIGN_KEY)
    }

    private applyStartingConditions(level: Level): void {
        const flags = this.campaign.flags
        if (level.id !== 'level_1') level.startingResources += flags.supply_cache ?? 0
        if (level.id === 'level_3') level.startingResources += flags.lab_supplies ?? 0
        if (level.id === 'level_4') {
            level.startingMiners += Math.floor(
                ((flags.survivors_level_2 ?? 0) + (flags.survivors_level_3 ?? 0)) / 10,
            )
        }
        if (level.id === 'level_5')
            level.startingMilitary += Math.floor((flags.survivors_level_4 ?? 0) / 10)
    }

    private save(): void {
        this.storage.write(CAMPAIGN_KEY, this.campaign.toProgress())
    }
}
