import type { Barricade, Enemy, Level, Person, Point, Rect, TowerSlot } from '@/domain'
import type { BuildCategory, GameView } from '../dto/views'

// Read-only view of a running session for renderers. Renderers must not mutate it.
export interface Scene {
    readonly level: Level
    readonly view: GameView
    readonly slots: readonly TowerSlot[]
    readonly barricades: readonly Barricade[]
    readonly enemies: readonly Enemy[]
    readonly enemiesInQuarters: readonly Enemy[]
    readonly people: readonly Person[]
    readonly miners: number
    readonly military: number
    // People being retrained between roles (inactive).
    readonly inTransit: number
    readonly pointer: ScenePointer
    readonly selectedId: string | null
}

export interface ScenePointer {
    // Pointer position in world coordinates, null when outside the canvas.
    world: Point | null
    // Build mode: what the player is about to place.
    build: { category: BuildCategory; type: string; cost: number; name: string } | null
    // Empty tower slot under the pointer in tower build mode.
    slotId: string | null
    // Barricade footprint under the pointer in barricade build mode.
    footprint: Rect | null
    // Whether a barricade can be built on the footprint.
    footprintValid: boolean
    // Tower slot or barricade under the pointer outside build mode.
    hoverId: string | null
}

// World rectangle shown for each view.
export function viewRect(level: Level, view: GameView): Rect {
    return view === 'living'
        ? {
              x: 0,
              y: level.livingQuartersY,
              width: level.width,
              height: level.height - level.livingQuartersY,
          }
        : { x: 0, y: 0, width: level.width, height: level.height }
}
