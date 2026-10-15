import * as v from 'valibot'
import data from '@/content/requisitions.json'
import { count, parseContent, positive, text } from '../content/parse'

// What an upgrade improves. Each kind is applied by the game session.
export const BONUS_KINDS = [
    'mining',
    'startResources',
    'buildSpeed',
    'towerRange',
    'barricadeHealth',
    'soldierDamage',
    'conversionSpeed',
    'towerDamage',
    'startMilitary',
    'breakthroughs',
] as const
export type BonusKind = (typeof BONUS_KINDS)[number]

// Kinds whose value is a fraction (+6% …); the rest are counts (+30 resources, +1 soldier).
const PERCENT_KINDS: readonly BonusKind[] = [
    'mining',
    'buildSpeed',
    'towerRange',
    'barricadeHealth',
    'soldierDamage',
    'conversionSpeed',
    'towerDamage',
]

const upgradeSchema = v.strictObject({
    id: v.pipe(v.string(), v.regex(/^[a-z_]+$/)),
    rank: v.pipe(count, v.minValue(1)),
    // Number of the paper form in the quartermaster's office.
    form: text,
    effect: v.picklist(BONUS_KINDS),
    perLevel: positive,
    maxLevel: v.pipe(count, v.minValue(1)),
    name: text,
    description: text,
})
export type UpgradeDefinition = v.InferOutput<typeof upgradeSchema>

const rulesSchema = v.pipe(
    v.strictObject({
        earning: v.strictObject({
            victory: count,
            perStar: count,
            firstVictory: count,
            replayFactor: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
            defeat: count,
        }),
        // Each next level of an upgrade costs this much more than the previous one.
        costGrowth: v.pipe(v.number(), v.minValue(1)),
        // Share of spent requisitions returned when upgrades are reset.
        resetRefund: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
        // More potent ranks start at a higher price.
        tiers: v.pipe(
            v.array(
                v.strictObject({
                    rank: v.pipe(count, v.minValue(1)),
                    title: text,
                    baseCost: count,
                }),
            ),
            v.nonEmpty(),
        ),
        upgrades: v.pipe(v.array(upgradeSchema), v.nonEmpty()),
    }),
    v.check(
        (rules) =>
            rules.upgrades.every((upgrade) =>
                rules.tiers.some((tier) => tier.rank === upgrade.rank),
            ),
        'Every upgrade needs a known rank',
    ),
    v.check(
        (rules) =>
            new Set(rules.upgrades.map((upgrade) => upgrade.id)).size === rules.upgrades.length,
        'Upgrade ids must be unique',
    ),
    v.check(
        (rules) =>
            rules.tiers.every(
                (tier, index) => index === 0 || tier.baseCost > rules.tiers[index - 1]!.baseCost,
            ),
        'Higher ranks must cost more',
    ),
)

export const REQUISITIONS = parseContent(rulesSchema, data, 'content/requisitions.json')

export type UpgradeLevels = Readonly<Record<string, number>>

export function upgradeDefinition(id: string): UpgradeDefinition | null {
    return REQUISITIONS.upgrades.find((upgrade) => upgrade.id === id) ?? null
}

// Price of raising `upgrade` from `level` to `level + 1`, rounded to 5.
export function upgradeCost(upgrade: UpgradeDefinition, level: number): number {
    const tier = REQUISITIONS.tiers.find((candidate) => candidate.rank === upgrade.rank)!
    return Math.round((tier.baseCost * REQUISITIONS.costGrowth ** level) / 5) * 5
}

// Requisitions paid for a level: a victory pays by stars, the first one adds a bonus.
export function requisitionReward(
    outcome: 'victory' | 'defeat',
    stars: number,
    firstVictory: boolean,
    multiplier = 1,
): number {
    const { earning } = REQUISITIONS
    if (outcome === 'defeat') return Math.round(earning.defeat * multiplier)
    const base = earning.victory + earning.perStar * Math.max(0, Math.min(3, stars))
    return Math.round(
        (firstVictory ? base + earning.firstVictory : Math.round(base * earning.replayFactor)) *
            multiplier,
    )
}

// Session modifiers bought with requisitions. Multipliers are 1 and counts 0 without upgrades.
export interface MetaBonuses {
    mining: number
    startResources: number
    buildSpeed: number
    towerRange: number
    barricadeHealth: number
    soldierDamage: number
    // Multiplies retraining time (below 1 is faster).
    conversionSpeed: number
    towerDamage: number
    startMilitary: number
    breakthroughs: number
}

export const NO_BONUSES: MetaBonuses = {
    mining: 1,
    startResources: 0,
    buildSpeed: 1,
    towerRange: 1,
    barricadeHealth: 1,
    soldierDamage: 1,
    conversionSpeed: 1,
    towerDamage: 1,
    startMilitary: 0,
    breakthroughs: 0,
}

// Total value of an effect at `level` (a fraction for percent kinds, a count otherwise).
export function effectValue(upgrade: UpgradeDefinition, level: number): number {
    return upgrade.perLevel * level
}

export function isPercentEffect(kind: BonusKind): boolean {
    return PERCENT_KINDS.includes(kind)
}

export function bonusesFor(levels: UpgradeLevels): MetaBonuses {
    const bonuses = { ...NO_BONUSES }
    for (const upgrade of REQUISITIONS.upgrades) {
        const level = Math.max(0, Math.min(upgrade.maxLevel, levels[upgrade.id] ?? 0))
        const value = effectValue(upgrade, level)
        if (upgrade.effect === 'conversionSpeed')
            bonuses.conversionSpeed *= Math.max(0.3, 1 - value)
        else if (isPercentEffect(upgrade.effect)) bonuses[upgrade.effect] *= 1 + value
        else bonuses[upgrade.effect] += value
    }
    return bonuses
}
