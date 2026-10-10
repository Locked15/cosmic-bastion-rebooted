import type { Level, Objective } from '@/domain'
import type { GameSession } from './GameSession'

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

    complete(id: string): string | null {
        // GameSession emits this for each upgrade; the numeric target is checked in update.
        if (id === 'upgrade_tower') return null
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
            let done = false
            // Targets live in level data; text fallback supports older custom levels.
            const target = objective.target ?? Number(objective.text.match(/\d+/)?.[0] ?? 0)
            switch (objective.id) {
                case 'max_towers':
                    done =
                        session.slots.filter((slot) => slot.tower?.active && !slot.tower.disabled)
                            .length >= target
                    break
                case 'upgrade_tower':
                    done = session.slots.some(
                        (slot) => slot.tower && slot.tower.level >= (objective.target ?? 1),
                    )
                    break
                case 'save_reactor':
                case 'no_personnel_loss': {
                    const count =
                        objective.id === 'save_reactor' ? session.stats.reached : session.stats.lost
                    if (count > target) this.failed.add(objective.id)
                    done = session.result?.outcome === 'victory' && !this.failed.has(objective.id)
                    break
                }
                case 'save_engineer':
                    done = (session.story.flags.engineer_saved ?? 0) > 0
                    break
                case 'save_scientist':
                    done = (session.story.flags.scientist_saved ?? 0) > 0
                    break
                case 'save_archive':
                    done = (session.story.flags.archive_saved ?? 0) > 0
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
