import type { Level, Objective, ObjectiveKind } from '@/domain'
import type { GameSession } from './GameSession'

// Session events that complete objectives of the matching kind.
export type ObjectiveEvent = Extract<ObjectiveKind, 'survive' | 'buildTower' | 'buildBarricade'>

// Objectives are declared in level data by kind (see domain/levels/schema.ts).
// Tower counts are milestones. Loss/breach limits must hold over the whole mission
// and become completed only on victory. A breach is one enemy admitted to quarters.
export class ObjectiveTracker {
    private failed = new Set<string>()

    constructor(private readonly level: Level) {}

    get all(): readonly Objective[] {
        return this.level.objectives
    }

    get completedCount(): number {
        return this.level.objectives.filter((objective) => objective.completed).length
    }

    // Texts of the objectives this session event completed just now.
    notify(event: ObjectiveEvent): string[] {
        return this.all
            .filter((objective) => objective.kind === event)
            .flatMap((objective) => this.mark(objective.id) ?? [])
    }

    // Marks one objective done by id (used when restoring a checkpoint).
    complete(id: string): string | null {
        return this.mark(id)
    }

    private mark(id: string): string | null {
        const objective = this.level.objectives.find((candidate) => candidate.id === id)
        if (!objective || objective.completed) return null
        objective.completed = true
        this.level.objectivesCompleted[id] = true
        return objective.text
    }

    update(session: GameSession): string[] {
        const texts: string[] = []
        for (const objective of this.all) {
            if (objective.completed) continue
            const target = objective.target ?? 0
            let done = false
            switch (objective.kind) {
                case 'activeTowers':
                    done =
                        session.slots.filter((slot) => slot.tower?.active && !slot.tower.disabled)
                            .length >= target
                    break
                case 'towerLevel':
                    done = session.slots.some((slot) => slot.tower && slot.tower.level >= target)
                    break
                case 'maxBreaches':
                case 'maxLosses': {
                    const count =
                        objective.kind === 'maxBreaches'
                            ? session.stats.reached
                            : session.stats.lost
                    if (count > target) this.failed.add(objective.id)
                    done = session.result?.outcome === 'victory' && !this.failed.has(objective.id)
                    break
                }
                case 'flag':
                    done = (session.story.flags[objective.flag!] ?? 0) > 0
                    break
                case 'survive':
                    done = session.result?.outcome === 'victory'
                    break
            }
            if (done) {
                const text = this.mark(objective.id)
                if (text) texts.push(text)
            }
        }
        return texts
    }
}
