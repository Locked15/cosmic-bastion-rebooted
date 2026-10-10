export type DifficultyId = 'simple' | 'modest' | 'complex' | 'xhard'

export interface Difficulty {
    label: string
    // Flavour text shown in the settings for the selected level.
    description: string
    // Multiplies every enemy's health.
    health: number
    // Multiplies every enemy's movement speed.
    speed: number
    // Enemies that may break into the living quarters before the level is lost.
    maxBreakthroughs: number
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
    simple: {
        label: 'Рядовой',
        description:
            'Учебная тревога для новобранцев. Твари вялые и хрупкие, а жилой отсек выдержит не один прорыв — есть время освоиться с орудиями и баррикадами.',
        health: 0.7,
        speed: 0.85,
        maxBreakthroughs: 15,
    },
    modest: {
        label: 'Лейтенант',
        description:
            'Штатный режим обороны. Рой бьёт в полную силу, но экипаж знает своё дело: каждая ошибка заметна, но ещё не смертельна.',
        health: 1,
        speed: 1,
        maxBreakthroughs: 10,
    },
    complex: {
        label: 'Майор',
        description:
            'Улей адаптировался: существа живучее и быстрее, а оборона отсека трещит по швам. Баррикады и улучшения нужны с первых волн.',
        health: 1.35,
        speed: 1.15,
        maxBreakthroughs: 6,
    },
    xhard: {
        label: 'Генерал',
        description:
            'Последний рубеж. Рой стремителен и почти неуязвим, жилой отсек падёт после нескольких прорывов. Ошибок командование не прощает.',
        health: 1.8,
        speed: 1.3,
        maxBreakthroughs: 3,
    },
}

export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as DifficultyId[]

export const DEFAULT_DIFFICULTY: DifficultyId = 'modest'

export function isDifficultyId(value: unknown): value is DifficultyId {
    return typeof value === 'string' && value in DIFFICULTIES
}
