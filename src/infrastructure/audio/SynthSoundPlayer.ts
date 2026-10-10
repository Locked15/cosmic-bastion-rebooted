import type { SoundCue, SoundPlayer } from '@/application/ports/SoundPlayer'

interface Tone {
    // Frequencies in Hz played one after another.
    notes: number[]
    duration: number
    type: OscillatorType
}

// Retro "on-board computer" blips synthesized with Web Audio: no audio files needed.
const TONES: Record<SoundCue, Tone> = {
    click: { notes: [880], duration: 0.04, type: 'square' },
    build: { notes: [440, 660], duration: 0.08, type: 'square' },
    waveStart: { notes: [220, 220, 330], duration: 0.15, type: 'sawtooth' },
    waveClear: { notes: [523, 659, 784], duration: 0.12, type: 'triangle' },
    breach: { notes: [196, 147], duration: 0.25, type: 'sawtooth' },
    dialog: { notes: [988, 740], duration: 0.07, type: 'sine' },
    victory: { notes: [523, 659, 784, 1047], duration: 0.18, type: 'triangle' },
    defeat: { notes: [392, 330, 262, 196], duration: 0.25, type: 'sawtooth' },
    achievement: { notes: [784, 988, 1175], duration: 0.1, type: 'sine' },
}

export class SynthSoundPlayer implements SoundPlayer {
    private context: AudioContext | null = null
    private volume = 0.5

    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume))
    }

    play(cue: SoundCue): void {
        if (this.volume === 0) return
        const context = this.ensureContext()
        if (!context) return
        const tone = TONES[cue]
        let start = context.currentTime
        for (const frequency of tone.notes) {
            this.beep(context, frequency, start, tone)
            start += tone.duration
        }
    }

    private beep(context: AudioContext, frequency: number, start: number, tone: Tone): void {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = tone.type
        oscillator.frequency.value = frequency
        // Quiet master level; quick fade-out avoids clicks.
        gain.gain.setValueAtTime(0.15 * this.volume, start)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration)
        oscillator.connect(gain).connect(context.destination)
        oscillator.start(start)
        oscillator.stop(start + tone.duration)
    }

    private ensureContext(): AudioContext | null {
        if (typeof AudioContext === 'undefined') return null
        this.context ??= new AudioContext()
        // Browsers start audio suspended until a user gesture.
        if (this.context.state === 'suspended') void this.context.resume()
        return this.context
    }
}
