import {
    DEFAULT_DIFFICULTY,
    DIFFICULTIES,
    NO_RECORD,
    REQUISITIONS,
    TREE_IDS,
    bonusesFor,
    campaignSector,
    effectShape,
    effectValue,
    missionReward,
    purchaseCount,
    tierOpen,
    treeDefinition,
    treeLock,
    upgradeCost,
    upgradeDefinition,
    type CampaignProgress,
    type DifficultyId,
    type MetaBonuses,
    type MissionRecord,
    type TreeId,
    type UpgradeDefinition,
} from '@/domain'
import type { KeyValueStore } from './ports/KeyValueStore'
import type { CommandResult } from './session/GameSession'

const KEY = 'requisitions'
const VERSION = 2

// A profile's requisition account: the balance, the upgrades bought with it and what each
// sector has paid so far.
export interface RequisitionLedger {
    version: number
    balance: number
    // Everything ever earned and spent; `spent` is what a reset refunds from.
    earned: number
    spent: number
    levels: Record<string, number>
    missions: Record<string, MissionRecord>
}

export interface UpgradeView {
    id: string
    form: string
    tier: number
    name: string
    description: string
    level: number
    maxLevel: number
    // Effect now and after the next purchase, e.g. "+12%", "+2 бойца".
    current: string
    next: string | null
    cost: number | null
    // Why it cannot be bought now (closed tree or tier, a missing requirement), or null.
    blocked: string | null
    affordable: boolean
}

export interface RequisitionTierView {
    tier: number
    numeral: string
    open: boolean
    // Purchases that open it.
    opensAt: number
    upgrades: UpgradeView[]
}

export interface RequisitionTreeView {
    id: TreeId
    title: string
    form: string
    description: string
    // Why the whole tree is closed, or null.
    locked: string | null
    tiers: RequisitionTierView[]
}

export interface RequisitionView {
    balance: number
    earned: number
    spent: number
    // Steps bought in all trees: they open the tiers.
    purchases: number
    // What a reset would return now.
    refund: number
    refundPercent: number
    trees: RequisitionTreeView[]
}

const UNITS: Partial<Record<UpgradeDefinition['effect'], [string, string, string]>> = {
    startResources: ['ресурс', 'ресурса', 'ресурсов'],
    startMilitary: ['боец', 'бойца', 'бойцов'],
    startMiners: ['шахтёр', 'шахтёра', 'шахтёров'],
    breakthroughs: ['прорыв', 'прорыва', 'прорывов'],
    salvoTargets: ['цель', 'цели', 'целей'],
}

const STEPS = ['', 'I', 'II', 'III']

function plural(count: number, forms: [string, string, string]): string {
    const last = count % 10
    const teen = count % 100 >= 11 && count % 100 <= 14
    return teen ? forms[2] : last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2]
}

function formatEffect(upgrade: UpgradeDefinition, level: number): string {
    const value = effectValue(upgrade, level)
    switch (effectShape(upgrade.effect)) {
        case 'ban':
            return 'урок подавлен'
        case 'growing':
            return `+${Math.round(value * 100)}%`
        case 'shrinking':
            return upgrade.effect === 'conversionSpeed'
                ? `−${Math.round(value * 100)}% времени`
                : `−${Math.round(value * 100)}%`
        case 'count': {
            if (upgrade.effect === 'upgradeTier') return `ступень ${STEPS[1 + value] ?? value}`
            const units = UNITS[upgrade.effect]
            return units ? `+${value} ${plural(value, units)}` : `+${value}`
        }
    }
}

export interface RequisitionAccess {
    // The officer's rank: special favours are for majors and generals only.
    difficulty: () => DifficultyId
}

// Meta-progression of a profile: requisitions earned in missions buy permanent upgrades.
export class RequisitionService {
    private ledger: RequisitionLedger
    // Requisitions returned when an older ledger was converted to the four trees.
    readonly migrationRefund: number

    constructor(
        private readonly storage: KeyValueStore,
        private readonly access: RequisitionAccess = { difficulty: () => DEFAULT_DIFFICULTY },
    ) {
        const saved = storage.read<Partial<RequisitionLedger>>(KEY)
        const before = saved?.spent ?? 0
        this.ledger = saved ? this.upgrade(saved) : this.openAccount()
        this.migrationRefund = saved && saved.version !== VERSION ? before : 0
    }

    get balance(): number {
        return this.ledger.balance
    }

    get bonuses(): MetaBonuses {
        return bonusesFor(this.ledger.levels, (tree) => this.lock(tree) === null)
    }

    view(): RequisitionView {
        return {
            balance: this.ledger.balance,
            earned: this.ledger.earned,
            spent: this.ledger.spent,
            purchases: purchaseCount(this.ledger.levels),
            refund: this.refund(),
            refundPercent: Math.round(REQUISITIONS.resetRefund * 100),
            trees: TREE_IDS.map((id) => {
                const tree = treeDefinition(id)
                return {
                    id,
                    title: tree.title,
                    form: tree.form,
                    description: tree.description,
                    locked: this.lockText(id),
                    tiers: REQUISITIONS.tiers.map((tier) => ({
                        tier: tier.tier,
                        numeral: tier.numeral,
                        open: tierOpen(tier.tier, this.ledger.levels),
                        opensAt: tier.opensAt,
                        upgrades: REQUISITIONS.upgrades
                            .filter((upgrade) => upgrade.tree === id && upgrade.tier === tier.tier)
                            .map((upgrade) => this.upgradeView(upgrade)),
                    })),
                }
            }),
        }
    }

    buy(id: string): CommandResult {
        const upgrade = upgradeDefinition(id)
        if (!upgrade) return { ok: false, error: 'Нет такого наряда' }
        const level = this.ledger.levels[id] ?? 0
        if (level >= upgrade.maxLevel) return { ok: false, error: 'Наряд исполнен полностью' }
        const blocked = this.blocked(upgrade)
        if (blocked) return { ok: false, error: blocked }
        const cost = upgradeCost(upgrade, level)
        if (cost > this.ledger.balance) return { ok: false, error: 'Недостаточно реквизиций' }
        this.ledger.balance -= cost
        this.ledger.spent += cost
        this.ledger.levels[id] = level + 1
        this.save()
        return { ok: true }
    }

    // Burns every upgrade; returns the refunded amount.
    reset(): number {
        const refund = this.refund()
        this.ledger.balance += refund
        this.ledger.spent = 0
        this.ledger.levels = {}
        this.save()
        return refund
    }

    // Pays for a finished mission and returns the amount. New stars always pay; replays of
    // a held sector pay a diminishing share (domain/meta/requisitions.ts).
    award(
        levelId: string,
        result: { outcome: 'victory' | 'defeat'; stars: number; wavesHeld: number },
        multiplier = 1,
    ): number {
        const { amount, record } = missionReward(this.ledger.missions[levelId] ?? NO_RECORD, result)
        this.ledger.missions[levelId] = record
        return this.credit(Math.round(amount * multiplier))
    }

    private lock(tree: TreeId): string | null {
        const campaign = this.storage.read<CampaignProgress>('campaign')
        return treeLock(treeDefinition(tree), {
            completedLevels: campaign?.completedLevels ?? [],
            difficulty: this.access.difficulty(),
        })
    }

    private lockText(tree: TreeId): string | null {
        const reason = this.lock(tree)
        if (reason === 'rank') return 'ДОПУСК ТОЛЬКО ДЛЯ МАЙОРОВ И ГЕНЕРАЛОВ'
        if (reason === 'story') {
            const sector = campaignSector(treeDefinition(tree).opensAfter!)
            return `ОТКРОЕТСЯ ПОСЛЕ ПОБЕДЫ В СЕКТОРЕ ${sector?.code ?? ''}`.trim()
        }
        return null
    }

    // Why an upgrade cannot be bought now (ignoring the price), or null.
    private blocked(upgrade: UpgradeDefinition): string | null {
        const tree = this.lockText(upgrade.tree)
        if (tree) return tree
        const tier = REQUISITIONS.tiers[upgrade.tier - 1]!
        if (!tierOpen(upgrade.tier, this.ledger.levels))
            return `Разряд ${tier.numeral} откроется после ${tier.opensAt} нарядов`
        const required = upgrade.requires ? upgradeDefinition(upgrade.requires) : null
        if (required && (this.ledger.levels[required.id] ?? 0) < required.maxLevel)
            return `Сначала нужен наряд «${required.name}»`
        const banned = DIFFICULTIES[this.access.difficulty()].bosses.banned
        if (upgrade.ability && banned.includes(upgrade.ability))
            return 'На вашем звании Средоточия этого не умеют'
        return null
    }

    private refund(): number {
        return Math.floor(this.ledger.spent * REQUISITIONS.resetRefund)
    }

    private credit(amount: number): number {
        this.ledger.balance += amount
        this.ledger.earned += amount
        this.save()
        return amount
    }

    // What the campaign says each held sector has paid (stars and the first victory).
    private campaignRecords(): Record<string, MissionRecord> {
        const campaign = this.storage.read<CampaignProgress>('campaign')
        return Object.fromEntries(
            (campaign?.levels ?? [])
                .filter((level) => level.completed)
                .map((level) => [level.id, { won: true, stars: level.stars, replays: 0 }]),
        )
    }

    // Profiles that played before requisitions existed are paid for the sectors they hold.
    private openAccount(): RequisitionLedger {
        this.ledger = {
            version: VERSION,
            balance: 0,
            earned: 0,
            spent: 0,
            levels: {},
            missions: {},
        }
        const campaign = this.storage.read<CampaignProgress>('campaign')
        const multiplier = DIFFICULTIES[this.access.difficulty()].requisitions
        let backPay = 0
        for (const level of campaign?.levels ?? []) {
            if (!level.completed) continue
            const result = { outcome: 'victory' as const, stars: level.stars, wavesHeld: 0 }
            const paid = missionReward(NO_RECORD, result)
            this.ledger.missions[level.id] = paid.record
            backPay += Math.round(paid.amount * multiplier)
        }
        if (backPay) this.credit(backPay)
        return this.ledger
    }

    // Ledgers from before the four trees: every requisition spent comes back in full, and the
    // held sectors keep what they have paid.
    private upgrade(saved: Partial<RequisitionLedger>): RequisitionLedger {
        if (saved.version === VERSION) return saved as RequisitionLedger
        const ledger: RequisitionLedger = {
            version: VERSION,
            balance: (saved.balance ?? 0) + (saved.spent ?? 0),
            earned: saved.earned ?? 0,
            spent: 0,
            levels: {},
            missions: this.campaignRecords(),
        }
        this.storage.write(KEY, ledger)
        return ledger
    }

    private upgradeView(upgrade: UpgradeDefinition): UpgradeView {
        const level = Math.min(upgrade.maxLevel, this.ledger.levels[upgrade.id] ?? 0)
        const cost = level < upgrade.maxLevel ? upgradeCost(upgrade, level) : null
        const blocked = cost === null ? null : this.blocked(upgrade)
        return {
            id: upgrade.id,
            form: upgrade.form,
            tier: upgrade.tier,
            name: upgrade.name,
            description: upgrade.description,
            level,
            maxLevel: upgrade.maxLevel,
            current: level ? formatEffect(upgrade, level) : '—',
            next: cost === null ? null : formatEffect(upgrade, level + 1),
            cost,
            blocked,
            affordable: cost !== null && !blocked && cost <= this.ledger.balance,
        }
    }

    private save(): void {
        this.storage.write(KEY, this.ledger)
    }
}
