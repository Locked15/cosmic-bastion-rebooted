import type { EventEffect, LevelEvent, StoryDialog } from '@/domain'

const FPS = 60

export interface ActiveDialog {
    dialog: StoryDialog
    // Real-time frames left before an option is picked automatically; null = untimed.
    framesLeft: number | null
}

// What the story needs from the game to check and apply choice effects.
export interface EffectTarget {
    canAfford(effect: EventEffect | null): boolean
    applyEffect(effect: EventEffect | null): void
}

// Queues level events into dialogs and resolves the player's choices.
export class StoryDirector {
    active: ActiveDialog | null = null
    private pending: LevelEvent[]
    private queue: StoryDialog[] = []

    constructor(
        events: readonly LevelEvent[],
        private readonly target: EffectTarget,
    ) {
        this.pending = [...events]
    }

    // Queue every event scheduled for the start of `wave` (0 = level start).
    onWaveStart(wave: number): void {
        const due = this.pending.filter((event) => event.wave === wave)
        this.pending = this.pending.filter((event) => !due.includes(event))
        this.queue.push(...due.map((event) => event.dialog))
        if (!this.active) this.openNext()
    }

    choose(index: number): string | null {
        const choice = this.active?.dialog.choices[index]
        if (!choice) return 'Нет такого варианта'
        if (!this.target.canAfford(choice.effect)) return 'Недостаточно ресурсов'
        this.active = null
        this.target.applyEffect(choice.effect)
        this.openNext()
        return null
    }

    // Count down timed dialogs in real time; on timeout take the last affordable option.
    tick(realFrames: number): void {
        const active = this.active
        if (!active || active.framesLeft === null) return
        active.framesLeft -= realFrames
        if (active.framesLeft > 0) return
        const choices = active.dialog.choices
        for (let index = choices.length - 1; index >= 0; index--) {
            if (this.target.canAfford(choices[index]!.effect)) {
                this.choose(index)
                return
            }
        }
        this.active = null
        this.openNext()
    }

    close(): void {
        this.active = null
        this.queue = []
    }

    private openNext(): void {
        const dialog = this.queue.shift()
        this.active = dialog
            ? {
                  dialog,
                  framesLeft: dialog.timed && dialog.timeLimit ? dialog.timeLimit * FPS : null,
              }
            : null
    }
}
