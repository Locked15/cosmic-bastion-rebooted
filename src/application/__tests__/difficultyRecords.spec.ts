import { describe, expect, it } from 'vitest'
import { CAMPAIGN, allLevelsAtDifficulty, resolveEnding, type DifficultyId } from '@/domain'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { CampaignService, type MissionReport } from '../CampaignService'
import { rankView } from '../dto/ranks'

const report: MissionReport = {
    outcome: 'victory',
    stars: 2,
    objectives: [],
    flags: {},
    survivors: 10,
}

const missions = CAMPAIGN.sectors
    .filter((sector) => sector.layer !== 'training')
    .map((sector) => sector.level)

const recordsAt = (difficulty: DifficultyId) =>
    Object.fromEntries(missions.map((id) => [id, difficulty]))

describe('difficulty records', () => {
    it('keeps the hardest rank each level was won on, across reloads', () => {
        const storage = new MemoryStore()
        const service = new CampaignService(storage)
        service.recordResult('level_1', { ...report, difficulty: 'complex' })
        service.recordResult('level_1', { ...report, difficulty: 'simple' })
        service.recordResult('level_1', { ...report, outcome: 'defeat', difficulty: 'xhard' })
        expect(service.difficultyRecords).toEqual({ level_1: 'complex' })

        const reloaded = new CampaignService(storage)
        expect(reloaded.difficultyRecords).toEqual({ level_1: 'complex' })
        expect(reloaded.listLevels().find((level) => level.id === 'level_1')?.rank).toBe('Майор')
        expect(reloaded.listLevels().find((level) => level.id === 'level_2')?.rank).toBeNull()

        reloaded.recordResult('level_1', { ...report, difficulty: 'xhard' })
        expect(reloaded.difficultyRecords).toEqual({ level_1: 'xhard' })
    })

    it('shows starting resources as the rank will play them', () => {
        const service = new CampaignService(new MemoryStore())
        const base = service.listLevels('modest').find((level) => level.id === 'level_1')!
        const easy = service.listLevels('simple').find((level) => level.id === 'level_1')!
        expect(easy.startingResources).toBe(Math.round(base.startingResources * 1.5))
    })

    it('needs every campaign mission (not training) at the rank or harder', () => {
        expect(allLevelsAtDifficulty({}, 'simple')).toBe(false)
        expect(allLevelsAtDifficulty(recordsAt('xhard'), 'highest')).toBe(true)
        expect(allLevelsAtDifficulty(recordsAt('xhard'), 'complex')).toBe(true)
        expect(allLevelsAtDifficulty(recordsAt('complex'), 'highest')).toBe(false)
        expect(allLevelsAtDifficulty({ ...recordsAt('xhard'), level_1: 'modest' }, 'xhard')).toBe(
            false,
        )
    })
})

describe('endings by difficulty records', () => {
    const ascent = { engines_restored: 1, engineer_saved: 1 }

    it('opens «Железный Обет» only when every mission was won as a general', () => {
        expect(resolveEnding('victory', ascent, recordsAt('xhard')).id).toBe('iron')
        expect(resolveEnding('victory', ascent, recordsAt('complex')).id).toBe('ascent')
        expect(resolveEnding('victory', ascent).id).toBe('ascent')
        // The general's record alone does not replace the story conditions.
        expect(resolveEnding('victory', {}, recordsAt('xhard')).id).toBe('bastion')
    })

    it('adds the veteran note from major upwards', () => {
        const note = 'учебных допусках'
        const veteran = resolveEnding('victory', ascent, recordsAt('complex'))
        expect(veteran.paragraphs.some((text) => text.includes(note))).toBe(true)
        const cadet = resolveEnding('victory', ascent, recordsAt('modest'))
        expect(cadet.paragraphs.some((text) => text.includes(note))).toBe(false)
    })

    it('resolves the finale ending with the stored records', () => {
        const storage = new MemoryStore()
        storage.write('campaign', {
            flags: ascent,
            completedLevels: missions,
            totalStars: 0,
            currentLevelIndex: 0,
            levels: missions.map((id) => ({
                id,
                completed: true,
                stars: 1,
                locked: false,
                difficulty: 'xhard',
            })),
        })
        const service = new CampaignService(storage)
        const result = service.recordResult(CAMPAIGN.finale, { ...report, difficulty: 'xhard' })
        expect(result.ending?.id).toBe('iron')
    })
})

describe('rank view', () => {
    it('lists the rules that differ between ranks', () => {
        expect(rankView('simple').effects).toContain('Переговоры останавливают бой')
        expect(rankView('xhard').effects).toContain('Бой не ждёт переговоров')
        expect(rankView('xhard').effects).toContain(
            'Средоточие: в каждом секторе, по 2 способности',
        )
        expect(rankView('xhard').insignia).toEqual({ stripes: 0, stars: 1, general: true })
    })
})
