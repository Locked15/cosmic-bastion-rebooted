import type { ResultView } from '../../dto/views'
import type { GameSession } from '../GameSession'
import { row } from './format'

// One star for the main objectives (nothing without them), one per optional objective, up to 3.
export function starsFor(session: GameSession): number {
    session.objectives.update(session)
    const { objectives } = session.level
    if (!objectives.every((objective) => objective.optional || objective.completed)) return 0
    return Math.min(3, 1 + objectives.filter((o) => o.optional && o.completed).length)
}

export function presentResult(session: GameSession): ResultView | null {
    const result = session.result
    if (!result) return null
    session.objectives.update(session)
    const { level, stats } = session
    const objectives = session.objectives.all.map(({ id, text, completed, optional }) => ({
        id,
        text,
        completed,
        optional,
    }))
    const detail = { objectives, unlocks: [], ending: null, requisitions: null, advanced: false }
    if (result.outcome === 'victory') {
        const done = level.objectives.filter((objective) => objective.completed).length
        return {
            ...detail,
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
        ...detail,
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
