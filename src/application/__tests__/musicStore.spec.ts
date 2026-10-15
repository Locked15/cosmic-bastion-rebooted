import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { menuTrack } from '@/domain'
import { useMusicStore } from '@/stores/musicStore'
import { provideTestServices } from './testServices'

const play = vi.fn()

beforeEach(async () => {
    play.mockClear()
    setActivePinia(createPinia())
    await provideTestServices({ music: { play, setVolume: () => {} } })
})

describe('musicStore', () => {
    it('plays the level track in a level and the main theme elsewhere', () => {
        const music = useMusicStore()
        music.playFor('level_5')
        expect(play).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'controlled-chaos' }))
        music.playFor(null)
        expect(play).toHaveBeenLastCalledWith(menuTrack())
        music.playFor('level_99')
        expect(music.current).toEqual(menuTrack())
    })
})
