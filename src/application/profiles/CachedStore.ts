import type { KeyValueStore } from '../ports/KeyValueStore'

// Where a cached store persists its changes.
export interface CacheSink {
    put(key: string, value: unknown): Promise<void>
    remove(key: string): Promise<void>
}

// Synchronous key-value store over an asynchronous sink: reads come from memory,
// writes update memory at once and reach the sink in the order they were made.
export class CachedStore implements KeyValueStore {
    private readonly data = new Map<string, string>()
    private pending: Promise<void> = Promise.resolve()

    constructor(
        initial: Record<string, unknown> = {},
        private readonly sink: CacheSink | null = null,
        private readonly onError: (error: unknown) => void = (error) =>
            console.error('Failed to save', error),
    ) {
        for (const [key, value] of Object.entries(initial)) {
            if (value !== undefined) this.data.set(key, JSON.stringify(value))
        }
    }

    read<T>(key: string): T | null {
        const raw = this.data.get(key)
        return raw === undefined ? null : (JSON.parse(raw) as T)
    }

    write<T>(key: string, value: T): void {
        const raw = JSON.stringify(value)
        this.data.set(key, raw)
        // Persist the JSON form, so the sink stores exactly what a reload will read.
        this.enqueue((sink) => sink.put(key, JSON.parse(raw)))
    }

    remove(key: string): void {
        this.data.delete(key)
        this.enqueue((sink) => sink.remove(key))
    }

    entries(): Record<string, unknown> {
        return Object.fromEntries([...this.data].map(([key, raw]) => [key, JSON.parse(raw)]))
    }

    // Resolves once every change made so far has reached the sink.
    flush(): Promise<void> {
        return this.pending
    }

    private enqueue(operation: (sink: CacheSink) => Promise<void>): void {
        const sink = this.sink
        if (!sink) return
        this.pending = this.pending.then(() => operation(sink)).catch(this.onError)
    }
}

// The storage services read: it points at the active profile's saves.
export class SwitchingStore implements KeyValueStore {
    constructor(private current: KeyValueStore = new CachedStore()) {}

    use(store: KeyValueStore): void {
        this.current = store
    }

    read<T>(key: string): T | null {
        return this.current.read<T>(key)
    }

    write<T>(key: string, value: T): void {
        this.current.write(key, value)
    }

    remove(key: string): void {
        this.current.remove(key)
    }
}
