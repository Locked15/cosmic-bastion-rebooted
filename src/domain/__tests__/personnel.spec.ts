import { describe, it, expect } from 'vitest'
import { Conversion, Person, createSeededRandom } from '../index'

describe('personnel', () => {
    it.each([
        ['miner', 'military', 120],
        ['military', 'miner', 180],
    ] as const)('converts %s to %s in %i frames once', (from, to, time) => {
        const conversion = new Conversion(from, to, 3, 'conversion')
        expect(conversion.update(time / 2)).toBe(false)
        expect(conversion.getProgress()).toBe(50)
        expect(conversion.update(time / 2)).toBe(true)
        expect(conversion.completed).toBe(true)
        expect(conversion.update(1)).toBe(false)
    })
    it('moves with frame duration and chooses deterministic idle targets', () => {
        const person = new Person('miner', 100, 500, 'miner')
        const rng = createSeededRandom(1)
        person.targetX = 200
        person.update(2, 450, 1200, 700, rng)
        expect(person.x).toBeCloseTo(102.2)
        const wander = () => {
            const person = new Person('miner', 100, 500, 'miner')
            person.update(121, 450, 1200, 700, createSeededRandom(1))
            return [person.targetX, person.targetY]
        }
        expect(wander()).toEqual(wander())
        person.freezeIdle = true
        person.targetX = person.x
        person.update(200, 450, 1200, 700, rng)
        expect(person.idleTimer).toBe(0)
    })
})
