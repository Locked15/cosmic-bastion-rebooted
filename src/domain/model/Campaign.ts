import { LEVEL_IDS, createLevel } from '../levels/registry'
import { MISSION_SECTORS } from '../story/missions'
import type { StoryFlags } from './Level'
export interface LevelSummary {
    id: string
    name: string
    description: string
    type: 'story' | 'normal'
    completed: boolean
    stars: number
    locked: boolean
}
export interface CampaignProgress {
    flags?: StoryFlags
    completedLevels: string[]
    totalStars: number
    currentLevelIndex: number
    levels: { id: string; completed: boolean; stars: number; locked: boolean }[]
}
export class Campaign {
    levels: LevelSummary[] = []
    currentLevelIndex = 0
    completedLevels: string[] = []
    totalStars = 0
    flags: StoryFlags = {}
    constructor() {
        this.reset()
    }
    completeLevel(id: string, stars: number): void {
        const index = this.levels.findIndex((level) => level.id === id)
        const level = this.levels[index]
        if (!level) return
        level.completed = true
        level.stars = Math.max(
            level.stars,
            Number.isFinite(stars) ? Math.max(0, Math.min(3, Math.floor(stars))) : 0,
        )
        if (!this.completedLevels.includes(id)) this.completedLevels.push(id)
        for (const mission of MISSION_SECTORS) {
            const entry = this.levels.find((candidate) => candidate.id === mission.id)
            if (entry)
                entry.locked = !mission.requires.every((id) => this.completedLevels.includes(id))
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
            levels: this.levels.map(({ id, completed, stars, locked }) => ({
                id,
                completed,
                stars,
                locked,
            })),
        }
    }
    static fromProgress(progress?: CampaignProgress): Campaign {
        const campaign = new Campaign()
        for (const level of progress?.levels ?? []) {
            if (level.completed) campaign.completeLevel(level.id, level.stars)
        }
        for (const [key, value] of Object.entries(progress?.flags ?? {})) {
            if (Number.isFinite(value)) campaign.flags[key] = value
        }
        const selected = campaign.levels[progress?.currentLevelIndex ?? 0]
        if (selected && !selected.locked) campaign.selectLevel(selected.id)
        return campaign
    }
    reset(): void {
        this.levels = LEVEL_IDS.map((id, index) => {
            const level = createLevel(id)!
            return {
                id,
                name: level.name,
                description: level.description,
                type: level.type,
                completed: false,
                stars: 0,
                locked: index > 0,
            }
        })
        this.currentLevelIndex = 0
        this.completedLevels = []
        this.totalStars = 0
        this.flags = {}
    }
}
