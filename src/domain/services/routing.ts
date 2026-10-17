import type { Rect } from '../geometry'
import type { RouteDefinition, RouteRole } from '../levels/schema'
import type { Enemy } from '../model/Enemy'
import type { Level } from '../model/Level'
import type { Random } from '../random'

// How many detours an assignment follows before it gives up and walks into the barricade.
const MAX_DETOURS = 3

// Role routes an enemy is drawn to, best first; medium rank-and-file have none.
export function preferredRoles(enemy: Enemy): RouteRole[] {
    if (enemy.type === 'boss') return ['boss', 'heavy']
    if (enemy.type === 'miniboss' || enemy.size === 'large') return ['heavy']
    return enemy.size === 'small' ? ['fast'] : []
}

const weightOf = (route: RouteDefinition) => route.weight ?? (route.role ? 0 : 1)

function pick(routes: readonly RouteDefinition[], rng: Random): RouteDefinition {
    // A single choice draws no random number, so one-route levels play as before.
    if (routes.length === 1) return routes[0]!
    const weights = routes.map(weightOf)
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    if (total <= 0) return routes[Math.floor(rng.next() * routes.length)] ?? routes[0]!
    let roll = rng.next() * total
    for (let i = 0; i < routes.length; i++) {
        roll -= weights[i]!
        if (roll < 0) return routes[i]!
    }
    return routes[routes.length - 1]!
}

// Where the enemy goes when its route is blocked: the first detour that is not blocked itself.
// With every detour blocked it keeps its route and has to break through.
function unblocked(
    level: Level,
    route: RouteDefinition,
    blockers: readonly Rect[],
): RouteDefinition {
    let current: RouteDefinition | null = route
    for (let hop = 0; current && hop <= MAX_DETOURS; hop++) {
        const candidate: RouteDefinition = current
        if (!blockers.some((rect) => level.blocks(candidate, rect))) return candidate
        current = candidate.detour ? level.route(candidate.detour) : null
    }
    return route
}

// Sends every enemy of `wave` along a route: role routes take their kind of enemy, the rest are
// shared by weight. A route blocked by an intact barricade hands its enemies to its detour.
// Children of split or spawning enemies later inherit their parent's route.
export function assignRoutes(
    level: Level,
    wave: number,
    enemies: readonly Enemy[],
    blockers: readonly Rect[],
    rng: Random,
): RouteDefinition[] {
    const open = level.openRoutes(wave)
    const general = open.filter((route) => weightOf(route) > 0)
    return enemies.map((enemy) => {
        const matching =
            preferredRoles(enemy)
                .map((role) => open.filter((route) => route.role === role))
                .find((routes) => routes.length > 0) ?? []
        const route = pick(matching.length ? matching : general.length ? general : open, rng)
        return unblocked(level, route, blockers)
    })
}
