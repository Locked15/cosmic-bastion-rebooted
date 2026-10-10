import { BARRICADE_CATALOG, TOWER_CATALOG, type BarricadeType, type TowerType } from '@/domain'
import type { BuildOption } from '../../dto/views'

const UNLOCKED_TOWERS: TowerType[] = ['cannon', 'machinegun', 'rocket']
const UNLOCKED_BARRICADES: BarricadeType[] = ['wall', 'filter']

export function presentBuildOptions(resources: number): BuildOption[] {
    const towers = UNLOCKED_TOWERS.map((type) => ({
        category: 'tower' as const,
        type,
        ...TOWER_CATALOG[type],
    }))
    const barricades = UNLOCKED_BARRICADES.map((type) => ({
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
