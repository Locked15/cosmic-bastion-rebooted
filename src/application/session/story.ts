import type { EventEffect, LevelEvent, StoryDialog, StoryFlags } from '@/domain'
import { choiceEffect, refugeeEvent } from '@/domain/story/events'

const FPS = 60
const MAX_PER_WAVE = 3
const MAX_PER_LEVEL = 10

export interface ActiveDialog {
    dialog: StoryDialog
    phase: 'choice' | 'consequence'
    consequence: string | null
    // Real-time frames; consequences are never timed.
    framesLeft: number | null
}

export interface EffectTarget {
    canAfford(effect: EventEffect | null): boolean
    applyEffect(effect: EventEffect | null): void
}

export class StoryDirector {
    active: ActiveDialog | null = null
    readonly flags: StoryFlags
    private pending: LevelEvent[]
    private queue: LevelEvent[] = []
    private wave = 0
    private elapsed = 0
    private scheduled = 0
    private perWave = new Map<number, number>()

    constructor(
        events: readonly LevelEvent[],
        private readonly target: EffectTarget,
        flags: Readonly<StoryFlags> = {},
    ) {
        this.flags = { ...flags }
        this.pending = [...events]
        const mission = this.flags.mission_index ?? 1
        if (this.flags.refugees_pending && this.flags.refugees_from !== mission) {
            const refugees = refugeeEvent(
                this.flags.refugees_miners ?? 4,
                this.flags.refugees_military ?? 2,
                mission,
            )
            // The redirected group is guaranteed at the next sector's arrival.
            this.pending.unshift({ ...refugees, wave: 0, trigger: 'start', delay: 0 })
        }
    }

    onWaveStart(wave: number): void {
        this.wave = wave
        this.elapsed = 0
        this.pending = this.pending.filter((event) => event.wave >= wave)
        this.scheduleDue()
    }

    choose(index: number): string | null {
        const active = this.active
        if (!active) return 'Нет открытого диалога'
        // Also supports command clients that treat the OK button as choice zero.
        if (active.phase === 'consequence') return index === 0 ? this.acknowledge() : 'Нажмите ОК'
        const choice = active.dialog.choices[index]
        if (!choice) return 'Нет такого варианта'
        const effect = choiceEffect(choice)
        if (!this.target.canAfford(effect)) return 'Недостаточно ресурсов или персонала'
        this.target.applyEffect(effect)
        if (active.dialog.kind === 'unknown') {
            this.active = null
            this.openNext()
        } else {
            this.active = {
                dialog: active.dialog,
                phase: 'consequence',
                consequence: choice.consequence ?? 'Решение принято.',
                framesLeft: null,
            }
        }
        return null
    }

    acknowledge(): string | null {
        if (this.active?.phase !== 'consequence') return 'Нет последствий для подтверждения'
        this.active = null
        this.openNext()
        return null
    }

    tick(realFrames: number): void {
        if (!Number.isFinite(realFrames) || realFrames <= 0) return
        const previous = this.active
        this.elapsed += realFrames
        this.scheduleDue()
        if (!previous || previous !== this.active || previous.framesLeft === null) return
        previous.framesLeft -= realFrames
        if (previous.framesLeft > 0) return
        const choices = previous.dialog.choices
        for (let index = choices.length - 1; index >= 0; index--) {
            if (this.target.canAfford(choiceEffect(choices[index]!))) {
                this.choose(index)
                return
            }
        }
        // No affordable choice: let the player acknowledge the missed event.
        if (previous.dialog.kind === 'unknown') {
            this.active = null
            this.openNext()
        } else {
            this.active = {
                ...previous,
                phase: 'consequence',
                framesLeft: null,
                consequence: 'Время истекло. Доступных решений нет. Ничего не изменилось.',
            }
        }
    }

    close(): void {
        this.active = null
        this.queue = []
        this.pending = []
    }

    private scheduleDue(): void {
        const due = this.pending
            .filter(
                (event) =>
                    event.wave === this.wave &&
                    (event.delay ?? 0) <= this.elapsed &&
                    (!event.condition ||
                        (this.flags[event.condition.flag] ?? 0) >= event.condition.atLeast),
            )
            .sort((a, b) => (a.delay ?? 0) - (b.delay ?? 0))
        this.pending = this.pending.filter((event) => !due.includes(event))
        for (const event of due) {
            const count = this.perWave.get(event.wave) ?? 0
            if (count >= MAX_PER_WAVE || this.scheduled >= MAX_PER_LEVEL) continue
            this.perWave.set(event.wave, count + 1)
            this.scheduled++
            this.queue.push(event)
        }
        if (!this.active) this.openNext()
    }

    private openNext(): void {
        const event = this.queue.shift()
        if (!event) {
            this.active = null
            return
        }
        if (event.id === 'refugees') this.flags.refugees_pending = 0
        const dialog = event.dialog
        this.active = {
            dialog,
            phase: 'choice',
            consequence: null,
            framesLeft: dialog.timed
                ? Math.min(15, Math.max(7, dialog.timeLimit ?? 12)) * FPS
                : null,
        }
    }
}
