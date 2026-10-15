import { DIFFICULTIES, type DifficultyId } from '@/domain'

export type { DifficultyId }

// A rank (difficulty) as the registration terminal and the settings show it.
export interface RankView {
    id: DifficultyId
    label: string
    description: string
    // Short lines, one per rule that differs between ranks.
    effects: string[]
    insignia: { stripes: number; stars: number; general: boolean }
}

const percent = (value: number) => `${Math.round(value * 100)}%`

function dialogLine(speed: number): string {
    if (speed <= 0) return 'Переговоры останавливают бой'
    if (speed >= 1) return 'Бой не ждёт переговоров'
    return `Во время переговоров бой идёт ×${speed}`
}

function bossLine(bosses: (typeof DIFFICULTIES)[DifficultyId]['bosses']): string {
    const where =
        bosses.minDepth <= 1 ? 'в каждом секторе' : `с ${bosses.minDepth}-го рубежа корабля`
    const gifts = bosses.abilities > 1 ? `, по ${bosses.abilities} способности` : ''
    return `Средоточие: ${where}${gifts}`
}

export function rankView(id: DifficultyId): RankView {
    const rank = DIFFICULTIES[id]
    const effects = [
        `Здоровье врагов ×${rank.health} · скорость ×${rank.speed}`,
        `Прорывов до поражения: ${rank.maxBreakthroughs}`,
        dialogLine(rank.dialogSpeed),
        bossLine(rank.bosses),
        `Возврат при демонтаже: ${percent(rank.refundRate)}`,
        rank.swarmMemory > 0
            ? `Память Сонма: −${percent(rank.swarmMemory)} урона любимой башне`
            : 'Сонм не запоминает вашу тактику',
        `Реквизиции ×${rank.requisitions}`,
    ]
    return {
        id,
        label: rank.label,
        description: rank.description,
        effects,
        insignia: rank.insignia,
    }
}
