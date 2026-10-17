import * as v from 'valibot'
import data from '@/content/requisitions.json'
import { count, parseContent, positive, text } from '../content/parse'
import { DIFFICULTY_IDS, type DifficultyId } from '../rules/difficulty'
import { BOSS_ABILITIES, type EnemyAbility } from '../rules/enemyRules'
import { CAMPAIGN } from '../story/campaign'
import { STORY_EXCLUDED_ABILITIES } from '../levels/registry'

// Meta-progression: requisitions earned in missions buy permanent upgrades at the
// quartermaster's terminal. Four trees, five tiers each; the content is data, the kinds of
// effects stay here and are applied by the game session.

export const TREE_IDS = ['machinery', 'crew', 'science', 'special'] as const
export type TreeId = (typeof TREE_IDS)[number]

// What an upgrade improves.
export const BONUS_KINDS = [
    // Machinery: towers and barricades.
    'towerDamage',
    'towerRange',
    'fireRate',
    'barricadeHealth',
    // Opens the next in-mission upgrade step of towers and barricades (step I is always open).
    'upgradeTier',
    // Potency of the towers' last upgrades.
    'salvoTargets',
    'knockback',
    'slowStrength',
    'stunDuration',
    // Damage dealt to nodes and the Focus (their health is lowered to match).
    'bossDamage',
    // Crew: the Draft and the Guard.
    'mining',
    'startResources',
    'buildSpeed',
    'conversionSpeed',
    'soldierDamage',
    'startMilitary',
    'startMiners',
    // Science: weakening the Swarm.
    'enemyHealth',
    'enemyAttack',
    'enemySpeed',
    'hordeSize',
    // Removes one boss ability (`ability`) from every wave.
    'banAbility',
    // Special: the Synod's favours.
    'buildCost',
    'breakthroughs',
] as const
export type BonusKind = (typeof BONUS_KINDS)[number]

// Multipliers that grow (+x%), multipliers that shrink (−x%), and plain counts.
const GROWING: readonly BonusKind[] = [
    'towerDamage',
    'towerRange',
    'fireRate',
    'barricadeHealth',
    'knockback',
    'stunDuration',
    'bossDamage',
    'mining',
    'buildSpeed',
    'soldierDamage',
    'slowStrength',
]
const SHRINKING: readonly BonusKind[] = [
    'conversionSpeed',
    'enemyHealth',
    'enemyAttack',
    'enemySpeed',
    'hordeSize',
    'buildCost',
]
// A shrinking multiplier never goes below this.
const SHRINK_FLOOR = 0.5

export type EffectShape = 'growing' | 'shrinking' | 'count' | 'ban'

export function effectShape(kind: BonusKind): EffectShape {
    if (kind === 'banAbility') return 'ban'
    if (GROWING.includes(kind)) return 'growing'
    if (SHRINKING.includes(kind)) return 'shrinking'
    return 'count'
}

// Boss abilities the story never removes: only these can be suppressed with requisitions.
export const BANNABLE_ABILITIES: readonly EnemyAbility[] = BOSS_ABILITIES.filter(
    (ability) => !STORY_EXCLUDED_ABILITIES.includes(ability),
)

const levelId = v.pipe(v.string(), v.regex(/^level_\d+$/))

const treeSchema = v.strictObject({
    id: v.picklist(TREE_IDS),
    title: text,
    // Prefix of the paper forms of this tree (СТ-М-…).
    form: text,
    description: text,
    // Multiplies every price in the tree (the Synod's favours cost more).
    costFactor: v.optional(v.pipe(v.number(), v.minValue(1)), 1),
    // Victory that opens the tree (the laboratory for science…).
    opensAfter: v.optional(levelId),
    // Ranks that may use the tree; every rank when omitted.
    ranks: v.optional(v.pipe(v.array(v.picklist(DIFFICULTY_IDS)), v.nonEmpty())),
})
export type TreeDefinition = v.InferOutput<typeof treeSchema>

const upgradeSchema = v.pipe(
    v.strictObject({
        id: v.pipe(v.string(), v.regex(/^[a-z_]+$/)),
        tree: v.picklist(TREE_IDS),
        tier: v.pipe(count, v.minValue(1), v.maxValue(5)),
        // Number of the paper form in the quartermaster's office.
        form: text,
        effect: v.picklist(BONUS_KINDS),
        perLevel: positive,
        maxLevel: v.pipe(count, v.minValue(1)),
        // For `banAbility`: the boss ability suppressed.
        ability: v.optional(v.picklist(BOSS_ABILITIES)),
        // Another upgrade that must be fully bought first.
        requires: v.optional(v.pipe(v.string(), v.regex(/^[a-z_]+$/))),
        name: text,
        description: text,
    }),
    v.check(
        (upgrade) => (upgrade.effect === 'banAbility') === (upgrade.ability !== undefined),
        'A ban names its `ability`, and only a ban does',
    ),
)
export type UpgradeDefinition = v.InferOutput<typeof upgradeSchema>

const tierSchema = v.strictObject({
    tier: v.pipe(count, v.minValue(1), v.maxValue(5)),
    numeral: text,
    // Price of the first step of an upgrade in this tier.
    baseCost: v.pipe(count, v.minValue(1)),
    // Purchases (steps bought in all trees) needed to open the tier.
    opensAt: count,
})

export const requisitionRulesSchema = v.pipe(
    v.strictObject({
        earning: v.strictObject({
            // Every won mission.
            victory: count,
            // Once per sector: the first victory.
            firstVictory: count,
            // Each star the sector has not paid for yet.
            newStar: count,
            // Share of `victory` paid for the 1st, 2nd… replay; the last share holds after.
            replayShares: v.pipe(
                v.array(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
                v.nonEmpty(),
            ),
            // A lost mission pays per wave held.
            defeatPerWave: count,
        }),
        // Each next step of an upgrade costs this much more than the previous one.
        costGrowth: v.pipe(v.number(), v.minValue(1)),
        // Share of spent requisitions returned when upgrades are burned.
        resetRefund: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
        tiers: v.pipe(v.array(tierSchema), v.length(5)),
        trees: v.array(treeSchema),
        upgrades: v.pipe(v.array(upgradeSchema), v.nonEmpty()),
    }),
    v.check(
        (rules) => rules.tiers.every((tier, index) => tier.tier === index + 1),
        'Tiers are listed I to V',
    ),
    v.check(
        (rules) =>
            rules.tiers.every(
                (tier, index) =>
                    index === 0 ||
                    (tier.baseCost > rules.tiers[index - 1]!.baseCost &&
                        tier.opensAt > rules.tiers[index - 1]!.opensAt),
            ) && rules.tiers[0]!.opensAt === 0,
        'Higher tiers cost more and open later; tier I is open from the start',
    ),
    v.check(
        (rules) =>
            rules.trees.length === TREE_IDS.length &&
            TREE_IDS.every((id) => rules.trees.some((tree) => tree.id === id)),
        'Every tree is described once',
    ),
    v.check(
        (rules) =>
            new Set(rules.upgrades.map((upgrade) => upgrade.id)).size === rules.upgrades.length,
        'Upgrade ids must be unique',
    ),
    v.check(
        (rules) =>
            TREE_IDS.every((tree) =>
                [1, 2, 3, 4, 5].every((tier) =>
                    rules.upgrades.some((u) => u.tree === tree && u.tier === tier),
                ),
            ),
        'Every tree has upgrades in all five tiers',
    ),
    v.check(
        (rules) =>
            rules.upgrades.every((upgrade) => {
                const required = rules.upgrades.find((other) => other.id === upgrade.requires)
                return (
                    upgrade.requires === undefined ||
                    (!!required && required.tree === upgrade.tree && required.tier < upgrade.tier)
                )
            }),
        'An upgrade may only require an earlier one of its tree',
    ),
    v.check(
        (rules) =>
            rules.upgrades.every(
                (upgrade) => !upgrade.ability || BANNABLE_ABILITIES.includes(upgrade.ability),
            ),
        'Abilities the story removes cannot be suppressed with requisitions',
    ),
    v.check(
        (rules) =>
            rules.trees.every(
                (tree) =>
                    !tree.opensAfter ||
                    CAMPAIGN.sectors.some((sector) => sector.level === tree.opensAfter),
            ),
        'A tree may only wait for a sector on the map',
    ),
)

export const REQUISITIONS = parseContent(requisitionRulesSchema, data, 'content/requisitions.json')

export type UpgradeLevels = Readonly<Record<string, number>>

export function upgradeDefinition(id: string): UpgradeDefinition | null {
    return REQUISITIONS.upgrades.find((upgrade) => upgrade.id === id) ?? null
}

export function treeDefinition(id: TreeId): TreeDefinition {
    return REQUISITIONS.trees.find((tree) => tree.id === id)!
}

// Price of raising `upgrade` from `level` to `level + 1`, rounded to 5.
export function upgradeCost(upgrade: UpgradeDefinition, level: number): number {
    const tier = REQUISITIONS.tiers[upgrade.tier - 1]!
    const factor = treeDefinition(upgrade.tree).costFactor
    return Math.max(
        5,
        Math.round((tier.baseCost * factor * REQUISITIONS.costGrowth ** level) / 5) * 5,
    )
}

// Steps bought in all trees: what opens the next tiers.
export function purchaseCount(levels: UpgradeLevels): number {
    return REQUISITIONS.upgrades.reduce(
        (sum, upgrade) => sum + Math.max(0, Math.min(upgrade.maxLevel, levels[upgrade.id] ?? 0)),
        0,
    )
}

export function tierOpen(tier: number, levels: UpgradeLevels): boolean {
    return purchaseCount(levels) >= REQUISITIONS.tiers[tier - 1]!.opensAt
}

// What a tree needs from the campaign and the officer's rank.
export interface TreeAccess {
    completedLevels: readonly string[]
    difficulty: DifficultyId
}

// Null when the tree is open; otherwise the reason, for the terminal.
export function treeLock(tree: TreeDefinition, access: TreeAccess): string | null {
    if (tree.ranks && !tree.ranks.includes(access.difficulty)) return 'rank'
    if (tree.opensAfter && !access.completedLevels.includes(tree.opensAfter)) return 'story'
    return null
}

// Session modifiers bought with requisitions. Multipliers are 1 and counts 0 without upgrades.
export interface MetaBonuses {
    towerDamage: number
    towerRange: number
    // Multiplies the towers' rate of fire (above 1 is faster).
    fireRate: number
    barricadeHealth: number
    // In-mission upgrade steps opened beyond the first.
    upgradeTier: number
    // Extra targets of the cannon's salvo.
    salvoTargets: number
    knockback: number
    // Grows the machine gun's slow: the slowed speed is 0.5 / slowStrength.
    slowStrength: number
    stunDuration: number
    bossDamage: number
    mining: number
    startResources: number
    buildSpeed: number
    // Multiplies retraining time (below 1 is faster).
    conversionSpeed: number
    soldierDamage: number
    startMilitary: number
    startMiners: number
    enemyHealth: number
    enemyAttack: number
    enemySpeed: number
    hordeSize: number
    bannedAbilities: EnemyAbility[]
    buildCost: number
    breakthroughs: number
}

export const NO_BONUSES: MetaBonuses = {
    towerDamage: 1,
    towerRange: 1,
    fireRate: 1,
    barricadeHealth: 1,
    upgradeTier: 0,
    salvoTargets: 0,
    knockback: 1,
    slowStrength: 1,
    stunDuration: 1,
    bossDamage: 1,
    mining: 1,
    startResources: 0,
    buildSpeed: 1,
    conversionSpeed: 1,
    soldierDamage: 1,
    startMilitary: 0,
    startMiners: 0,
    enemyHealth: 1,
    enemyAttack: 1,
    enemySpeed: 1,
    hordeSize: 1,
    bannedAbilities: [],
    buildCost: 1,
    breakthroughs: 0,
}

// Total value of an effect at `level` (a fraction for multipliers, a count otherwise).
export function effectValue(upgrade: UpgradeDefinition, level: number): number {
    return upgrade.perLevel * level
}

// Bonuses of the bought levels. Upgrades of trees closed to this profile (`open` says which)
// do not apply.
export function bonusesFor(
    levels: UpgradeLevels,
    open: (tree: TreeId) => boolean = () => true,
): MetaBonuses {
    const bonuses: MetaBonuses = { ...NO_BONUSES, bannedAbilities: [] }
    for (const upgrade of REQUISITIONS.upgrades) {
        if (!open(upgrade.tree)) continue
        const level = Math.max(0, Math.min(upgrade.maxLevel, levels[upgrade.id] ?? 0))
        if (!level) continue
        const value = effectValue(upgrade, level)
        const kind = upgrade.effect
        if (kind === 'banAbility') bonuses.bannedAbilities.push(upgrade.ability!)
        else if (effectShape(kind) === 'growing') bonuses[kind] *= 1 + value
        else if (effectShape(kind) === 'shrinking')
            bonuses[kind] = Math.max(SHRINK_FLOOR, bonuses[kind] * (1 - value))
        else bonuses[kind] += value
    }
    return bonuses
}

// A sector's record in the requisition ledger: what has been paid for already.
export interface MissionRecord {
    won: boolean
    // Stars already paid for.
    stars: number
    replays: number
}

export const NO_RECORD: MissionRecord = { won: false, stars: 0, replays: 0 }

// Requisitions for a finished mission, before the rank's multiplier, and the updated record.
// A first victory pays in full; replays pay a diminishing share; new stars always pay.
export function missionReward(
    record: MissionRecord,
    result: { outcome: 'victory' | 'defeat'; stars: number; wavesHeld: number },
): { amount: number; record: MissionRecord } {
    const { earning } = REQUISITIONS
    if (result.outcome === 'defeat')
        return { amount: earning.defeatPerWave * Math.max(0, result.wavesHeld), record }
    const stars = Math.max(0, Math.min(3, Math.floor(result.stars)))
    const newStars = Math.max(0, stars - record.stars)
    const shares = earning.replayShares
    const base = record.won
        ? earning.victory * shares[Math.min(record.replays, shares.length - 1)]!
        : earning.victory + earning.firstVictory
    return {
        amount: Math.round(base + newStars * earning.newStar),
        record: {
            won: true,
            stars: Math.max(record.stars, stars),
            replays: record.won ? record.replays + 1 : 0,
        },
    }
}
