import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { BREACH_EVENT_ID, createLevel } from '@/domain'
import { useCampaignStore } from '@/stores/campaignStore'
import { useGameStore } from '@/stores/gameStore'
import { digest, findDirective } from '../session/directives'
import { provideTestServices } from './testServices'

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

    it('finds the story-flag codes', () => {
        expect(findDirective('Yest probitie!')).toMatchObject({
            kind: 'flag',
            flag: 'hull_breached',
            value: 1,
        })
        expect(findDirective('RICOCHET!')).toMatchObject({
            kind: 'flag',
            flag: 'hull_breached',
            value: 0,
        })
        expect(findDirective('zerg rush')).toBeNull()
        expect(findDirective('Beam me up, Scotty')).toMatchObject({
            kind: 'flag',
            flag: 'engineer_saved',
            value: 1,
        })
        expect(findDirective("They don't care about us")).toMatchObject({
            kind: 'flag',
            flag: 'engineer_saved',
            value: 0,
        })
    })
})

describe('story-flag codes in the console', () => {
    beforeEach(async () => {
        setActivePinia(createPinia())
        await provideTestServices()
    })

    it('toggles a campaign flag and the running mission keeps it', () => {
        const game = useGameStore()
        const campaign = useCampaignStore()
        // Without a mission the flag still flips (it only matters for later missions).
        expect(game.enter('YESTPROBITIE!')).toBe('Код принят: прорыв корпуса — вкл')
        game.start('level_1')
        expect(game.enter('beam me up scotty')).toBe('Код принят: инженер Чен — вкл')
        // Saving twice keeps him saved: the engineer codes set, they do not toggle.
        expect(game.enter('beam me up scotty')).toBe('Код принят: инженер Чен — вкл')
        expect(game.enter('RICOCHET!')).toBe('Код принят: прорыв корпуса — выкл')
        game.stop()
        campaign.reload()
        const chen = () => campaign.crewDeck.members.find((m) => m.id === 'chen')!.present
        expect(chen()).toBe(true)
        expect(game.enter('THEYDONTCAREABOUTUS')).toBe('Код принят: инженер Чен — выкл')
        expect(chen()).toBe(false)
        const breached = () => {
            const level = createLevel('level_2')!
            campaign.prepareLevel(level)
            return level.events.some((event) => event.id === BREACH_EVENT_ID)
        }
        expect(breached()).toBe(false)
        game.enter('yest probitie')
        expect(breached()).toBe(true)
    })
})
