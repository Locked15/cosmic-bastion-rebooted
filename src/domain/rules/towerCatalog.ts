import * as v from 'valibot'
import data from '@/content/towers.json'
import { count, parseContent, positive, recordOf, text } from '../content/parse'

// Each tower type has its own behaviour in code (model/Tower.ts); numbers and texts are data.
export const TOWER_TYPES = ['cannon', 'rocket', 'machinegun', 'laser', 'shock'] as const
export type TowerType = (typeof TOWER_TYPES)[number]
export const TOWER_MAX_LEVEL = 3

// Stats a tower starts with or an upgrade sets. Flags switch on behaviour of the tower type.
const statsSchema = v.strictObject({
    damage: v.optional(positive),
    range: v.optional(positive),
    fireRate: v.optional(positive),
    explosionRadius: v.optional(positive),
    beamDuration: v.optional(positive),
    multiTarget: v.optional(v.boolean()),
    knockback: v.optional(v.boolean()),
    slowEffect: v.optional(v.boolean()),
    piercing: v.optional(v.boolean()),
    stunEffect: v.optional(v.boolean()),
})
export type TowerStats = v.InferOutput<typeof statsSchema>

const upgradeSchema = v.strictObject({
    cost: count,
    name: text,
    description: text,
    stats: statsSchema,
})

const entrySchema = v.pipe(
    v.strictObject({
        name: text,
        description: text,
        cost: count,
        stats: v.strictObject({
            ...statsSchema.entries,
            damage: positive,
            range: positive,
            fireRate: positive,
        }),
        upgrades: v.tuple([upgradeSchema, upgradeSchema, upgradeSchema]),
    }),
    v.transform((entry) => ({
        ...entry,
        upgradeCosts: entry.upgrades.map((upgrade) => upgrade.cost) as [number, number, number],
        benefits: {
            1: entry.upgrades[0],
            2: entry.upgrades[1],
            3: entry.upgrades[2],
        },
    })),
)
export type TowerCatalogEntry = v.InferOutput<typeof entrySchema>

export const TOWER_CATALOG: Record<TowerType, TowerCatalogEntry> = parseContent(
    recordOf(TOWER_TYPES, entrySchema),
    data,
    'content/towers.json',
)
