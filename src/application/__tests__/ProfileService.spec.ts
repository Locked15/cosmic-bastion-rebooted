import { describe, expect, it } from 'vitest'
import { MemoryProfileRepository } from '@/infrastructure/storage/MemoryProfileRepository'
import type { LegacySaves } from '../ports/ProfileRepository'
import { MAX_PROFILES, ProfileService } from '../profiles/ProfileService'

function ids() {
    let next = 0
    return { createId: () => `p${++next}`, now: () => 1_700_000_000_000 + next }
}

class FakeLegacy implements LegacySaves {
    constructor(public data: Record<string, unknown>) {}
    read() {
        return { ...this.data }
    }
    clear() {
        this.data = {}
    }
}

describe('ProfileService', () => {
    it('starts without profiles and validates new names', async () => {
        const service = await ProfileService.open(new MemoryProfileRepository(), ids())
        expect(service.active).toBeNull()
        expect(service.briefing()).toBeNull()
        expect(await service.create('   ')).toEqual({ ok: false, error: 'Введите имя офицера' })
        expect((await service.create('x'.repeat(40))).ok).toBe(false)
        expect(await service.create('  Ирена   Восс ')).toEqual({ ok: true })
        expect(service.active?.name).toBe('Ирена Восс')
        expect((await service.create('ирена восс')).ok).toBe(false)
    })

    it('fixes the rank chosen at registration; old records read as the default rank', async () => {
        const repository = new MemoryProfileRepository()
        await repository.putProfile({ id: 'old', name: 'Старый', createdAt: 1, lastPlayedAt: 1 })
        const service = await ProfileService.open(repository, ids())
        expect(service.difficulty).toBe('modest')
        expect(service.list()[0]!.difficulty).toBe('modest')

        expect((await service.create('Генерал', 'nope' as never)).ok).toBe(false)
        expect(await service.create('Генерал', 'xhard')).toEqual({ ok: true })
        expect(service.difficulty).toBe('xhard')

        const reopened = await ProfileService.open(repository, ids())
        expect(reopened.list().map((profile) => profile.difficulty)).toEqual(['modest', 'xhard'])
    })

    it('re-ranks the active profile only through the console override', async () => {
        const repository = new MemoryProfileRepository()
        const service = await ProfileService.open(repository, ids())
        expect((await service.overrideDifficulty('xhard')).ok).toBe(false)
        await service.create('Кирх', 'simple')
        expect(await service.overrideDifficulty('complex')).toEqual({ ok: true })
        expect((await ProfileService.open(repository, ids())).difficulty).toBe('complex')
    })

    it('keeps at most three profiles, each with its own saves', async () => {
        const service = await ProfileService.open(new MemoryProfileRepository(), ids())
        for (const name of ['Альфа', 'Бета', 'Гамма']) await service.create(name)
        expect(service.list()).toHaveLength(MAX_PROFILES)
        expect(service.canCreate).toBe(false)
        expect(await service.create('Дельта')).toEqual({
            ok: false,
            error: 'Доступно не более 3 профилей',
        })

        const [alpha, beta] = service.list()
        await service.activate(alpha!.id)
        service.storage.write('campaign', {
            completedLevels: ['level_1'],
            totalStars: 3,
            flags: {},
        })
        await service.activate(beta!.id)
        expect(service.storage.read('campaign')).toBeNull()
        expect(service.list().find((profile) => profile.id === alpha!.id)).toMatchObject({
            completedLevels: 1,
            stars: 3,
            active: false,
        })
    })

    it('persists profiles, saves and the active profile across restarts', async () => {
        const repository = new MemoryProfileRepository()
        const first = await ProfileService.open(repository, ids())
        await first.create('Альфа')
        await first.create('Бета')
        first.storage.write('achievements', ['firstBlood'])
        first.device.write('settings', { volume: 10 })
        await first.flush()

        const second = await ProfileService.open(repository, ids())
        expect(second.active?.name).toBe('Бета')
        expect(second.storage.read('achievements')).toEqual(['firstBlood'])
        expect(second.device.read('settings')).toEqual({ volume: 10 })
        expect(second.list().map((profile) => profile.name)).toEqual(['Альфа', 'Бета'])
    })

    it('deletes a profile with its saves and requires a new choice when it was active', async () => {
        const repository = new MemoryProfileRepository()
        const service = await ProfileService.open(repository, ids())
        await service.create('Альфа')
        service.storage.write('campaign', { completedLevels: [], totalStars: 0 })
        await service.remove(service.active!.id)
        expect(service.active).toBeNull()
        expect(service.list()).toEqual([])
        expect(service.storage.read('campaign')).toBeNull()
        expect(repository.saves.size).toBe(0)
        expect(repository.device.has('activeProfile')).toBe(false)
        expect((await service.remove('missing')).ok).toBe(false)
    })

    it('moves saves from before profiles into the first profile and settings to the device', async () => {
        const legacy = new FakeLegacy({
            campaign: { completedLevels: ['level_1'], totalStars: 2, flags: {} },
            settings: { volume: 30 },
        })
        const service = await ProfileService.open(new MemoryProfileRepository(), {
            ...ids(),
            legacy,
        })
        expect(service.device.read('settings')).toEqual({ volume: 30 })
        expect(service.hasLegacySaves).toBe(true)
        await service.create('Ветеран')
        expect(service.storage.read('campaign')).toMatchObject({ totalStars: 2 })
        expect(legacy.data).toEqual({})
        expect(service.hasLegacySaves).toBe(false)
    })

    it('words the report by story progress', async () => {
        const service = await ProfileService.open(new MemoryProfileRepository(), ids())
        await service.create('Хейл')
        expect(service.briefing()).toBe('Экстренный рапорт, Хейл.')
        const progress = (completedLevels: string[], flags: Record<string, number> = {}) =>
            service.storage.write('campaign', { completedLevels, flags, totalStars: 0 })
        progress(['level_1'])
        expect(service.briefing()).toBe('Сводка с внешнего корпуса, Хейл.')
        progress(['level_1', 'level_2', 'level_3', 'level_4'], { truth_told: 1 })
        expect(service.briefing()).toBe('Донесение под грифом Внутреннего Круга, Хейл.')
        progress(['level_5'], { engines_restored: 1, engineer_saved: 1 })
        expect(service.briefing()).toBe('Бортовой журнал на взлёте, Хейл.')
        progress(['level_5'])
        expect(service.briefing()).toBe('Рапорт из Вечного Бастиона, Хейл.')
    })
})
