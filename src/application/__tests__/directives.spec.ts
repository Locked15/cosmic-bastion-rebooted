import { describe, expect, it } from 'vitest'
import { digest, findDirective } from '../session/directives'

describe('console directives', () => {
    it('digests letters only, case-insensitively', () => {
        expect(digest('abc def')).toBe(digest('ABCDEF'))
        expect(digest('a-b_c 1')).toBe(digest('ABC'))
        expect(digest('ABC')).not.toBe(digest('ABD'))
    })

    it('ignores unknown input', () => {
        expect(findDirective('')).toBeNull()
        expect(findDirective('startwave')).toBeNull()
    })
})
