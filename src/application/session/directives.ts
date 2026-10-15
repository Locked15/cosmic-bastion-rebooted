import type { CommandResult, GameSession } from './GameSession'

// Service directives typed into the dev console. Only digests are kept here.
type Directive = (session: GameSession) => CommandResult & { state?: boolean }

const SEED = 'ws.7c19:'
const GRANT = 5000

const DIRECTIVES: Readonly<Record<string, Directive>> = {
    yjow7j: (session) => ({ ok: true, state: session.toggleOverride('lethal') }),
    '1pwag4e': (session) => session.grantResources(GRANT),
    evfcp8: (session) => session.eliminateEnemies(),
    dgk4tx: (session) => session.clearWave(),
    '1ba0kls': (session) => session.forceVictory(),
    '1azqu9h': (session) => ({ ok: true, state: session.toggleOverride('fortified') }),
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
