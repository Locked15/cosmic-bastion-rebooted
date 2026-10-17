import { lineIntersectsRect, projectOntoPath } from '../geometry'
import type { Point, Rect } from '../geometry'
import type {
    CarryOver,
    LevelDefinition,
    LevelEvent,
    Objective,
    RouteDefinition,
} from '../levels/schema'

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
    RouteDefinition,
    RouteRole,
} from '../levels/schema'

export type TowerSlotData = LevelDefinition['towerSlots'][number]

// How far from the track centerline a click may be to place a barricade on it.
export const TRACK_SNAP_RADIUS = 30

// A level being played: a fresh copy of its definition plus the objectives' progress.
export class Level {
    width = 1200
    height = 700
    livingQuartersY = 450
    // The first route is the main one.
    routes: RouteDefinition[] = []
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
    // Track id from content/music.json.
    music = ''
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
        level.routes = data.routes
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
        level.music = data.music
        return level
    }

    // Points of the main route.
    get basePath(): Point[] {
        return this.routes[0]?.points ?? []
    }

    // Points of every other route.
    get alternativePaths(): Point[][] {
        return this.routes.slice(1).map((route) => route.points)
    }

    // All routes enemies can take, open or not.
    get paths(): Point[][] {
        return this.routes.map((route) => route.points)
    }

    route(id: string): RouteDefinition | null {
        return this.routes.find((route) => route.id === id) ?? null
    }

    // Routes enemies of `wave` may be sent along directly (reserve routes are only detours).
    openRoutes(wave: number): RouteDefinition[] {
        return this.routes.filter((route) => !route.reserve && route.opensOnWave <= wave)
    }

    // Whether `rect` (an intact barricade) stands on the route.
    blocks(route: RouteDefinition, rect: Rect): boolean {
        const path = route.points
        return path.slice(1).some((point, index) => lineIntersectsRect(path[index]!, point, rect))
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
