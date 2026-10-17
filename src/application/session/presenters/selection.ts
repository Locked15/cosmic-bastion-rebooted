import {
    BARRICADE_CATALOG,
    BARRICADE_MAX_LEVEL,
    TOWER_CATALOG,
    TOWER_MAX_LEVEL,
    barricadeRepairCost,
    type Barricade,
    type TowerSlot,
} from '@/domain'
import type { SelectionView } from '../../dto/views'
import { barricadeRefund, type GameSession } from '../GameSession'
import { percent, row } from './format'

export function presentSelection(session: GameSession): SelectionView | null {
    const id = session.selectedId ?? session.pointer.hoverId
    if (!id) return null
    const slot = session.slots.find((candidate) => candidate.id === id)
    const view = slot ? presentSlot(slot, session.resources, session.refundRate) : null
    if (slot) return view && limitByTier(view, slot.tower?.level ?? 0, session.upgradeTier)
    const barricade = session.barricades.find((candidate) => candidate.id === id)
    return barricade
        ? limitByTier(
              presentBarricade(barricade, session.resources, session.refundRate),
              barricade.level,
              session.upgradeTier,
          )
        : null
}

// Upgrades above the campaign tech tier are shown but locked.
function limitByTier(view: SelectionView, level: number, tier: number): SelectionView {
    if (level < tier || !view.nextAbility) return view
    return {
        ...view,
        canUpgrade: false,
        nextAbility: {
            ...view.nextAbility,
            description: 'Технология откроется после сюжетной миссии.',
        },
    }
}

function presentSlot(slot: TowerSlot, resources: number, refundRate: number): SelectionView | null {
    const tower = slot.tower
    const construction = slot.construction
    const type = tower?.type ?? construction?.type
    if (!type) return null
    const entry = TOWER_CATALOG[type]
    const level = tower?.level ?? 0
    const upgradeCost =
        tower && !tower.upgrading && level < TOWER_MAX_LEVEL
            ? (entry.upgradeCosts[level] ?? null)
            : null
    const progress = []
    if (construction) {
        progress.push({
            label: 'Строительство',
            percent: percent(construction.progress, construction.time),
        })
    }
    if (tower?.upgrading) {
        progress.push({
            label: 'Улучшение',
            percent: percent(tower.upgradeProgress, tower.upgradeTime),
        })
    }
    const next = level < TOWER_MAX_LEVEL ? entry.benefits[(level + 1) as 1 | 2 | 3] : null
    return {
        kind: 'tower',
        id: slot.id,
        title: `${entry.name} (Ур. ${level + 1})`,
        status: tower ? (tower.upgrading ? 'Улучшение' : 'Активна') : 'Строительство',
        disabled: tower?.disabled ?? false,
        stats: tower
            ? [
                  row('Урон', Math.floor(tower.damage)),
                  row(
                      'Дальность',
                      Number.isFinite(tower.range) ? Math.floor(tower.range) : 'Вся карта',
                  ),
                  row('Скорострельность', `${(60 / tower.fireRate).toFixed(1)}/с`),
              ]
            : [],
        progress,
        abilities: tower?.abilities ?? [],
        nextAbility: next,
        upgradeCost,
        canUpgrade: upgradeCost !== null && resources >= upgradeCost,
        repairCost: null,
        canRepair: false,
        refund: Math.floor(entry.cost * refundRate),
        canDemolish: true,
    }
}

function presentBarricade(
    barricade: Barricade,
    resources: number,
    refundRate: number,
): SelectionView {
    const entry = BARRICADE_CATALOG[barricade.type]
    const level = barricade.level
    const upgradeCost =
        barricade.active && !barricade.upgrading && level < BARRICADE_MAX_LEVEL
            ? (entry.upgradeCosts[level] ?? null)
            : null
    const repairing = barricade.destroyed && barricade.building
    const repairCost =
        barricade.destroyed && !barricade.building ? barricadeRepairCost(barricade.type) : null
    const progress = barricade.building
        ? [
              {
                  label: repairing ? 'Ремонт' : 'Строительство',
                  percent: percent(barricade.buildProgress, barricade.buildTime),
              },
          ]
        : barricade.active
          ? [{ label: 'Прочность', percent: percent(barricade.currentHealth, barricade.maxHealth) }]
          : []
    if (barricade.upgrading)
        progress.push({
            label: 'Улучшение',
            percent: percent(barricade.upgradeProgress, barricade.upgradeTime),
        })
    const next = level < BARRICADE_MAX_LEVEL ? entry.benefits[(level + 1) as 1 | 2 | 3] : null
    return {
        kind: 'barricade',
        id: barricade.id,
        title: `${entry.name} (Ур. ${level + 1})`,
        status: barricade.upgrading
            ? 'Улучшение'
            : barricade.active
              ? 'Активна'
              : repairing
                ? 'Ремонт'
                : barricade.building
                  ? 'Строительство'
                  : 'Разрушена',
        disabled: false,
        stats: barricade.active
            ? [row('Прочность', `${Math.floor(barricade.currentHealth)}/${barricade.maxHealth}`)]
            : [],
        progress,
        abilities: barricade.abilities,
        nextAbility: next,
        upgradeCost,
        canUpgrade: upgradeCost !== null && resources >= upgradeCost,
        repairCost,
        canRepair: repairCost !== null && resources >= repairCost,
        refund: barricadeRefund(barricade, refundRate),
        canDemolish: true,
    }
}
