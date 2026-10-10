import { describe, it, expect } from 'vitest'
import { createSeededRandom, createMathRandom } from '../random'

describe('random', () => {
    it('repeats the seed 42 sequence and keeps values in range', () => {
        const sequence = () => {
            const rng = createSeededRandom(42)
            return Array.from({ length: 20 }, () => rng.next())
        }
        const first = sequence()
        expect(sequence()).toEqual(first)
        expect(first.every((value) => value >= 0 && value < 1)).toBe(true)
        expect(new Set(first).size).toBeGreaterThan(1)
        expect(first[0]).toBe(0.6011037519201636)
    })
    it('generates reproducible unique IDs without consuming random values', () => {
        const rng = createSeededRandom(42)
        const ids = Array.from({ length: 10 }, () => rng.id('enemy'))
        const second = createSeededRandom(42)
        expect(Array.from({ length: 10 }, () => second.id('enemy'))).toEqual(ids)
        expect(new Set(ids).size).toBe(10)
        expect(ids[0]).toBe('enemy_1')
        expect(rng.next()).toBe(createSeededRandom(42).next())
    })
    it('provides a Math random adapter with prefixed IDs', () => {
        const rng = createMathRandom()
        expect(rng.id('tower')).toMatch(/^tower[0-9a-z]+$/)
        expect(rng.next()).toBeGreaterThanOrEqual(0)
        expect(rng.next()).toBeLessThan(1)
    })
})
