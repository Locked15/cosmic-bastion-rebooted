export interface Random {
    next(): number
    id(prefix: string): string
}
export function createSeededRandom(seed: number): Random {
    let state = seed >>> 0
    let counter = 0
    return {
        next(): number {
            state = (state + 0x6d2b79f5) >>> 0
            let t = state
            t = Math.imul(t ^ (t >>> 15), t | 1)
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        },
        id(prefix: string): string {
            return `${prefix}_${++counter}`
        },
    }
}
export function createMathRandom(): Random {
    return {
        next(): number {
            return Math.random()
        },
        id(prefix: string): string {
            return prefix + Math.random().toString(36).slice(2, 11)
        },
    }
}
