import type { Level, Objective } from '@/domain'
import type { GameSession } from './GameSession'

// Tracks level objectives. Event-driven ones are completed via `complete`;
// state-based ones are checked every frame in `update`.
export class ObjectiveTracker {
    constructor(private readonly level: Level) {}

    get all(): readonly Objective[] {
        return this.level.objectives
    }

    get completedCount(): number {
        return this.level.objectives.filter((objective) => objective.completed).length
    }

    // Returns the objective text when it was completed just now.
    complete(id: string): string | null {
        const objective = this.level.objectives.find((candidate) => candidate.id === id)
        if (!objective || objective.completed) return null
        objective.completed = true
        return objective.text
    }

    // State-based objectives; returns texts of objectives completed this frame.
    update(session: GameSession): string[] {
        void session
        return []
    }
}
