import { BARRICADE_CATALOG, TOWER_CATALOG } from '@/domain'
import type { BuildOption } from '../../dto/views'
import type { GameSession } from '../GameSession'

// Only what is unlocked for this level is offered.
export function presentBuildOptions(session: GameSession): BuildOption[] {
    const resources = session.resources
    const towers = session.unlockedTowers.map((type) => ({
        category: 'tower' as const,
        type,
        ...TOWER_CATALOG[type],
    }))
    const barricades = session.unlockedBarricades.map((type) => ({
        category: 'barricade' as const,
        type,
        ...BARRICADE_CATALOG[type],
    }))
    return [...towers, ...barricades].map(({ category, type, name, description, cost }) => ({
        category,
        type,
        name,
        description,
        cost,
        affordable: resources >= cost,
    }))
}
