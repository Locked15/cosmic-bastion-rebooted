import type { KeyValueStore } from './ports/KeyValueStore'
import type { GameSession } from './session/GameSession'
import {
    canCheckpoint,
    createCheckpoint,
    restoreCheckpoint,
    type LevelCheckpoint,
} from './session/checkpoint'

const key = (levelId: string) => `checkpoint:${levelId}`

// Saves level progress between waves so the player can leave and resume later.
export class CheckpointService {
    constructor(private readonly storage: KeyValueStore) {}

    // Wave number the saved progress resumes after, or null.
    savedWave(levelId: string): number | null {
        return this.storage.read<LevelCheckpoint>(key(levelId))?.wave ?? null
    }

    save(session: GameSession): boolean {
        if (!canCheckpoint(session)) return false
        this.storage.write(key(session.level.id), createCheckpoint(session))
        return true
    }

    restore(session: GameSession): boolean {
        const checkpoint = this.storage.read<LevelCheckpoint>(key(session.level.id))
        if (!checkpoint || checkpoint.version !== 1) return false
        restoreCheckpoint(session, checkpoint)
        return true
    }

    clear(levelId: string): void {
        this.storage.remove(key(levelId))
    }
}
