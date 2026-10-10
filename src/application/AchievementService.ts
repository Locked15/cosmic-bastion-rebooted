import { ACHIEVEMENTS, newAchievements, type AchievementFacts } from '@/domain/achievements'
import type { AchievementView } from './dto/achievements'
import type { KeyValueStore } from './ports/KeyValueStore'

const ACHIEVEMENTS_KEY = 'achievements'

// Unlocks achievements from level facts and keeps them across sessions.
export class AchievementService {
    private readonly unlocked: Set<string>

    constructor(private readonly storage: KeyValueStore) {
        this.unlocked = new Set(storage.read<string[]>(ACHIEVEMENTS_KEY) ?? [])
    }

    // Returns titles of achievements unlocked by these facts just now.
    check(facts: AchievementFacts): string[] {
        const earned = newAchievements(facts, this.unlocked)
        if (earned.length === 0) return []
        for (const achievement of earned) this.unlocked.add(achievement.id)
        this.storage.write(ACHIEVEMENTS_KEY, [...this.unlocked])
        return earned.map((achievement) => achievement.title)
    }

    list(): AchievementView[] {
        return ACHIEVEMENTS.map(({ id, title, description }) => ({
            id,
            title,
            description,
            unlocked: this.unlocked.has(id),
        }))
    }

    reset(): void {
        this.unlocked.clear()
        this.storage.remove(ACHIEVEMENTS_KEY)
    }
}
