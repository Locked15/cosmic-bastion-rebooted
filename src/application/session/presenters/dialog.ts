import { choiceEffect, costText } from '@/domain/story/events'
import type { DialogView } from '../../dto/views'
import type { GameSession } from '../GameSession'

export function presentDialog(session: GameSession): DialogView | null {
    const active = session.activeDialog
    if (!active) return null
    const { dialog, phase } = active
    return {
        kind: dialog.kind,
        phase,
        title: phase === 'consequence' ? `ПОСЛЕДСТВИЯ: ${dialog.title}` : dialog.title,
        text: phase === 'consequence' ? (active.consequence ?? '') : dialog.text,
        choices:
            phase === 'consequence'
                ? []
                : dialog.choices.map((choice) => ({
                      text: choice.text,
                      hint:
                          dialog.kind === 'full'
                              ? [costText(choice), choice.consequence].filter(Boolean).join(' · ')
                              : '',
                      disabled: !session.canAfford(choiceEffect(choice)),
                  })),
        secondsLeft:
            active.framesLeft === null ? null : Math.max(0, Math.ceil(active.framesLeft / 60)),
    }
}
