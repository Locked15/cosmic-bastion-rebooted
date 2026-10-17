import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createSeededRandom } from '@/domain'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { provideTestServices } from './testServices'
import { useCampaignStore } from '@/stores/campaignStore'
import { useGameStore } from '@/stores/gameStore'
import { CampaignService } from '../CampaignService'
import type { FrameScheduler } from '../ports/FrameScheduler'
import { silentSoundPlayer } from '../ports/SoundPlayer'
import StoryDialog from '@/ui/layouts/StoryDialog.vue'
import GameMenu from '@/ui/layouts/GameMenu.vue'
import LevelSelectPage from '@/ui/pages/LevelSelectPage.vue'
import ChoiceButton from '@/ui/components/ChoiceButton.vue'

let storage: MemoryStore
let tick: (frames: number) => void
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
    storage = new MemoryStore()
    setActivePinia(createPinia())
    await provideTestServices({
        storage,
        sound: silentSoundPlayer,
        createRandom: () => createSeededRandom(1),
        renderScene: () => {},
        createScheduler: (): FrameScheduler => ({
            start: (callback) => {
                tick = callback
            },
            stop: () => {},
        }),
    })
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    useGameStore().stop()
    vi.restoreAllMocks()
})

describe('story and campaign UI', () => {
    it('keeps the choice-button flow, shows full hints, switches to consequences, and closes on OK', async () => {
        const game = useGameStore()
        game.start('level_1')
        wrapper = mount(StoryDialog)
        expect(wrapper.text()).toContain('КОМАНДОР МАРКУС ХЕЙЛ')
        expect(wrapper.find('.choice-button__hint').exists()).toBe(false) // Unknown intro.
        await wrapper.find('.choice-button').trigger('click')
        expect(wrapper.find('.story-dialog').exists()).toBe(false)
        game.startWave()
        await wrapper.vm.$nextTick()
        expect(wrapper.text()).toContain('Без затрат')
        expect(wrapper.text()).toContain('Получено 40 ресурсов')
        await wrapper.find('.choice-button').trigger('click')
        expect(wrapper.text()).toContain('ПОСЛЕДСТВИЯ')
        expect(wrapper.find('.choice-button').exists()).toBe(false)
        const button = wrapper.find('button')
        expect(button.text()).toBe('ОК')
        await button.trigger('click')
        expect(wrapper.find('.story-dialog').exists()).toBe(false)
        expect(game.snapshot?.speed).toBe(1)
    })

    it('hides cost and consequence hints for partial and unknown dialogs and blocks disabled choices', async () => {
        const game = useGameStore()
        game.start('level_1')
        wrapper = mount(StoryDialog)
        for (const kind of ['partial', 'unknown'] as const) {
            game.snapshot = {
                ...game.snapshot!,
                dialog: {
                    kind,
                    phase: 'choice',
                    title: 'Скрытое событие',
                    text: 'Выберите',
                    secondsLeft: 7,
                    choices: [{ text: 'Принять', hint: '', disabled: true }],
                },
            }
            await wrapper.vm.$nextTick()
            expect(wrapper.find('.choice-button__hint').exists()).toBe(false)
            expect(wrapper.find('button').attributes('disabled')).toBeDefined()
            expect(wrapper.text()).not.toContain('Стоимость')
            expect(wrapper.text()).toContain(
                kind === 'partial' ? 'после решения' : 'останутся скрыты',
            )
        }
        const choice = mount(ChoiceButton, { props: { text: 'Принять', disabled: true } })
        await choice.find('button').trigger('click')
        expect(choice.emitted('choose')).toBeUndefined()
        choice.unmount()
    })

    it('draws sectors on the deck plan, opens conduits by victories and starts a mission', async () => {
        const campaign = useCampaignStore()
        campaign.completeLevel('level_1', 2)
        const navigation = router()
        await navigation.push('/levels')
        wrapper = mount(LevelSelectPage, { global: { plugins: [navigation] } })
        const rooms = wrapper.findAll('.deck-map__room')
        expect(rooms).toHaveLength(campaign.levels.length)
        const room = (code: string) =>
            rooms.find((candidate) => candidate.attributes('aria-label')?.startsWith(code))!
        expect(room('A-7').classes()).toContain('deck-map__room--completed')
        expect(room('B-3').attributes('aria-disabled')).toBe('false')
        expect(room('H-2').attributes('aria-disabled')).toBe('false')
        expect(room('D-1').attributes('aria-disabled')).toBe('true')
        expect(room('R-0').classes()).toContain('deck-map__room--finale')
        // Conduits from the won hull sector are open; the rest stay dashed.
        // Hull → hangar, bridge, quarters and labs.
        expect(wrapper.findAll('.deck-map__link--open')).toHaveLength(4)
        expect(room('T-0').classes()).toContain('deck-map__room--training')

        // The first open sector not won yet is preselected; locked rooms cannot be chosen.
        expect(room('T-0').attributes('aria-pressed')).toBe('true')
        await room('D-1').trigger('click')
        expect(room('D-1').attributes('aria-pressed')).toBe('false')
        await room('A-7').trigger('keydown', { key: 'Enter' })
        expect(room('A-7').attributes('aria-pressed')).toBe('true')
        const start = wrapper.findAll('button').find((button) => button.text() === 'НАЧАТЬ ЗАЩИТУ')!
        await start.trigger('click')
        await vi.waitFor(() => expect(navigation.currentRoute.value.fullPath).toBe('/game/level_1'))
    })

    it('shows objective marks and unlocked tech after a defeat without opening the ship map', async () => {
        const game = useGameStore()
        game.start('level_1')
        game.snapshot = {
            ...game.snapshot!,
            status: 'defeat',
            dialog: null,
            result: {
                outcome: 'defeat',
                reason: 'Отсек потерян',
                stars: 0,
                stats: [],
                unlocks: ['Ракетница', 'Улучшения II'],
                ending: null,
                requisitions: null,
                advanced: false,
                objectives: [
                    { id: 'save_engineer', text: 'Чен спасён', completed: true, optional: true },
                    { id: 'survive', text: 'Отразить волны', completed: false, optional: false },
                ],
            },
        }
        wrapper = mount(GameMenu, { global: { plugins: [router()] } })
        expect(wrapper.text()).toContain('✓ Чен спасён')
        expect(wrapper.text()).toContain('○ Отразить волны')
        expect(wrapper.text()).toContain('НОВЫЕ ТЕХНОЛОГИИ')
        expect(wrapper.text()).toContain('Ракетница')
        // A defeat never advances the campaign: only retry or leave.
        expect(wrapper.text()).toContain('ПОВТОРИТЬ')
        expect(wrapper.text()).not.toContain('К СХЕМЕ КОРАБЛЯ')
        expect(wrapper.text()).not.toContain('кампания продолжается')
        wrapper.unmount()

        // A-7 lost after Chen's fate was decided: the story goes on through the breach.
        game.snapshot = {
            ...game.snapshot!,
            result: { ...game.snapshot!.result!, advanced: true },
        }
        wrapper = mount(GameMenu, { global: { plugins: [router()] } })
        expect(wrapper.text()).toContain('Сектор потерян, но кампания продолжается')
        expect(wrapper.text()).toContain('К СХЕМЕ КОРАБЛЯ')
    })

    it('passes campaign options and starting resources through gameStore.start', () => {
        const service = new CampaignService(storage)
        service.recordResult('level_1', {
            outcome: 'victory',
            stars: 2,
            flags: { tech_laser: 1, supply_cache: 100 },
            objectives: [],
            survivors: 18,
        })
        const game = useGameStore()
        expect(game.start('level_2')).toBe(true)
        expect(game.snapshot?.resources).toBe(400)
        expect(game.snapshot?.buildOptions.map((option) => option.type)).toEqual(
            expect.arrayContaining(['laser', 'rocket', 'filter']),
        )
        expect(game.snapshot?.buildOptions.map((option) => option.type)).not.toContain('shield')
    })

    it('reports results once, carries flags into a new store session and attaches newly unlocked tech', async () => {
        const captured: { current?: import('../session/GameSession').GameSession } = {}
        await provideTestServices({
            storage,
            sound: silentSoundPlayer,
            createRandom: () => createSeededRandom(1),
            createScheduler: () => ({
                start: (callback) => {
                    tick = callback
                },
                stop: () => {},
            }),
            renderScene: (_ctx, scene) => {
                captured.current = scene as import('../session/GameSession').GameSession
            },
        })
        const current = useGameStore()
        current.start('level_1')
        current.draw({} as CanvasRenderingContext2D, 1200, 700)
        const session = captured.current!
        session.story.flags.engineer_saved = 1
        session.story.flags.tech_laser = 1
        session.stats.reached = 10
        tick(1)
        expect(current.snapshot?.result).toMatchObject({
            outcome: 'defeat',
        })
        expect(current.snapshot?.result?.unlocks).toContain('Лазерная установка')
        const first = current.snapshot?.result?.unlocks
        tick(1)
        expect(current.snapshot?.result?.unlocks).toEqual(first)
        // The defeat keeps story flags (laser) but does not unlock the next sectors.
        expect(new CampaignService(storage).isUnlocked('level_3')).toBe(false)
        expect(current.start('level_3')).toBe(false)
        current.start('level_1')
        expect(current.snapshot?.buildOptions.map((option) => option.type)).toContain('laser')
    })
})
