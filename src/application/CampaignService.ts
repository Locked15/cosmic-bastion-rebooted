import { Campaign, createLevel, type CampaignProgress } from '@/domain'
import type { LevelSummary } from './dto/views'
import type { KeyValueStore } from './ports/KeyValueStore'

const CAMPAIGN_KEY = 'campaign'

// Use cases around campaign progress: list levels, complete one, reset.
export class CampaignService {
    private campaign: Campaign

    constructor(private readonly storage: KeyValueStore) {
        this.campaign = Campaign.fromProgress(
            storage.read<CampaignProgress>(CAMPAIGN_KEY) ?? undefined,
        )
    }

    get hasProgress(): boolean {
        return this.campaign.completedLevels.length > 0
    }

    listLevels(): LevelSummary[] {
        return this.campaign.levels.map((entry) => {
            const level = createLevel(entry.id)!
            return {
                id: entry.id,
                name: entry.name,
                description: entry.description,
                story: entry.type === 'story',
                locked: entry.locked,
                completed: entry.completed,
                stars: entry.stars,
                objectives: level.objectives.map((objective) => objective.text),
                startingMiners: level.startingMiners,
                startingMilitary: level.startingMilitary,
                startingResources: level.startingResources,
                totalWaves: level.totalWaves,
            }
        })
    }

    isUnlocked(levelId: string): boolean {
        return this.campaign.isUnlocked(levelId)
    }

    completeLevel(levelId: string, stars: number): void {
        this.campaign.completeLevel(levelId, stars)
        this.save()
    }

    reset(): void {
        this.campaign.reset()
        this.storage.remove(CAMPAIGN_KEY)
    }

    private save(): void {
        this.storage.write(CAMPAIGN_KEY, this.campaign.toProgress())
    }
}
