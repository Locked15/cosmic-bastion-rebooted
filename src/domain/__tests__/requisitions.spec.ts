import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import {
    BANNABLE_ABILITIES,
    DIFFICULTIES,
    NO_BONUSES,
    NO_RECORD,
    REQUISITIONS,
    STORY_EXCLUDED_ABILITIES,
    TREE_IDS,
    bonusesFor,
    missionReward,
    priceIndex,
    purchaseCount,
    tierGate,
    stageOpen,
    tierOpen,
    treeDefinition,
    treeLock,
    upgradeCost,
    upgradeDefinition,
    requisitionRulesSchema,
    type DifficultyId,
    type MissionRecord,
    type TreeId,
} from '@/domain'
import data from '@/content/requisitions.json'

const MISSIONS = 16
const COMMON_TREES: TreeId[] = ['machinery', 'crew', 'science']

// One full pass over every sector: what the ledger pays, with the records it leaves.
function pass(records: MissionRecord[], stars: number, multiplier: number) {
    let earned = 0
    records.forEach((record, index) => {
        const paid = missionReward(record, { outcome: 'victory', stars, wavesHeld: 0 })
        records[index] = paid.record
        earned += Math.round(paid.amount * multiplier)
    })
    return earned
}

// A player who always buys the cheapest open form: steps bought after the campaign
// (2★ on average) and after each replay pass (3★).
function simulate(trees: TreeId[], multiplier: number, passes = 15) {
    const levels: Record<string, number> = {}
    const records = Array.from({ length: MISSIONS }, () => NO_RECORD)
    const total = REQUISITIONS.upgrades
        .filter((u) => trees.includes(u.tree))
        .reduce((sum, u) => sum + u.maxLevel, 0)
    let balance = pass(records, 2, multiplier)
    const spend = () => {
        for (;;) {
            const bought = purchaseCount(levels)
            const open = REQUISITIONS.upgrades.filter((u) => {
                const required = u.requires ? upgradeDefinition(u.requires)! : null
                return (
                    trees.includes(u.tree) &&
                    (levels[u.id] ?? 0) < u.maxLevel &&
                    stageOpen(u, levels) &&
                    (!required || (levels[required.id] ?? 0) >= required.maxLevel)
                )
            })
            const price = (u: (typeof open)[number]) => upgradeCost(u, levels[u.id] ?? 0, bought)
            const cheapest = open.sort((a, b) => price(a) - price(b))[0]
            if (!cheapest || price(cheapest) > balance) return
            balance -= price(cheapest)
            levels[cheapest.id] = (levels[cheapest.id] ?? 0) + 1
        }
    }
    spend()
    const steps = [purchaseCount(levels)]
    for (let i = 0; i < passes; i++) {
        balance += pass(records, 3, multiplier)
        spend()
        steps.push(purchaseCount(levels))
    }
    return { total, steps, full: steps.findIndex((count) => count >= total) }
}

describe('requisition trees', () => {
    it('has four trees with five tiers that cost more and open later in each tree', () => {
        expect(REQUISITIONS.trees.map((tree) => tree.id)).toEqual([...TREE_IDS])
        const tiers = REQUISITIONS.tiers
        expect(tiers.map((tier) => tier.numeral)).toEqual(['I', 'II', 'III', 'IV', 'V'])
        tiers.slice(1).forEach((tier, index) => {
            expect(tier.baseCost).toBeGreaterThan(tiers[index]!.baseCost)
        })
        for (const tree of TREE_IDS) {
            const gates = [1, 2, 3, 4, 5].map((tier) => tierGate(tree, tier))
            expect(gates[0]).toBe(0)
            gates.slice(1).forEach((gate, index) => expect(gate).toBeGreaterThan(gates[index]!))
        }
    })

    it('makes every next step a little more expensive and the favours pricier', () => {
        for (const upgrade of REQUISITIONS.upgrades) {
            const costs = Array.from({ length: upgrade.maxLevel }, (_, level) =>
                upgradeCost(upgrade, level),
            )
            costs.slice(1).forEach((cost, index) => {
                expect(cost).toBeGreaterThan(costs[index]!)
                expect(cost / costs[index]!).toBeLessThan(1.34)
            })
            expect(costs[costs.length - 1]!).toBeGreaterThanOrEqual(costs[0]!)
        }
        const first = (tree: TreeId, tier: number) =>
            upgradeCost(
                REQUISITIONS.upgrades.find((u) => u.tree === tree && u.tier === tier)!,
                0,
            )
        for (const tier of [1, 2, 3, 4, 5])
            expect(first('special', tier)).toBeGreaterThan(first('machinery', tier))
    })

    it('opens tiers per tree but raises every price with each purchase anywhere', () => {
        expect(tierOpen('machinery', 1, {})).toBe(true)
        expect(tierOpen('machinery', 2, {})).toBe(false)
        const crewOnly = { mining: 5, start_resources: 5 }
        // A full crew tree does not open machinery tiers…
        expect(tierOpen('crew', 3, crewOnly)).toBe(true)
        expect(tierOpen('machinery', 2, crewOnly)).toBe(false)
        expect(purchaseCount(crewOnly, 'machinery')).toBe(0)
        // …but it makes machinery more expensive.
        const damage = upgradeDefinition('tower_damage')!
        expect(upgradeCost(damage, 0, purchaseCount(crewOnly))).toBeGreaterThan(
            upgradeCost(damage, 0, 0),
        )
        expect(priceIndex(10)).toBeCloseTo(1 + 10 * REQUISITIONS.priceRise)
        // Levels above the maximum count as the maximum.
        expect(purchaseCount({ upgrade_step_two: 9 })).toBe(1)
    })

    it('opens science after C-9 and the favours only for majors and generals after D-1', () => {
        const access = (completedLevels: string[], difficulty: DifficultyId = 'modest') => ({
            completedLevels,
            difficulty,
        })
        expect(treeLock(treeDefinition('machinery'), access([]))).toBeNull()
        expect(treeLock(treeDefinition('science'), access([]))).toBe('story')
        expect(treeLock(treeDefinition('science'), access(['level_3']))).toBeNull()
        expect(treeLock(treeDefinition('special'), access(['level_4']))).toBe('rank')
        for (const rank of ['complex', 'xhard'] as const) {
            expect(treeLock(treeDefinition('special'), access([], rank))).toBe('story')
            expect(treeLock(treeDefinition('special'), access(['level_4'], rank))).toBeNull()
        }
    })

    it('never suppresses an ability the story already removes', () => {
        const bans = REQUISITIONS.upgrades.flatMap((u) => (u.ability ? [u.ability] : []))
        expect(bans.length).toBeGreaterThan(0)
        for (const ability of bans) {
            expect(BANNABLE_ABILITIES).toContain(ability)
            expect(STORY_EXCLUDED_ABILITIES).not.toContain(ability)
        }
        const content = structuredClone(data)
        content.upgrades.find((u) => u.id === 'ban_ambush')!.ability = 'sabotage'
        expect(v.safeParse(requisitionRulesSchema, content).success).toBe(false)
    })

    it('turns bought steps into session bonuses that stack gently', () => {
        expect(bonusesFor({})).toEqual(NO_BONUSES)
        const bonuses = bonusesFor({
            tower_damage: 5,
            enemy_health: 5,
            horde_size: 4,
            upgrade_step_two: 1,
            upgrade_step_three: 1,
            start_military: 2,
            levy_military: 2,
            ban_ambush: 1,
            build_cost: 3,
            unknown: 5,
        })
        expect(bonuses.towerDamage).toBeCloseTo(1.25)
        expect(bonuses.enemyHealth).toBeCloseTo(0.85)
        expect(bonuses.hordeSize).toBeCloseTo(0.84)
        expect(bonuses.upgradeTier).toBe(2)
        // Crew and favours both add soldiers, but each only a little.
        expect(bonuses.startMilitary).toBe(4)
        expect(bonuses.bannedAbilities).toEqual(['ambush'])
        expect(bonuses.buildCost).toBeCloseTo(0.88)
        // Closed trees do not apply.
        const closed = bonusesFor({ build_cost: 3, tower_damage: 1 }, (tree) => tree !== 'special')
        expect(closed.buildCost).toBe(1)
        expect(closed.towerDamage).toBeCloseTo(1.05)
        expect(upgradeDefinition('salvo')!.requires).toBe('upgrade_step_three')
    })

    it('keeps every science weakening and favour within a gentle maximum', () => {
        const all = Object.fromEntries(REQUISITIONS.upgrades.map((u) => [u.id, u.maxLevel]))
        const bonuses = bonusesFor(all)
        expect(bonuses.enemyHealth).toBeGreaterThanOrEqual(0.8)
        expect(bonuses.enemyAttack).toBeGreaterThanOrEqual(0.8)
        expect(bonuses.enemySpeed).toBeGreaterThanOrEqual(0.85)
        expect(bonuses.hordeSize).toBeGreaterThanOrEqual(0.8)
        expect(bonuses.buildCost).toBeGreaterThanOrEqual(0.85)
        expect(bonuses.breakthroughs).toBeLessThanOrEqual(2)
        expect(bonuses.upgradeTier).toBe(2)
        // A general still holds the line with few breakthroughs.
        expect(DIFFICULTIES.xhard.maxBreakthroughs + bonuses.breakthroughs).toBeLessThanOrEqual(5)
    })

    it('rejects malformed trees', () => {
        const parse = (change: (content: typeof data) => void) => {
            const content = structuredClone(data)
            change(content)
            return v.safeParse(requisitionRulesSchema, content).success
        }
        expect(parse(() => {})).toBe(true)
        // A requirement must be an earlier form of the same tree.
        expect(
            parse((c) => (c.upgrades.find((u) => u.id === 'salvo')!.requires = 'holy_iron')),
        ).toBe(false)
        // Every tree keeps all five tiers.
        expect(parse((c) => (c.upgrades = c.upgrades.filter((u) => u.id !== 'holy_iron')))).toBe(
            false,
        )
        // A ban names its ability.
        expect(
            parse(
                (c) =>
                    delete (c.upgrades.find((u) => u.id === 'ban_dodge') as { ability?: string })
                        .ability,
            ),
        ).toBe(false)
        expect(parse((c) => (c.trees[0]!.gates[1] = 0))).toBe(false)
        // A gate beyond the steps below it could never open.
        expect(parse((c) => (c.trees[0]!.gates[4] = 999))).toBe(false)
        // A tree that can be closed explains why.
        expect(parse((c) => delete (c.trees[2] as { sealed?: string }).sealed)).toBe(false)
    })
})

describe('requisition economy', () => {
    it('pays a first victory in full, new stars once, and replays a diminishing share', () => {
        const { earning } = REQUISITIONS
        const first = missionReward(NO_RECORD, { outcome: 'victory', stars: 2, wavesHeld: 5 })
        expect(first.amount).toBe(earning.victory + earning.firstVictory + 2 * earning.newStar)
        const replay = missionReward(first.record, { outcome: 'victory', stars: 3, wavesHeld: 5 })
        expect(replay.amount).toBe(
            Math.round(earning.victory * earning.replayShares[0]! + earning.newStar),
        )
        let record = replay.record
        const amounts: number[] = []
        for (let i = 0; i < 5; i++) {
            const next = missionReward(record, { outcome: 'victory', stars: 3, wavesHeld: 5 })
            amounts.push(next.amount)
            record = next.record
        }
        // Diminishing, then steady: replaying never stops paying.
        expect(amounts[0]).toBeGreaterThan(amounts[amounts.length - 1]!)
        expect(amounts[amounts.length - 1]).toBe(
            Math.round(earning.victory * earning.replayShares[earning.replayShares.length - 1]!),
        )
        const lost = missionReward(record, { outcome: 'defeat', stars: 0, wavesHeld: 3 })
        expect(lost).toEqual({ amount: 3 * earning.defeatPerWave, record })
    })

    it('lets a lieutenant buy more than half of the common steps with one campaign', () => {
        const { total, steps } = simulate(COMMON_TREES, DIFFICULTIES.modest.requisitions)
        expect(steps[0]! / total).toBeGreaterThan(0.5)
        expect(steps[0]! / total).toBeLessThan(0.7)
        // A few replay passes buy most of the rest…
        expect(steps[3]! / total).toBeGreaterThan(0.75)
    })

    it('keeps the last, inflated forms a long-term goal without endless grinding', () => {
        for (const [rank, trees] of [
            ['simple', COMMON_TREES],
            ['modest', COMMON_TREES],
            ['complex', TREE_IDS],
            ['xhard', TREE_IDS],
        ] as const) {
            const { full } = simulate([...trees], DIFFICULTIES[rank].requisitions)
            expect(full).toBeGreaterThanOrEqual(5)
            expect(full).toBeLessThanOrEqual(13)
        }
    })
})
