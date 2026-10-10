export interface MissionSector {
    id: string
    sector: string
    requires: readonly string[]
    x: number
    y: number
}

// Coordinates are percentages on the ship blueprint, from hull to reactor.
export const MISSION_SECTORS: readonly MissionSector[] = [
    { id: 'level_1', sector: 'Внешний корпус', requires: [], x: 50, y: 14 },
    { id: 'level_2', sector: 'Жилые отсеки', requires: ['level_1'], x: 26, y: 38 },
    { id: 'level_3', sector: 'Лаборатории', requires: ['level_1'], x: 74, y: 38 },
    { id: 'level_4', sector: 'Техническое ядро', requires: ['level_2', 'level_3'], x: 50, y: 64 },
    { id: 'level_5', sector: 'Центральный реактор', requires: ['level_4'], x: 50, y: 88 },
]
