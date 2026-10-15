import { lineIntersectsRect, projectOntoPath } from '../geometry'
import type { Point, Rect } from '../geometry'
import type { CarryOver, LevelDefinition, LevelEvent, Objective } from '../levels/schema'
import type { Barricade } from './Barricade'

export type {
    CarryOver,
    EventCost,
    EventEffect,
    FlagCondition,
    LevelDefinition,
    LevelEvent,
    Objective,
    ObjectiveKind,
    StoryChoice,
    StoryDialog,
    StoryFlags,
} from '../levels/schema'

export type TowerSlotData = LevelDefinition['towerSlots'][number]

// How far from the track centerline a click may be to place a barricade on it.
export const TRACK_SNAP_RADIUS = 30

// A level being played: a fresh copy of its definition plus the objectives' progress.
export class Level {
    width = 1200
    height = 700
    livingQuartersY = 450
    basePath: Point[] = []
    alternativePaths: Point[][] = []
    corridors: Rect[] = []
    towerSlots: TowerSlotData[] = []
    totalWaves = 5
    waveDifficulty = 1
    startingMiners = 10
    startingMilitary = 5
    startingResources = 100
    objectives: Objective[] = []
    objectivesCompleted: Record<string, boolean> = {}
    events: LevelEvent[] = []
    carryOver: CarryOver[] = []
    constructor(
        public id: string,
        public name: string,
        public description: string,
        public type: 'story' | 'normal' = 'normal',
    ) {}

    // Every call returns an independent copy, so a session may change its level freely.
    static fromDefinition(definition: LevelDefinition): Level {
        const data = structuredClone(definition)
        const level = new Level(data.id, data.name, data.description, data.type)
        level.width = data.width
        level.height = data.height
        level.livingQuartersY = data.livingQuartersY
        level.basePath = data.paths.base
        level.alternativePaths = data.paths.alternatives
        level.corridors = data.corridors
        level.towerSlots = data.towerSlots
        level.totalWaves = data.waves.total
        level.waveDifficulty = data.waves.difficulty
        level.startingMiners = data.start.miners
        level.startingMilitary = data.start.military
        level.startingResources = data.start.resources
        level.objectives = data.objectives.map((objective) => ({ ...objective, completed: false }))
        level.events = data.events
        level.carryOver = data.carryOver
        return level
    }

    getCurrentPath(barricades: Barricade[]): Point[] {
        for (const barricade of barricades) {
            if (barricade.active && this.pathIntersectsBarricade(this.basePath, barricade)) {
                const alternative = this.alternativePaths[0]
                if (alternative) return alternative.map((point) => ({ ...point }))
            }
        }
        return this.basePath.map((point) => ({ ...point }))
    }
    pathIntersectsBarricade(path: Point[], barricade: Rect): boolean {
        return path
            .slice(1)
            .some((point, index) => lineIntersectsRect(path[index]!, point, barricade))
    }
    // All routes enemies can take.
    get paths(): Point[][] {
        return [this.basePath, ...this.alternativePaths]
    }

    // Where a barricade of `size` may stand when the player points at `point`:
    // snapped onto the enemy track, or nowhere if the point is too far from it.
    barricadePlacement(point: Point, size: number): Rect | null {
        let best: Point | null = null
        let bestDistance: number = TRACK_SNAP_RADIUS
        for (const path of this.paths) {
            const projection = projectOntoPath(point, path)
            if (
                projection &&
                projection.distance <= bestDistance &&
                projection.point.y < this.livingQuartersY - size / 2
            ) {
                best = projection.point
                bestDistance = projection.distance
            }
        }
        return best
            ? { x: best.x - size / 2, y: best.y - size / 2, width: size, height: size }
            : null
    }
}
