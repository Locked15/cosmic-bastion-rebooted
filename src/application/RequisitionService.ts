import {
    REQUISITIONS,
    bonusesFor,
    effectValue,
    isPercentEffect,
    requisitionReward,
    upgradeCost,
    upgradeDefinition,
    type CampaignProgress,
    type MetaBonuses,
    type UpgradeDefinition,
} from '@/domain'
import type { KeyValueStore } from './ports/KeyValueStore'
import type { CommandResult } from './session/GameSession'

const KEY = 'requisitions'

// A profile's requisition account: the balance and the upgrades bought with it.
export interface RequisitionLedger {
    balance: number
    // Everything ever earned and spent; `spent` is what a reset refunds from.
    earned: number
    spent: number
    levels: Record<string, number>
}

export interface UpgradeView {
    id: string
    form: string
    rank: number
    name: string
    description: string
    level: number
    maxLevel: number
    // Effect now and after the next purchase, e.g. "+12%", "+2 бойца".
    current: string
    next: string | null
    cost: number | null
    affordable: boolean
}

export interface RequisitionTierView {
    rank: number
    title: string
    upgrades: UpgradeView[]
}

export interface RequisitionView {
    balance: number
    earned: number
    spent: number
    // What a reset would return now.
    refund: number
    refundPercent: number
    tiers: RequisitionTierView[]
}

const UNITS: Partial<Record<UpgradeDefinition['effect'], [string, string, string]>> = {
    startResources: ['ресурс', 'ресурса', 'ресурсов'],
    startMilitary: ['боец', 'бойца', 'бойцов'],
    breakthroughs: ['прорыв', 'прорыва', 'прорывов'],
}

function plural(count: number, forms: [string, string, string]): string {
    const last = count % 10
    const teen = count % 100 >= 11 && count % 100 <= 14
    return teen ? forms[2] : last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2]
}

function formatEffect(upgrade: UpgradeDefinition, level: number): string {
    const value = effectValue(upgrade, level)
    if (upgrade.effect === 'conversionSpeed') return `−${Math.round(value * 100)}% времени`
    if (isPercentEffect(upgrade.effect)) return `+${Math.round(value * 100)}%`
    const units = UNITS[upgrade.effect]
    return units ? `+${value} ${plural(value, units)}` : `+${value}`
}

// Meta-progression of a profile: requisitions earned in missions buy permanent upgrades.
export class RequisitionService {
    private ledger: RequisitionLedger

    constructor(private readonly storage: KeyValueStore) {
        this.ledger = storage.read<RequisitionLedger>(KEY) ?? this.openAccount()
    }

    get balance(): number {
        return this.ledger.balance
    }

    get bonuses(): MetaBonuses {
        return bonusesFor(this.ledger.levels)
    }

    view(): RequisitionView {
        return {
            balance: this.ledger.balance,
            earned: this.ledger.earned,
            spent: this.ledger.spent,
            refund: this.refund(),
            refundPercent: Math.round(REQUISITIONS.resetRefund * 100),
            tiers: REQUISITIONS.tiers.map((tier) => ({
                rank: tier.rank,
                title: tier.title,
                upgrades: REQUISITIONS.upgrades
                    .filter((upgrade) => upgrade.rank === tier.rank)
                    .map((upgrade) => this.upgradeView(upgrade)),
            })),
        }
    }

    buy(id: string): CommandResult {
        const upgrade = upgradeDefinition(id)
        if (!upgrade) return { ok: false, error: 'Нет такого наряда' }
        const level = this.ledger.levels[id] ?? 0
        if (level >= upgrade.maxLevel) return { ok: false, error: 'Наряд исполнен полностью' }
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

    // Pays for a finished mission and returns the amount.
    award(
        outcome: 'victory' | 'defeat',
        stars: number,
        firstVictory: boolean,
        multiplier = 1,
    ): number {
        return this.credit(requisitionReward(outcome, stars, firstVictory, multiplier))
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

    // Profiles that played before requisitions existed are paid for the sectors they hold.
    private openAccount(): RequisitionLedger {
        this.ledger = { balance: 0, earned: 0, spent: 0, levels: {} }
        const campaign = this.storage.read<CampaignProgress>('campaign')
        let backPay = 0
        for (const level of campaign?.levels ?? []) {
            if (level.completed) backPay += requisitionReward('victory', level.stars, true)
        }
        if (backPay) this.credit(backPay)
        return this.ledger
    }

    private upgradeView(upgrade: UpgradeDefinition): UpgradeView {
        const level = Math.min(upgrade.maxLevel, this.ledger.levels[upgrade.id] ?? 0)
        const cost = level < upgrade.maxLevel ? upgradeCost(upgrade, level) : null
        return {
            id: upgrade.id,
            form: upgrade.form,
            rank: upgrade.rank,
            name: upgrade.name,
            description: upgrade.description,
            level,
            maxLevel: upgrade.maxLevel,
            current: level ? formatEffect(upgrade, level) : '—',
            next: cost === null ? null : formatEffect(upgrade, level + 1),
            cost,
            affordable: cost !== null && cost <= this.ledger.balance,
        }
    }

    private save(): void {
        this.storage.write(KEY, this.ledger)
    }
}
