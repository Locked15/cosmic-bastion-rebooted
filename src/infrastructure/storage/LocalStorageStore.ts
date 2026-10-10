import type { KeyValueStore } from '@/application/ports/KeyValueStore'

const PREFIX = 'cosmicBastion:'

export class LocalStorageStore implements KeyValueStore {
    read<T>(key: string): T | null {
        try {
            const raw = localStorage.getItem(PREFIX + key)
            return raw ? (JSON.parse(raw) as T) : null
        } catch {
            return null
        }
    }

    write<T>(key: string, value: T): void {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value))
        } catch (error) {
            console.error(`Failed to save ${key}`, error)
        }
    }

    remove(key: string): void {
        localStorage.removeItem(PREFIX + key)
    }
}
