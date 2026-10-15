import { levelDefinition } from '../levels/registry'
import { DIFFICULTY_IDS, isDifficultyId, type DifficultyId } from '../rules/difficulty'
import { CAMPAIGN } from '../story/campaign'
import type { StoryFlags } from './Level'
export interface LevelSummary {
    id: string
    name: string
    description: string
    type: 'story' | 'normal'
    completed: boolean
    stars: number
    locked: boolean
    // Hardest rank this level was won on.
    difficulty?: DifficultyId
}
// Highest completed difficulty per level id.
export type DifficultyRecords = Readonly<Record<string, DifficultyId>>
export interface CampaignProgress {
    flags?: StoryFlags
    completedLevels: string[]
    totalStars: number
    currentLevelIndex: number
    levels: {
        id: string
        completed: boolean
        stars: number
        locked: boolean
        difficulty?: DifficultyId
    }[]
}

const rankOf = (id: DifficultyId) => DIFFICULTY_IDS.indexOf(id)
export class Campaign {
    levels: LevelSummary[] = []
    currentLevelIndex = 0
    completedLevels: string[] = []
    totalStars = 0
    flags: StoryFlags = {}
    constructor() {
        this.reset()
    }
    completeLevel(id: string, stars: number, difficulty?: DifficultyId): void {
        const index = this.levels.findIndex((level) => level.id === id)
        const level = this.levels[index]
        if (!level) return
        level.completed = true
        if (
            isDifficultyId(difficulty) &&
            (!level.difficulty || rankOf(difficulty) > rankOf(level.difficulty))
        )
            level.difficulty = difficulty
        level.stars = Math.max(
            level.stars,
            Number.isFinite(stars) ? Math.max(0, Math.min(3, Math.floor(stars))) : 0,
        )
        if (!this.completedLevels.includes(id)) this.completedLevels.push(id)
        for (const sector of CAMPAIGN.sectors) {
            const entry = this.levels.find((candidate) => candidate.id === sector.level)
            if (entry)
                entry.locked = !sector.requires.every((id) => this.completedLevels.includes(id))
        }
        this.totalStars = this.levels.reduce((sum, entry) => sum + entry.stars, 0)
    }
    selectLevel(id: string): LevelSummary | null {
        const index = this.levels.findIndex((level) => level.id === id)
        const level = this.levels[index]
        if (!level || level.locked) return null
        this.currentLevelIndex = index
        return level
    }
    isUnlocked(id: string): boolean {
        return this.levels.some((level) => level.id === id && !level.locked)
    }
    getCurrentLevel(): LevelSummary {
        return this.levels[this.currentLevelIndex]!
    }
    get difficultyRecords(): DifficultyRecords {
        return Object.fromEntries(
            this.levels.flatMap((level) =>
                level.difficulty ? [[level.id, level.difficulty]] : [],
            ),
        )
    }

    getLevelProgress(): { completed: number; total: number; stars: number; maxStars: number } {
        return {
            completed: this.completedLevels.length,
            total: this.levels.length,
            stars: this.totalStars,
            maxStars: this.levels.length * 3,
        }
    }
    toProgress(): CampaignProgress {
        return {
            flags: { ...this.flags },
            completedLevels: [...this.completedLevels],
            totalStars: this.totalStars,
            currentLevelIndex: this.currentLevelIndex,
            levels: this.levels.map(({ id, completed, stars, locked, difficulty }) => ({
                id,
                completed,
                stars,
                locked,
                ...(difficulty ? { difficulty } : {}),
            })),
        }
    }
    static fromProgress(progress?: CampaignProgress): Campaign {
        const campaign = new Campaign()
        for (const level of progress?.levels ?? []) {
            if (level.completed) campaign.completeLevel(level.id, level.stars, level.difficulty)
        }
        for (const [key, value] of Object.entries(progress?.flags ?? {})) {
            if (Number.isFinite(value)) campaign.flags[key] = value
        }
        const selected = campaign.levels[progress?.currentLevelIndex ?? 0]
        if (selected && !selected.locked) campaign.selectLevel(selected.id)
        return campaign
    }
    reset(): void {
        this.levels = CAMPAIGN.sectors.map((sector) => {
            const level = levelDefinition(sector.level)!
            return {
                id: level.id,
                name: level.name,
                description: level.description,
                type: level.type,
                completed: false,
                stars: 0,
                locked: sector.requires.length > 0,
            }
        })
        this.currentLevelIndex = 0
        this.completedLevels = []
        this.totalStars = 0
        this.flags = {}
    }
}
