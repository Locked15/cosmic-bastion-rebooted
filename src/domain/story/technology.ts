import * as v from 'valibot'
import data from '@/content/technologies.json'
import { count, parseContent, text } from '../content/parse'
import type { StoryFlags } from '../model/Level'
import { TOWER_TYPES, type TowerType } from '../rules/towerCatalog'
import { BARRICADE_TYPES, type BarricadeType } from '../rules/barricadeCatalog'

const technologySchema = v.strictObject({
    id: text,
    name: text,
    // Opens once this many story missions are completed.
    storyCompletions: count,
    tower: v.optional(v.picklist(TOWER_TYPES)),
    barricade: v.optional(v.picklist(BARRICADE_TYPES)),
})
export type Technology = v.InferOutput<typeof technologySchema>

// Progress follows completed story missions; branch order does not matter. Upgrade steps of
// towers and barricades are bought at the quartermaster's (meta/requisitions.ts).
// A story flag `tech_<id>` opens a technology early.
export const TECHNOLOGIES: readonly Technology[] = parseContent(
    v.array(technologySchema),
    data,
    'content/technologies.json',
)

export interface TechnologyUnlocks {
    towers: TowerType[]
    barricades: BarricadeType[]
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
        technologies: technologies.map((tech) => ({ ...tech })),
    }
}
