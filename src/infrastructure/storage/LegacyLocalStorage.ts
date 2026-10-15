import type { LegacySaves } from '@/application/ports/ProfileRepository'

const PREFIX = 'cosmicBastion:'

// Saves of versions without profiles (localStorage, keys prefixed `cosmicBastion:`).
export class LegacyLocalStorage implements LegacySaves {
    constructor(private readonly storage: Storage = localStorage) {}

    read(): Record<string, unknown> {
        const entries: Record<string, unknown> = {}
        for (const key of this.keys()) {
            try {
                entries[key.slice(PREFIX.length)] = JSON.parse(this.storage.getItem(key) ?? 'null')
            } catch {
                // A corrupt entry is not worth importing.
            }
        }
        return entries
    }

    clear(): void {
        for (const key of this.keys()) this.storage.removeItem(key)
    }

    private keys(): string[] {
        return Array.from({ length: this.storage.length }, (_, index) =>
            this.storage.key(index),
        ).filter((key): key is string => !!key?.startsWith(PREFIX))
    }
}
