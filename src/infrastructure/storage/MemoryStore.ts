import type { KeyValueStore } from '@/application/ports/KeyValueStore'

// In-memory store for tests.
export class MemoryStore implements KeyValueStore {
    private readonly data = new Map<string, string>()

    read<T>(key: string): T | null {
        const raw = this.data.get(key)
        return raw ? (JSON.parse(raw) as T) : null
    }

    write<T>(key: string, value: T): void {
        this.data.set(key, JSON.stringify(value))
    }

    remove(key: string): void {
        this.data.delete(key)
    }
}
