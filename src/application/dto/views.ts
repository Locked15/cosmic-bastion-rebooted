import { DEFAULT_DIFFICULTY, type DifficultyId } from '@/domain'

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
    // Set only for a destroyed barricade that is not being rebuilt yet.
    repairCost: number | null
    canRepair: boolean
    // Resources returned on demolition (0 for destroyed barricades).
    refund: number
    canDemolish: boolean
}

export interface DialogChoiceView {
    text: string
    hint: string
    disabled: boolean
}

export interface DialogView {
    kind: 'full' | 'partial' | 'unknown'
    phase: 'choice' | 'consequence'
    title: string
    text: string
    choices: DialogChoiceView[]
    secondsLeft: number | null
}

export interface ObjectiveView {
    id: string
    text: string
    completed: boolean
}

export interface CampaignResolution {
    advanced: boolean
    unlocks: string[]
}

export interface ResultView {
    objectives: ObjectiveView[]
    unlocks: string[]
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
    // Enemies that broke into the quarters and how many lose the level.
    breakthroughs: { count: number; limit: number }
    buildOptions: BuildOption[]
    selection: SelectionView | null
    dialog: DialogView | null
    result: ResultView | null
}

export interface LevelSummary {
    sector: string
    mapX: number
    mapY: number
    prerequisites: string[]
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
    // Applied when a level starts.
    difficulty: DifficultyId
}

export const DEFAULT_SETTINGS: Settings = {
    brightness: 100,
    volume: 50,
    enemySpeed: 1,
    difficulty: DEFAULT_DIFFICULTY,
}
