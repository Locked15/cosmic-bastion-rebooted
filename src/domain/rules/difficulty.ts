export type DifficultyId = 'simple' | 'modest' | 'complex' | 'xhard'

export interface Difficulty {
    label: string
    // Multiplies every enemy's health.
    health: number
    // Multiplies every enemy's movement speed.
    speed: number
    // Enemies that may break into the living quarters before the level is lost.
    maxBreakthroughs: number
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
    simple: { label: 'Не бей меня', health: 0.7, speed: 0.85, maxBreakthroughs: 15 },
    modest: { label: 'Подходи!', health: 1, speed: 1, maxBreakthroughs: 10 },
    complex: { label: 'Это пальба!', health: 1.35, speed: 1.15, maxBreakthroughs: 6 },
    xhard: { label: 'На смерть!', health: 1.8, speed: 1.3, maxBreakthroughs: 3 },
}

export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as DifficultyId[]

export const DEFAULT_DIFFICULTY: DifficultyId = 'modest'

export function isDifficultyId(value: unknown): value is DifficultyId {
    return typeof value === 'string' && value in DIFFICULTIES
}
