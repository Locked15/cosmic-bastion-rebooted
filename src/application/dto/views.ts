// Plain view models handed from the application layer to the UI.
// They hold no references to domain objects.

export type BuildCategory = 'tower' | 'barricade'
export type PersonType = 'miner' | 'military'
export type GameView = 'corridor' | 'living'
export type GameStatus = 'running' | 'paused' | 'victory' | 'defeat'

export interface StatRow {
    label: string
    value: string
}

export interface ProgressView {
    label: string
    percent: number
}

export interface AbilityView {
    name: string
    description: string
}

export interface BuildOption {
    category: BuildCategory
    type: string
    name: string
    description: string
    cost: number
    affordable: boolean
}

export interface ConversionView {
    id: string
    title: string
    percent: number
}

export interface SelectionView {
    kind: BuildCategory
    id: string
    title: string
    status: string
    disabled: boolean
    stats: StatRow[]
    progress: ProgressView[]
    abilities: AbilityView[]
    nextAbility: AbilityView | null
    upgradeCost: number | null
    canUpgrade: boolean
    canDemolish: boolean
}

export interface DialogChoiceView {
    text: string
    hint: string
    disabled: boolean
}

export interface DialogView {
    title: string
    text: string
    choices: DialogChoiceView[]
    secondsLeft: number | null
}

export interface ResultView {
    outcome: 'victory' | 'defeat'
    reason: string
    stats: StatRow[]
    stars: number
}

export interface GameSnapshot {
    levelId: string
    levelName: string
    status: GameStatus
    view: GameView
    speed: number
    wave: { current: number; total: number; inProgress: boolean }
    resources: number
    resourceRate: number
    personnel: { miners: number; military: number; lost: number }
    conversions: ConversionView[]
    livingQuarters: { underAttack: boolean; enemies: number; inTransit: number }
    buildOptions: BuildOption[]
    selection: SelectionView | null
    dialog: DialogView | null
    result: ResultView | null
}

export interface LevelSummary {
    id: string
    name: string
    description: string
    story: boolean
    locked: boolean
    completed: boolean
    stars: number
    objectives: string[]
    startingMiners: number
    startingMilitary: number
    startingResources: number
    totalWaves: number
}

export interface Settings {
    brightness: number
    volume: number
    enemySpeed: number
}

export const DEFAULT_SETTINGS: Settings = {
    brightness: 100,
    volume: 50,
    enemySpeed: 1,
}
