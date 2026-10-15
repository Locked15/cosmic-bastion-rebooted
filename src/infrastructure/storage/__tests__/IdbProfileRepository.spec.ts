import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IdbProfileRepository } from '../IdbProfileRepository'

let databases = 0
const open = () => IdbProfileRepository.open(`test-${++databases}`)

describe('IdbProfileRepository', () => {
    it('stores profiles with their saves and device values', async () => {
        const repository = await open()
        const profile = { id: 'a', name: 'Альфа', createdAt: 1, lastPlayedAt: 2 }
        await repository.putProfile(profile)
        await repository.putSave('a', 'campaign', { completedLevels: ['level_1'] })
        await repository.putSave('a', 'checkpoint:level_2', { wave: 3 })
        await repository.putSave('b', 'campaign', { completedLevels: [] })
        await repository.putDevice('settings', { volume: 5 })

        expect(await repository.listProfiles()).toEqual([profile])
        expect(await repository.loadSaves('a')).toEqual({
            campaign: { completedLevels: ['level_1'] },
            'checkpoint:level_2': { wave: 3 },
        })
        expect(await repository.loadDevice()).toEqual({ settings: { volume: 5 } })

        await repository.deleteSave('a', 'checkpoint:level_2')
        expect(Object.keys(await repository.loadSaves('a'))).toEqual(['campaign'])
        await repository.deleteDevice('settings')
        expect(await repository.loadDevice()).toEqual({})
        repository.close()
    })

    it('deletes a profile together with its saves only', async () => {
        const repository = await open()
        await repository.putProfile({ id: 'a', name: 'А', createdAt: 1, lastPlayedAt: 1 })
        await repository.putProfile({ id: 'b', name: 'Б', createdAt: 2, lastPlayedAt: 2 })
        await repository.putSave('a', 'campaign', 1)
        await repository.putSave('a', 'achievements', 2)
        await repository.putSave('b', 'campaign', 3)
        await repository.deleteProfile('a')
        expect((await repository.listProfiles()).map((profile) => profile.id)).toEqual(['b'])
        expect(await repository.loadSaves('a')).toEqual({})
        expect(await repository.loadSaves('b')).toEqual({ campaign: 3 })
        repository.close()
    })
})
