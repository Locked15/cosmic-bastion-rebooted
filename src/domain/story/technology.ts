import type { StoryFlags } from '../model/Level'
import type { TowerType } from '../rules/towerCatalog'
import type { BarricadeType } from '../rules/barricadeCatalog'

export interface Technology {
    id: string
    name: string
    storyCompletions: number
    tower?: TowerType
    barricade?: BarricadeType
    upgradeTier?: number
}

// Progress follows completed story missions; branch order does not matter.
export const TECHNOLOGIES: readonly Technology[] = [
    { id: 'cannon', name: 'Пушка', storyCompletions: 0, tower: 'cannon' },
    { id: 'machinegun', name: 'Пулемёт', storyCompletions: 0, tower: 'machinegun' },
    { id: 'wall', name: 'Стандартная стена', storyCompletions: 0, barricade: 'wall' },
    { id: 'upgrade_1', name: 'Улучшения I', storyCompletions: 0, upgradeTier: 1 },
    { id: 'rocket', name: 'Ракетница', storyCompletions: 1, tower: 'rocket' },
    { id: 'filter', name: 'Баррикада «Фильтр»', storyCompletions: 1, barricade: 'filter' },
    { id: 'upgrade_2', name: 'Улучшения II', storyCompletions: 1, upgradeTier: 2 },
    { id: 'laser', name: 'Лазерная установка', storyCompletions: 2, tower: 'laser' },
    { id: 'shock', name: 'Электрошоковая установка', storyCompletions: 2, tower: 'shock' },
    { id: 'shield', name: 'Лазерный щит', storyCompletions: 2, barricade: 'shield' },
    { id: 'upgrade_3', name: 'Улучшения III', storyCompletions: 2, upgradeTier: 3 },
]

export interface TechnologyUnlocks {
    towers: TowerType[]
    barricades: BarricadeType[]
    upgradeTier: number
    technologies: Technology[]
}

export function technologyUnlocks(
    storyCompletions: number,
    flags: Readonly<StoryFlags>,
): TechnologyUnlocks {
    const technologies = TECHNOLOGIES.filter(
        (tech) => tech.storyCompletions <= storyCompletions || (flags[`tech_${tech.id}`] ?? 0) > 0,
    )
    return {
        towers: technologies.flatMap((tech) => (tech.tower ? [tech.tower] : [])),
        barricades: technologies.flatMap((tech) => (tech.barricade ? [tech.barricade] : [])),
        upgradeTier: Math.max(0, ...technologies.map((tech) => tech.upgradeTier ?? 0)),
        technologies: technologies.map((tech) => ({ ...tech })),
    }
}
