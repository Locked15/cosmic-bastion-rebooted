import { describe, expect, it } from 'vitest'
import {
    DIFFICULTIES,
    DIFFICULTY_IDS,
    createLevel,
    createSeededRandom,
    type DifficultyId,
} from '@/domain'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { CheckpointService } from '../CheckpointService'
import { GameSession } from '../session/GameSession'
import { presentSession } from '../session/presenter'

function sessionAt(difficulty: DifficultyId) {
    const session = new GameSession(createLevel('level_1')!, createSeededRandom(9), { difficulty })
    while (session.activeDialog) {
        if (session.activeDialog.phase === 'consequence') session.story.acknowledge()
        else session.chooseDialog(0)
    }
    return session
}

// Run until the first enemy is on the field, then return it.
function firstEnemy(session: GameSession) {
    session.startWave()
    for (let frame = 0; frame < 120; frame++) {
        session.update(1)
        const enemy = session.enemies.find((candidate) => candidate.spawned)
        if (enemy) return enemy
    }
    throw new Error('no enemy spawned')
}

describe('difficulty', () => {
    it('has the four levels with their labels in order', () => {
        expect(DIFFICULTY_IDS).toEqual(['simple', 'modest', 'complex', 'xhard'])
        expect(DIFFICULTY_IDS.map((id) => DIFFICULTIES[id].label)).toEqual([
            'Рядовой',
            'Лейтенант',
            'Майор',
            'Генерал',
        ])
        const descriptions = DIFFICULTY_IDS.map((id) => DIFFICULTIES[id].description)
        expect(new Set(descriptions).size).toBe(4)
        for (const description of descriptions) expect(description.length).toBeGreaterThan(40)
    })

    it('scales enemy health and speed relative to the modest level', () => {
        const modest = firstEnemy(sessionAt('modest'))
        for (const id of ['simple', 'complex', 'xhard'] as const) {
            const enemy = firstEnemy(sessionAt(id))
            expect(enemy.maxHealth).toBe(Math.round(modest.maxHealth * DIFFICULTIES[id].health))
            expect(enemy.speed).toBeCloseTo(modest.speed * DIFFICULTIES[id].speed)
        }
    })

    it('scales health only once per enemy', () => {
        const session = sessionAt('xhard')
        const enemy = firstEnemy(session)
        const health = enemy.maxHealth
        for (let frame = 0; frame < 30; frame++) session.update(1)
        expect(enemy.maxHealth).toBe(health)
    })

    it('loses the level after the allowed number of breakthroughs', () => {
        for (const id of DIFFICULTY_IDS) {
            const session = sessionAt(id)
            const limit = DIFFICULTIES[id].maxBreakthroughs
            session.stats.reached = limit - 1
            session.update(1)
            expect(session.status).toBe('running')
            session.stats.reached = limit
            session.update(1)
            expect(session.status).toBe('defeat')
        }
        expect(presentSession(sessionAt('xhard')).breakthroughs).toEqual({ count: 0, limit: 3 })
    })

    it('resumes a checkpoint at the difficulty the run started with', () => {
        const service = new CheckpointService(new MemoryStore())
        service.save(sessionAt('xhard'))
        const resumed = sessionAt('simple')
        service.restore(resumed)
        expect(resumed.difficulty).toBe('xhard')
        expect(resumed.maxBreakthroughs).toBe(3)
    })
})
