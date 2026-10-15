import * as v from 'valibot'
import data from '@/content/barricades.json'
import { count, parseContent, positive, recordOf, text } from '../content/parse'

export const BARRICADE_TYPES = ['wall', 'filter', 'shield'] as const
export type BarricadeType = (typeof BARRICADE_TYPES)[number]
export const BARRICADE_MAX_LEVEL = 3
export const BARRICADE_SIZE = 40

// Stats a barricade starts with or an upgrade sets. Flags switch on behaviour.
const statsSchema = v.strictObject({
    maxHealth: v.optional(positive),
    buildTime: v.optional(positive),
    damageMitigation: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
    damageToEnemies: v.optional(positive),
    filterSlowMultiplier: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
    pushBackStrength: v.optional(positive),
    maxAttackers: v.optional(count),
    selfRepair: v.optional(v.boolean()),
    knockbackEnemies: v.optional(v.boolean()),
    filterMode: v.optional(v.boolean()),
    forceField: v.optional(v.boolean()),
})
export type BarricadeStats = v.InferOutput<typeof statsSchema>

const upgradeSchema = v.strictObject({
    cost: count,
    name: text,
    description: text,
    stats: statsSchema,
    // Refill durability to the (new) maximum when the upgrade completes.
    restoreHealth: v.optional(v.boolean(), false),
})

const entrySchema = v.pipe(
    v.strictObject({
        name: text,
        description: text,
        cost: count,
        stats: v.strictObject({ ...statsSchema.entries, maxHealth: positive, buildTime: positive }),
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
export type BarricadeCatalogEntry = v.InferOutput<typeof entrySchema>

export const BARRICADE_CATALOG: Record<BarricadeType, BarricadeCatalogEntry> = parseContent(
    recordOf(BARRICADE_TYPES, entrySchema),
    data,
    'content/barricades.json',
)

// Rebuilding a destroyed barricade costs 75% of a new one.
export const BARRICADE_REPAIR_RATE = 0.75

export function barricadeRepairCost(type: BarricadeType): number {
    return Math.ceil(BARRICADE_CATALOG[type].cost * BARRICADE_REPAIR_RATE)
}
