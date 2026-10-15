import type { MusicTrack } from '@/domain'

// Background music: one looping track at a time. Volume is 0..1.
export interface MusicPlayer {
    // Switches to `track` (null stops the music). The same track keeps playing.
    play(track: MusicTrack | null): void
    setVolume(volume: number): void
}

export const silentMusicPlayer: MusicPlayer = {
    play() {},
    setVolume() {},
}
