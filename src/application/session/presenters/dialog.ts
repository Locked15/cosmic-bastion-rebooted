import type { DialogView } from '../../dto/views'
import type { GameSession } from '../GameSession'

export function presentDialog(session: GameSession): DialogView | null {
    const active = session.activeDialog
    if (!active) return null
    return {
        title: active.dialog.title,
        text: active.dialog.text,
        choices: active.dialog.choices.map((choice) => ({
            text: choice.text,
            hint: '',
            disabled: !session.canAfford(choice.effect),
        })),
        secondsLeft:
            active.framesLeft === null ? null : Math.max(0, Math.ceil(active.framesLeft / 60)),
    }
}
