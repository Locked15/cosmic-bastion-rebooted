import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { SOUNDTRACK, createLevel, menuTrack, musicTrack, type MusicTrack } from '@/domain'
import { useServices } from './services'

// Which track plays: each level has its own, everything else uses the menu theme.
export const useMusicStore = defineStore('music', () => {
    const { music } = useServices()
    const current = shallowRef<MusicTrack | null>(null)

    function playFor(levelId: string | null) {
        const id = levelId ? createLevel(levelId)?.music : undefined
        const track = (id && musicTrack(id)) || menuTrack()
        current.value = track
        music.play(track)
    }

    const credit = SOUNDTRACK.credit
    const tracks = Object.values(SOUNDTRACK.tracks).map((track) => track.title)

    return { current, credit, tracks, playFor }
})
