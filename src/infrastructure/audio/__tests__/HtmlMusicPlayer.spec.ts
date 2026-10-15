import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HtmlMusicPlayer } from '../HtmlMusicPlayer'

class FakeAudio {
    src = ''
    loop = false
    preload = ''
    volume = 1
    paused = true
    static blocked = false
    play = vi.fn(() => {
        if (FakeAudio.blocked) return Promise.reject(new Error('NotAllowedError'))
        this.paused = false
        return Promise.resolve()
    })
    pause = vi.fn(() => {
        this.paused = true
    })
    load = vi.fn()
    removeAttribute = vi.fn((name: string) => {
        if (name === 'src') this.src = ''
    })
}

const track = (id: string) => ({ id, title: id, author: 'A', file: `${id}.webm` })

let created: FakeAudio[]
let events: EventTarget
let player: HtmlMusicPlayer

beforeEach(() => {
    vi.useFakeTimers()
    FakeAudio.blocked = false
    created = []
    events = new EventTarget()
    player = new HtmlMusicPlayer(
        '/audio/',
        () => {
            const audio = new FakeAudio()
            created.push(audio)
            return audio as unknown as HTMLAudioElement
        },
        events as unknown as Window,
    )
    player.setVolume(0.5)
})

afterEach(() => vi.useRealTimers())

describe('HtmlMusicPlayer', () => {
    it('loops a track, fades it in and keeps it when asked for the same track', async () => {
        player.play(track('menu'))
        await vi.advanceTimersByTimeAsync(2000)
        expect(created).toHaveLength(1)
        expect(created[0]).toMatchObject({ src: '/audio/menu.webm', loop: true, paused: false })
        expect(created[0]!.volume).toBeCloseTo(0.5)
        player.play(track('menu'))
        expect(created).toHaveLength(1)
    })

    it('crossfades to the next track and releases the previous one', async () => {
        player.play(track('menu'))
        await vi.advanceTimersByTimeAsync(2000)
        player.play(track('level'))
        await vi.advanceTimersByTimeAsync(2000)
        expect(created[0]!.paused).toBe(true)
        expect(created[0]!.src).toBe('')
        expect(created[1]).toMatchObject({ src: '/audio/level.webm', paused: false })
        player.play(null)
        await vi.advanceTimersByTimeAsync(2000)
        expect(created[1]!.paused).toBe(true)
    })

    it('pauses at zero volume and resumes when turned up', async () => {
        player.play(track('menu'))
        await vi.advanceTimersByTimeAsync(2000)
        player.setVolume(0)
        expect(created[0]!.paused).toBe(true)
        player.setVolume(0.3)
        await vi.advanceTimersByTimeAsync(2000)
        expect(created[0]!.paused).toBe(false)
        expect(created[0]!.volume).toBeCloseTo(0.3)
    })

    it('waits for the first user gesture when autoplay is blocked', async () => {
        FakeAudio.blocked = true
        player.play(track('menu'))
        await vi.advanceTimersByTimeAsync(100)
        expect(created[0]!.paused).toBe(true)
        FakeAudio.blocked = false
        events.dispatchEvent(new Event('pointerdown'))
        await vi.advanceTimersByTimeAsync(2000)
        expect(created[0]!.paused).toBe(false)
        expect(created[0]!.play).toHaveBeenCalledTimes(2)
    })
})
