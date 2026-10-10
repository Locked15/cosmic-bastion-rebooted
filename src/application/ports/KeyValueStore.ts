// Persistence port. Implemented by an adapter (localStorage in the browser, memory in tests).
export interface KeyValueStore {
    read<T>(key: string): T | null
    write<T>(key: string, value: T): void
    remove(key: string): void
}
