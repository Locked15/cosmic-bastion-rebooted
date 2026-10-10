export type SoundCue =
    | 'click'
    | 'build'
    | 'waveStart'
    | 'waveClear'
    | 'breach'
    | 'dialog'
    | 'victory'
    | 'defeat'
    | 'achievement'

// Plays short game sounds. Volume is 0..1.
export interface SoundPlayer {
    play(cue: SoundCue): void
    setVolume(volume: number): void
}

export const silentSoundPlayer: SoundPlayer = {
    play() {},
    setVolume() {},
}
