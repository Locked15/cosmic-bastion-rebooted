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
import { CampaignService, type CampaignOptions } from '../CampaignService'
import { applyEffect } from '../session/effects'
import { GameSession } from '../session/GameSession'
import { provideTestServices } from './testServices'

function serviceWith(
    flags: Record<string, number>,
    completed: string[] = [],
    options: CampaignOptions = {},
) {
    const storage = new MemoryStore()
    storage.write('campaign', {
        flags,
        completedLevels: completed,
        totalStars: 0,
        currentLevelIndex: 0,
        levels: completed.map((id) => ({ id, completed: true, stars: 1, locked: false })),
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
        expect(service.crew().map((member) => member.id)).not.toContain('silva')
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

        const { service } = serviceWith(golden, completed, { difficultyRecords: () => records })
        const ending = service.recordResult(CAMPAIGN.finale, { ...report, outcome: 'victory' })
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

describe('crew scenes on the ship map', () => {
    let wrapper: VueWrapper | null = null

    function router() {
        return createRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', name: 'menu', component: { template: '<main />' } },
                { path: '/levels', name: 'levels', component: LevelSelectPage },
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

    async function mountMap() {
        const navigation = router()
        await navigation.push('/levels')
        wrapper = mount(LevelSelectPage, { global: { plugins: [navigation] } })
        return { navigation, page: wrapper }
    }

    const button = (page: VueWrapper, text: string) =>
        page.findAll('button').find((candidate) => candidate.text().includes(text))

    it('waits for the player to open a scene, then plays a choice and the reply', async () => {
        const campaign = useCampaignStore()
        campaign.completeLevel('level_1', 1)
        campaign.completeLevel('level_2', 1)
        const { page } = await mountMap()
        // Nothing opens by itself.
        expect(page.find('.scene-screen').exists()).toBe(false)
        await button(page, 'КАЮТ-КОМПАНИЯ')!.trigger('click')
        expect(page.find('.scene-screen__speaker').text()).toBe('Лейтенант Ода Кирх')
        await page.findAll('.scene-screen__choice')[0]!.trigger('click')
        expect(page.find('.scene-screen__reply').text()).toContain('Принято')
        await button(page, 'ДАЛЕЕ')!.trigger('click')
        expect(page.find('.scene-screen').exists()).toBe(false)
        expect(page.find('.crew-roster').text()).toContain('Расположение')
        expect(button(page, 'КАЮТ-КОМПАНИЯ')).toBeUndefined()
    })

    it('hides every scene when crew scenes are turned off', async () => {
        useSettingsStore().settings.crewScenes = false
        const campaign = useCampaignStore()
        campaign.completeLevel('level_1', 1)
        campaign.completeLevel('level_2', 1)
        const { page } = await mountMap()
        expect(button(page, 'КАЮТ-КОМПАНИЯ')).toBeUndefined()
        expect(page.find('.crew-roster').text()).not.toContain('♥')
    })

    it('plays briefing scenes before the mission and lets the player skip them', async () => {
        const campaign = useCampaignStore()
        for (const id of ['level_1', 'level_2', 'level_3', 'level_4']) campaign.completeLevel(id, 1)
        const { navigation, page } = await mountMap()
        await page
            .findAll('.deck-map__room')
            .find((room) => room.attributes('aria-label')?.startsWith('E-0'))!
            .trigger('click')
        await button(page, 'НАЧАТЬ ЗАЩИТУ')!.trigger('click')
        expect(page.find('.scene-screen__speaker').text()).toBe('Командор Маркус Хейл')
        await button(page, 'ПРОПУСТИТЬ')!.trigger('click')
        await vi.waitFor(() => expect(navigation.currentRoute.value.fullPath).toBe('/game/level_9'))
        expect(campaign.crew.find((member) => member.id === 'hale')!.disposition).toBe(0)
    })
})
