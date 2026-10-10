import {
    BARRICADE_CATALOG,
    BARRICADE_MAX_LEVEL,
    TOWER_CATALOG,
    TOWER_MAX_LEVEL,
    type Barricade,
    type BarricadeType,
    type TowerSlot,
    type TowerType,
} from '@/domain'
import type { BuildOption, GameSnapshot, ResultView, SelectionView, StatRow } from '../dto/views'
import type { GameSession } from './GameSession'

const UNLOCKED_TOWERS: TowerType[] = ['cannon', 'machinegun', 'rocket']
const UNLOCKED_BARRICADES: BarricadeType[] = ['wall', 'filter']

const percent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0)
const row = (label: string, value: string | number): StatRow => ({ label, value: String(value) })

// Turns the live session into plain view data for the UI.
export function presentSession(session: GameSession): GameSnapshot {
    const dialog = session.activeDialog
    return {
        levelId: session.level.id,
        levelName: session.level.name,
        status: session.status,
        view: session.view,
        speed: session.speed,
        wave: {
            current: session.currentWave,
            total: session.level.totalWaves,
            inProgress: session.waveInProgress,
        },
        resources: session.resources,
        resourceRate: session.resourceRate,
        personnel: { miners: session.miners, military: session.military, lost: session.stats.lost },
        conversions: session.conversions.map((conversion) => ({
            id: conversion.id,
            title: `${conversion.fromType === 'miner' ? '⚒→⚔' : '⚔→⚒'} (${conversion.count})`,
            percent: conversion.getProgress(),
        })),
        livingQuarters: {
            underAttack: session.enemiesInQuarters.length > 0,
            enemies: session.enemiesInQuarters.length,
        },
        buildOptions: presentBuildOptions(session.resources),
        selection: presentSelection(session),
        dialog: dialog
            ? {
                  title: dialog.dialog.title,
                  text: dialog.dialog.text,
                  choices: dialog.dialog.choices.map((choice) => ({
                      text: choice.text,
                      hint: '',
                      disabled: !session.canAfford(choice.effect),
                  })),
                  secondsLeft:
                      dialog.framesLeft === null
                          ? null
                          : Math.max(0, Math.ceil(dialog.framesLeft / 60)),
              }
            : null,
        result: presentResult(session),
    }
}

function presentBuildOptions(resources: number): BuildOption[] {
    const towers = UNLOCKED_TOWERS.map((type) => ({
        category: 'tower' as const,
        type,
        ...TOWER_CATALOG[type],
    }))
    const barricades = UNLOCKED_BARRICADES.map((type) => ({
        category: 'barricade' as const,
        type,
        ...BARRICADE_CATALOG[type],
    }))
    return [...towers, ...barricades].map(({ category, type, name, description, cost }) => ({
        category,
        type,
        name,
        description,
        cost,
        affordable: resources >= cost,
    }))
}

function presentSelection(session: GameSession): SelectionView | null {
    const id = session.selectedId ?? session.pointer.hoverId
    if (!id) return null
    const slot = session.slots.find((candidate) => candidate.id === id)
    if (slot) return presentSlot(slot, session.resources)
    const barricade = session.barricades.find((candidate) => candidate.id === id)
    return barricade ? presentBarricade(barricade, session.resources) : null
}

function presentSlot(slot: TowerSlot, resources: number): SelectionView | null {
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
                  row('Дальность', Math.floor(tower.range)),
                  row('Скорострельность', `${(60 / tower.fireRate).toFixed(1)}/с`),
              ]
            : [],
        progress,
        abilities: tower?.abilities ?? [],
        nextAbility: next,
        upgradeCost,
        canUpgrade: upgradeCost !== null && resources >= upgradeCost,
        canDemolish: true,
    }
}

function presentBarricade(barricade: Barricade, resources: number): SelectionView {
    const entry = BARRICADE_CATALOG[barricade.type]
    const level = barricade.level
    const upgradeCost =
        barricade.active && level < BARRICADE_MAX_LEVEL ? (entry.upgradeCosts[level] ?? null) : null
    const progress = barricade.building
        ? [
              {
                  label: 'Строительство',
                  percent: percent(barricade.buildProgress, barricade.buildTime),
              },
          ]
        : barricade.active
          ? [{ label: 'Прочность', percent: percent(barricade.currentHealth, barricade.maxHealth) }]
          : []
    const next = level < BARRICADE_MAX_LEVEL ? entry.benefits[(level + 1) as 1 | 2 | 3] : null
    return {
        kind: 'barricade',
        id: barricade.id,
        title: `${entry.name} (Ур. ${level + 1})`,
        status: barricade.active ? 'Активна' : barricade.building ? 'Строительство' : 'Разрушена',
        disabled: false,
        stats: barricade.active
            ? [row('Прочность', `${Math.floor(barricade.currentHealth)}/${barricade.maxHealth}`)]
            : [],
        progress,
        abilities: barricade.abilities,
        nextAbility: next,
        upgradeCost,
        canUpgrade: upgradeCost !== null && resources >= upgradeCost,
        canDemolish: true,
    }
}

export function starsFor(session: GameSession): number {
    return Math.min(3, session.level.objectives.filter((objective) => objective.completed).length)
}

function presentResult(session: GameSession): ResultView | null {
    const result = session.result
    if (!result) return null
    const { level, stats } = session
    if (result.outcome === 'victory') {
        const done = level.objectives.filter((objective) => objective.completed).length
        return {
            outcome: 'victory',
            reason: '',
            stars: starsFor(session),
            stats: [
                row('Волн отражено', session.currentWave),
                row('Врагов уничтожено', stats.killed),
                row('Выжившие', `${session.miners + session.military} чел.`),
                row('Ресурсов', Math.floor(stats.gathered)),
                row('Задач', `${done}/${level.objectives.length}`),
            ],
        }
    }
    return {
        outcome: 'defeat',
        reason: result.reason,
        stars: 0,
        stats: [
            row('Волн выдержано', `${Math.max(0, session.currentWave - 1)}/${level.totalWaves}`),
            row('Врагов уничтожено', stats.killed),
            row('Потери персонала', stats.lost),
            row('Прорвалось врагов', stats.reached),
        ],
    }
}
