import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
    CAMPAIGN,
    DIFFICULTY_IDS,
    campaignMissions,
    createLevel,
    createSeededRandom,
} from '@/domain'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { useCampaignStore } from '@/stores/campaignStore'
import { useSettingsStore } from '@/stores/settingsStore'
import LevelSelectPage from '@/ui/pages/LevelSelectPage.vue'
import WardroomPage from '@/ui/pages/WardroomPage.vue'
import { CampaignService, type CampaignOptions } from '../CampaignService'
import { applyEffect } from '../session/effects'
import { GameSession } from '../session/GameSession'
import { provideTestServices } from './testServices'

function serviceWith(
    flags: Record<string, number>,
    completed: string[] = [],
    options: CampaignOptions = {},
    // Hardest rank each completed level was won on.
    records: Record<string, string> = {},
) {
    const storage = new MemoryStore()
    storage.write('campaign', {
        flags,
        completedLevels: completed,
        totalStars: 0,
        currentLevelIndex: 0,
        levels: completed.map((id) => ({
            id,
            completed: true,
            stars: 1,
            locked: false,
            ...(records[id] ? { difficulty: records[id] } : {}),
        })),
    })
    return { storage, service: new CampaignService(storage, options) }
}

const report = {
    stars: 1,
    objectives: [],
    flags: {},
    survivors: 0,
}

describe('CampaignService relationships', () => {
    it('plays scenes after victories and saves the relationship with the campaign', () => {
        const { storage, service } = serviceWith({}, ['level_1', 'level_2'])
        const scenes = service.scenesAfterMissions()
        expect(scenes.map((scene) => scene.id)).toContain('kirch_count')
        expect(service.chooseScene('kirch_count', 0)).toContain('Принято')
        expect(service.chooseScene('kirch_count', 0)).toBeNull()

        const reloaded = new CampaignService(storage)
        expect(reloaded.flags.rep_kirch).toBe(2)
        expect(reloaded.scenesAfterMissions().map((scene) => scene.id)).not.toContain('kirch_count')
        const kirch = reloaded.crew().find((member) => member.id === 'kirch')!
        expect(kirch).toMatchObject({ disposition: 2, affection: 2, standing: 'Расположение' })
    })

    it('skips scenes and refuses unknown or locked ones', () => {
        const { service } = serviceWith({}, ['level_1', 'level_2'])
        expect(service.skipScene('kirch_count')).toBe(true)
        expect(service.flags.rep_kirch).toBeUndefined()
        expect(service.skipScene('kirch_count')).toBe(false)
        expect(service.chooseScene('nope', 0)).toBeNull()
        expect(service.scenesBefore(CAMPAIGN.finale)).toEqual([])
    })

    it('hides affection when romance is off', () => {
        const { service } = serviceWith({ aff_kirch: 6 }, [], { romance: () => false })
        expect(service.crew().find((member) => member.id === 'kirch')!.affection).toBeNull()
        // Silva is not aboard yet: listed with a sealed cabin.
        expect(service.crew().find((member) => member.id === 'silva')).toMatchObject({
            present: false,
            cabin: { code: 'К-04' },
        })
    })

    it('resolves the finale with the partner and the difficulty records', () => {
        const completed = CAMPAIGN.sectors
            .filter((sector) => sector.level !== CAMPAIGN.finale)
            .map((sector) => sector.level)
        const records = Object.fromEntries(
            campaignMissions().map((id) => [id, DIFFICULTY_IDS[DIFFICULTY_IDS.length - 1]!]),
        )
        const golden = {
            engines_restored: 1,
            engineer_saved: 1,
            scientist_saved: 1,
            archive_saved: 1,
            truth_told: 1,
            ballast_dumped: 1,
            surgeon_saved: 1,
            rep_voss: 6,
            rep_kirch: 5,
            rep_hale: 5,
            rep_chen: 5,
            rep_silva: 5,
            rep_renn: 5,
            aff_hale: 7,
        }
        const plain = serviceWith(golden, completed).service
        const plainEnding = plain.recordResult(CAMPAIGN.finale, { ...report, outcome: 'victory' })
        expect(plainEnding.ending).toMatchObject({ id: 'ascent', partner: 'Командор Маркус Хейл' })

        // The finale's own record comes from the report of that very mission.
        const { service } = serviceWith(golden, completed, {}, records)
        const ending = service.recordResult(CAMPAIGN.finale, {
            ...report,
            outcome: 'victory',
            difficulty: DIFFICULTY_IDS[DIFFICULTY_IDS.length - 1]!,
        })
        expect(ending.ending?.id).toBe('golden')
        expect(ending.ending?.epilogue.length).toBeGreaterThan(0)
    })

    it('applies relationship effects of level events in a session', () => {
        const session = new GameSession(createLevel('level_7')!, createSeededRandom(1), {
            campaignFlags: { rep_renn: 1 },
        })
        applyEffect(session, {
            type: 'transaction',
            cost: {},
            effects: [{ type: 'relationship', character: 'renn', disposition: -3 }],
        })
        expect(session.story.flags.rep_renn).toBe(-2)
        expect(session.canAfford({ type: 'relationship', character: 'renn', disposition: 1 })).toBe(
            true,
        )
    })
})

describe('crew scenes in the wardroom', () => {
    let wrapper: VueWrapper | null = null

    function router() {
        return createRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', name: 'menu', component: { template: '<main />' } },
                { path: '/levels', name: 'levels', component: LevelSelectPage },
                { path: '/wardroom', name: 'wardroom', component: WardroomPage },
                {
                    path: '/quartermaster',
                    name: 'quartermaster',
                    component: { template: '<main />' },
                },
                { path: '/game/:levelId', name: 'game', component: { template: '<main />' } },
            ],
        })
    }

    beforeEach(async () => {
        setActivePinia(createPinia())
        await provideTestServices()
    })

    afterEach(() => {
        wrapper?.unmount()
        wrapper = null
    })

    async function mountAt(path: '/levels' | '/wardroom') {
        const navigation = router()
        await navigation.push(path)
        wrapper = mount(path === '/levels' ? LevelSelectPage : WardroomPage, {
            global: { plugins: [navigation] },
        })
        return { navigation, page: wrapper }
    }

    const button = (page: VueWrapper, text: string) =>
        page.findAll('button').find((candidate) => candidate.text().includes(text))
    const facility = (page: VueWrapper, code: string) =>
        page
            .findAll('.deck-map__facility')
            .find((room) => room.attributes('aria-label')?.startsWith(code))!
    const cabin = (page: VueWrapper, code: string) =>
        page
            .findAll('.crew-deck__room')
            .find((room) => room.attributes('aria-label')?.startsWith(code))!

    it('locks the service rooms until the living quarters and the bridge are won', async () => {
        const campaign = useCampaignStore()
        campaign.completeLevel('level_1', 1)
        const { navigation, page } = await mountAt('/levels')
        expect(facility(page, 'КК-3').attributes('aria-label')).toBe(
            'КК-3 Кают-компания: ПОСЛЕ B-3',
        )
        expect(facility(page, 'ИТ-41').attributes('aria-label')).toBe(
            'ИТ-41 Интендантство: ПОСЛЕ S-1',
        )
        expect(facility(page, 'КК-3').attributes('aria-disabled')).toBe('true')
        await facility(page, 'КК-3').trigger('click')
        await facility(page, 'ИТ-41').trigger('click')
        expect(navigation.currentRoute.value.name).toBe('levels')
        expect(campaign.isFacilityOpen('wardroom')).toBe(false)

        campaign.completeLevel('level_2', 1)
        expect(campaign.isFacilityOpen('wardroom')).toBe(true)
        expect(campaign.isFacilityOpen('quartermaster')).toBe(false)
        campaign.completeLevel('level_10', 1)
        expect(campaign.isFacilityOpen('quartermaster')).toBe(true)
    })

    it('puts the wardroom and the quartermaster on the ship map as service rooms', async () => {
        const campaign = useCampaignStore()
        for (const id of ['level_1', 'level_2', 'level_10']) campaign.completeLevel(id, 1)
        const { navigation, page } = await mountAt('/levels')
        // Service rooms are not missions.
        expect(page.findAll('.deck-map__room')).toHaveLength(campaign.levels.length)
        expect(facility(page, 'КК-3').attributes('aria-label')).toMatch(
            /^КК-3 Кают-компания: РАЗГОВОРОВ: \d+$/,
        )
        expect(facility(page, 'КК-3').classes()).toContain('deck-map__facility--alert')
        expect(facility(page, 'ИТ-41').attributes('aria-label')).toMatch(
            /^ИТ-41 Интендантство: НА СЧЁТЕ: \d+$/,
        )
        // Nothing opens by itself, and the old button is gone.
        expect(page.find('.scene-screen').exists()).toBe(false)
        expect(button(page, 'КАЮТ-КОМПАНИЯ')).toBeUndefined()

        await facility(page, 'ИТ-41').trigger('click')
        await vi.waitFor(() => expect(navigation.currentRoute.value.name).toBe('quartermaster'))
        await navigation.push('/levels')
        await facility(page, 'КК-3').trigger('keydown', { key: 'Enter' })
        await vi.waitFor(() => expect(navigation.currentRoute.value.name).toBe('wardroom'))
    })

    it('shows a cabin for every character and talks to one of them', async () => {
        const campaign = useCampaignStore()
        campaign.completeLevel('level_1', 1)
        campaign.completeLevel('level_2', 1)
        const { navigation, page } = await mountAt('/wardroom')
        expect(page.findAll('.crew-deck__room')).toHaveLength(campaign.crewDeck.members.length + 1)
        // Silva is not aboard yet: her cabin is sealed.
        expect(cabin(page, 'К-04').classes()).toContain('crew-deck__room--absent')
        expect(cabin(page, 'К-04').text()).toContain('НЕТ НА СВЯЗИ')
        // The page opens on whoever waits to talk.
        expect(cabin(page, 'К-01').attributes('aria-pressed')).toBe('true')
        expect(cabin(page, 'К-01').text()).toContain('● 1')
        expect(page.find('.cabin-info__title').text()).toBe('Лейтенант Ода Кирх')

        await button(page, 'ПОГОВОРИТЬ')!.trigger('click')
        expect(page.find('.scene-screen__speaker').text()).toBe('Лейтенант Ода Кирх')
        await page.findAll('.scene-screen__choice')[0]!.trigger('click')
        expect(page.find('.scene-screen__reply').text()).toContain('Принято')
        await button(page, 'ДАЛЕЕ')!.trigger('click')
        expect(page.find('.scene-screen').exists()).toBe(false)
        expect(cabin(page, 'К-01').text()).toContain('Расположение')
        expect(cabin(page, 'К-01').text()).not.toContain('●')
        // Romance was not accepted at registration: no hearts.
        expect(cabin(page, 'К-01').text()).not.toContain('♥')
        expect(button(page, 'ПОГОВОРИТЬ')!.attributes('disabled')).toBeDefined()

        await cabin(page, 'К-03').trigger('click')
        expect(page.find('.cabin-info__title').text()).toBe('Капитан-Носитель Ирена Восс')
        await button(page, 'К СХЕМЕ КОРАБЛЯ')!.trigger('click')
        await vi.waitFor(() => expect(navigation.currentRoute.value.name).toBe('levels'))
    })

    it('plays every waiting conversation at the common table', async () => {
        const campaign = useCampaignStore()
        for (const id of ['level_0', 'level_1', 'level_2']) campaign.completeLevel(id, 1)
        const { page } = await mountAt('/wardroom')
        expect(campaign.pendingScenes.map((scene) => scene.speakerId)).toEqual(['hale', 'kirch'])
        await page.find('.crew-deck__room--wardroom').trigger('click')
        expect(page.find('.scene-screen__speaker').text()).toBe('Командор Маркус Хейл')
        await button(page, 'ПРОПУСТИТЬ')!.trigger('click')
        expect(page.find('.scene-screen__speaker').text()).toBe('Лейтенант Ода Кирх')
        await button(page, 'ПОЗЖЕ')!.trigger('click')
        expect(campaign.pendingScenes.map((scene) => scene.speakerId)).toEqual(['kirch'])
    })

    it('stays quiet when crew scenes are turned off', async () => {
        useSettingsStore().settings.crewScenes = false
        const campaign = useCampaignStore()
        campaign.completeLevel('level_1', 1)
        campaign.completeLevel('level_2', 1)
        const map = await mountAt('/levels')
        expect(facility(map.page, 'КК-3').attributes('aria-label')).toContain('ТИШИНА')
        wrapper!.unmount()
        const { page } = await mountAt('/wardroom')
        expect(page.text()).toContain('Сцены с экипажем отключены в настройках.')
        expect(page.findAll('.crew-deck__badge')).toHaveLength(0)
    })

    it('plays briefing scenes before the mission and lets the player skip them', async () => {
        const campaign = useCampaignStore()
        for (const id of ['level_1', 'level_2', 'level_3', 'level_4']) campaign.completeLevel(id, 1)
        const { navigation, page } = await mountAt('/levels')
        await page
            .findAll('.deck-map__room')
            .find((room) => room.attributes('aria-label')?.startsWith('E-0'))!
            .trigger('click')
        await button(page, 'НАЧАТЬ ЗАЩИТУ')!.trigger('click')
        expect(page.find('.scene-screen__speaker').text()).toBe('Командор Маркус Хейл')
        await button(page, 'ПРОПУСТИТЬ')!.trigger('click')
        await vi.waitFor(() => expect(navigation.currentRoute.value.fullPath).toBe('/game/level_9'))
        const hale = campaign.crewDeck.members.find((member) => member.id === 'hale')!
        expect(hale.disposition).toBe(0)
    })
})
