import type { DifficultyId } from '@/domain'
import type { CommandResult, GameSession } from './GameSession'

// Service directives typed into the dev console. Only digests are kept here.
export type Directive =
    | {
          kind: 'session'
          run: (session: GameSession) => CommandResult & { state?: boolean }
      }
    // Re-ranks the active profile; the next mission starts on that difficulty.
    | { kind: 'rank'; difficulty: DifficultyId }
    // Sets a campaign story flag (and the running mission's copy of it) to `value`, or
    // toggles it between 0 and 1 when `value` is omitted.
    | { kind: 'flag'; flag: string; label: string; value?: number }

const SEED = 'ws.7c19:'
const GRANT = 5000

const session = (run: Extract<Directive, { kind: 'session' }>['run']): Directive => ({
    kind: 'session',
    run,
})
const rank = (difficulty: DifficultyId): Directive => ({ kind: 'rank', difficulty })
const flag = (name: string, label: string, value?: number): Directive => ({
    kind: 'flag',
    flag: name,
    label,
    value,
})

const DIRECTIVES: Readonly<Record<string, Directive>> = {
    yjow7j: session((current) => ({ ok: true, state: current.toggleOverride('lethal') })),
    '1pwag4e': session((current) => current.grantResources(GRANT)),
    evfcp8: session((current) => current.eliminateEnemies()),
    dgk4tx: session((current) => current.clearWave()),
    '1ba0kls': session((current) => current.forceVictory()),
    '1azqu9h': session((current) => ({ ok: true, state: current.toggleOverride('fortified') })),
    ewudf: rank('simple'),
    '9sv4ec': rank('modest'),
    azzhm2: rank('complex'),
    '12brzcz': rank('xhard'),
    // The Swarm loose in the ship after a lost A-7 (more enemies in later missions), or not.
    '14foev2': flag('hull_breached', 'прорыв корпуса', 1),
    ebsdh2: flag('hull_breached', 'прорыв корпуса', 0),
    // Chen evacuated from A-7 with his engine notebooks, or left behind.
    '1kwm449': flag('engineer_saved', 'инженер Чен', 1),
    '1gmuubo': flag('engineer_saved', 'инженер Чен', 0),
}

// Salted FNV-1a over the letters of the input, case-insensitive.
export function digest(input: string): string {
    const text = SEED + input.toUpperCase().replace(/[^A-Z]/g, '')
    let hash = 0x811c9dc5
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193) >>> 0
    }
    return hash.toString(36)
}

// Null when the input is not a directive.
export function findDirective(input: string): Directive | null {
    return DIRECTIVES[digest(input)] ?? null
}
