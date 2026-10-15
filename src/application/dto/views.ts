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

export interface EndingView {
    id: string
    title: string
    paragraphs: string[]
    // What became of the cast, by their standing with the player.
    epilogue: string[]
    // Name of the player's partner, if any.
    partner: string | null
}

// A visual-novel scene between missions.
export interface SceneView {
    id: string
    speaker: string
    place: string
    lines: string[]
    choices: string[]
}

export interface CrewMemberView {
    id: string
    name: string
    role: string
    disposition: number
    standing: string
    // Null for characters without romance, or when romance is turned off.
    affection: number | null
    partner: boolean
}

export interface CampaignResolution {
    advanced: boolean
    // The level was won for the first time (pays a requisition bonus).
    firstVictory: boolean
    unlocks: string[]
    // Set after the finale: the campaign's ending.
    ending: EndingView | null
}

export interface ResultView {
    objectives: ObjectiveView[]
    unlocks: string[]
    ending: EndingView | null
    // Requisitions paid for this mission.
    requisitions: number | null
    outcome: 'victory' | 'defeat'
    reason: string
    stats: StatRow[]
    stars: number
}

export interface GameSnapshot {
    swarmMemory: { tower: string; percent: number } | null
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

export interface MapRect {
    x: number
    y: number
    width: number
    height: number
}

export interface LevelSummary {
    // Hardest rank the level was won on, if any.
    rank: string | null
    sector: string
    // Deck code on the ship map (A-7…).
    code: string
    layer: 'outer' | 'living' | 'core' | 'training'
    // Room outline on the ship map.
    map: MapRect
    // Ids of the levels whose victory opens this one.
    requires: string[]
    // Conduits drawn on the map from each required level: [x, y] points.
    routes: { from: string; points: [number, number][] }[]
    // Enemy pressure 1–5, from the level's wave difficulty.
    threat: number
    // The last mission of the campaign.
    finale: boolean
    // Their names, for the mission panel.
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
    // Sound effects and music, 0..100.
    volume: number
    music: number
    // Character scenes between missions on the ship map; off hides them all.
    crewScenes: boolean
    // Romantic lines, the partner choice and the partner's epilogue.
    romance: boolean
}

export const DEFAULT_SETTINGS: Settings = {
    brightness: 100,
    volume: 50,
    music: 40,
    crewScenes: true,
    romance: true,
}
