import type { MusicPlayer } from '@/application/ports/MusicPlayer'
import type { MusicTrack } from '@/domain'

const FADE_MS = 1500
const FADE_STEP_MS = 50

interface Channel {
    id: string
    audio: HTMLAudioElement
    fade: ReturnType<typeof setInterval> | null
}

// Looping music through <audio> elements, with a crossfade between tracks.
// Browsers block sound until the first user gesture; playback then starts on it.
export class HtmlMusicPlayer implements MusicPlayer {
    private current: Channel | null = null
    private volume = 0.4
    private waitingForGesture = false

    constructor(
        private readonly baseUrl: string = `${import.meta.env.BASE_URL}audio/music/`,
        private readonly createAudio: () => HTMLAudioElement = () => new Audio(),
        private readonly events: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
    ) {}

    play(track: MusicTrack | null): void {
        if (track?.id === this.current?.id) return
        if (this.current) this.fadeOut(this.current)
        this.current = null
        if (!track) return
        const audio = this.createAudio()
        audio.src = this.baseUrl + track.file
        audio.loop = true
        audio.preload = 'auto'
        audio.volume = 0
        this.current = { id: track.id, audio, fade: null }
        this.start(this.current)
    }

    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume))
        const channel = this.current
        if (!channel) return
        this.stopFade(channel)
        channel.audio.volume = this.volume
        // Silence pauses the track instead of decoding it for nothing.
        if (this.volume === 0) channel.audio.pause()
        else if (channel.audio.paused) this.start(channel)
    }

    private start(channel: Channel): void {
        if (this.volume === 0) return
        channel.audio.play().then(
            () => this.fadeTo(channel, this.volume),
            () => this.retryOnGesture(),
        )
    }

    private retryOnGesture(): void {
        if (this.waitingForGesture) return
        this.waitingForGesture = true
        const resume = () => {
            this.waitingForGesture = false
            this.events.removeEventListener('pointerdown', resume)
            this.events.removeEventListener('keydown', resume)
            if (this.current) this.start(this.current)
        }
        this.events.addEventListener('pointerdown', resume)
        this.events.addEventListener('keydown', resume)
    }

    private fadeOut(channel: Channel): void {
        this.fadeTo(channel, 0, () => {
            channel.audio.pause()
            channel.audio.removeAttribute('src')
            channel.audio.load()
        })
    }

    private fadeTo(channel: Channel, target: number, done?: () => void): void {
        this.stopFade(channel)
        const steps = Math.max(1, Math.round(FADE_MS / FADE_STEP_MS))
        const delta = (target - channel.audio.volume) / steps
        let step = 0
        channel.fade = setInterval(() => {
            step++
            channel.audio.volume = step >= steps ? target : clamp(channel.audio.volume + delta)
            if (step >= steps) {
                this.stopFade(channel)
                done?.()
            }
        }, FADE_STEP_MS)
    }

    private stopFade(channel: Channel): void {
        if (channel.fade !== null) clearInterval(channel.fade)
        channel.fade = null
    }
}

function clamp(volume: number): number {
    return Math.max(0, Math.min(1, volume))
}
