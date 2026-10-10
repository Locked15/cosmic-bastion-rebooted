import { lineIntersectsRect, pointInRect } from '../geometry'
import type { Point, Rect } from '../geometry'
import type { TowerType } from '../rules/towerCatalog'
import type { Barricade } from './Barricade'

export type EventEffect =
    | { type: 'resources'; value: number; military?: number }
    | { type: 'convert'; count: number }
    | { type: 'addMilitary'; count: number }
    | { type: 'addMiners'; count: number }
    | { type: 'addPersonnel'; miners: number; military: number }
    | { type: 'removeMilitary'; count: number; resources: number }
    | { type: 'emergency'; resources: number; military: number }
    | { type: 'buffDamage'; value: number }
    | { type: 'buffBarricades'; value: number }
    | { type: 'superWeapon'; military: number; killPercent: number }
export interface StoryDialog {
    title: string
    text: string
    choices: { text: string; effect: EventEffect | null }[]
    timed: boolean
    timeLimit?: number
}
export interface LevelEvent {
    wave: number
    trigger: 'start'
    dialog: StoryDialog
}
export interface Objective {
    id: string
    text: string
    completed: boolean
}
export interface FloorBreach extends Rect {
    closed: boolean
    canBeClosed: boolean
}
export interface TowerSlotData extends Point {
    type: TowerType
}
export class Level {
    width = 1200
    height = 700
    corridorHeight = 450
    livingQuartersY = 450
    basePath: Point[] = []
    alternativePaths: Point[][] = []
    corridors: Rect[] = []
    spawnPoints: Point[] = []
    exitPoints: Point[] = []
    floorBreaches: FloorBreach[] = []
    towerSlots: TowerSlotData[] = []
    barricadeSlots: Rect[] = []
    totalWaves = 5
    currentWave = 0
    waveDifficulty = 1
    startingMiners = 10
    startingMilitary = 5
    startingResources = 100
    objectives: Objective[] = []
    objectivesCompleted: Record<string, boolean> = {}
    events: LevelEvent[] = []
    completed = false
    locked = false
    stars = 0
    constructor(
        public id: string,
        public name: string,
        public description: string,
        public type: 'story' | 'normal' = 'normal',
    ) {}
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
    checkBreachFall(point: Point): boolean {
        return this.floorBreaches.some((breach) => !breach.closed && pointInRect(point, breach))
    }
    closeBreach(index: number): void {
        const breach = this.floorBreaches[index]
        if (breach) breach.closed = true
    }
}
