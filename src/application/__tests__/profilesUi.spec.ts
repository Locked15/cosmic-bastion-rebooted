import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'
import { MemoryProfileRepository } from '@/infrastructure/storage/MemoryProfileRepository'
import { useCampaignStore } from '@/stores/campaignStore'
import { ProfileService } from '../profiles/ProfileService'
import { provideTestServices } from './testServices'
import ConfirmModal from '@/ui/layouts/ConfirmModal.vue'
import ProfilesModal from '@/ui/layouts/ProfilesModal.vue'
import MainMenuPage from '@/ui/pages/MainMenuPage.vue'

let wrapper: VueWrapper | null = null
let profiles: ProfileService

const Shell = defineComponent(() => () => [h(MainMenuPage), h(ProfilesModal), h(ConfirmModal)])

async function mountMenu() {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', name: 'menu', component: { template: '<main />' } },
            { path: '/levels', name: 'levels', component: { template: '<main />' } },
        ],
    })
    await router.push('/')
    wrapper = mount(Shell, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return wrapper
}

async function register(name: string) {
    await wrapper!.find('#profile-name').setValue(name)
    await wrapper!.find('.profiles-modal__form').trigger('submit')
    await flushPromises()
}

const button = (text: string) =>
    wrapper!.findAll('button').find((candidate) => candidate.text() === text)!

beforeEach(async () => {
    setActivePinia(createPinia())
    profiles = await ProfileService.open(new MemoryProfileRepository())
    await provideTestServices({
        profiles,
        storage: profiles.storage,
        deviceStorage: profiles.device,
    })
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
})

describe('profiles on the main menu', () => {
    it('asks for a profile on first launch and cannot be dismissed until one exists', async () => {
        await mountMenu()
        expect(wrapper!.find('.profiles-modal').exists()).toBe(true)
        expect(wrapper!.text()).toContain('РЕГИСТРАЦИЯ ОФИЦЕРА')
        expect(wrapper!.find('.main-menu__report').exists()).toBe(false)
        await wrapper!.find('.profiles-modal').trigger('click')
        expect(wrapper!.find('.profiles-modal').exists()).toBe(true)

        await register('Ирена Восс')
        expect(wrapper!.find('.profiles-modal').exists()).toBe(false)
        expect(wrapper!.find('.main-menu__briefing').text()).toBe('Экстренный рапорт, Ирена Восс.')
        expect(wrapper!.find('.main-menu__identity').text().replace(/\s+/g, ' ')).toBe(
            'Если это не Вы, вызовите службу безопасности.',
        )
        expect(wrapper!.text()).not.toContain('НАЧАТЬ ЗАНОВО')
    })

    it('registers the officer with the chosen rank and shows it on the file', async () => {
        await mountMenu()
        expect(wrapper!.text()).toContain('Назовите звание и представьтесь.')
        const cards = wrapper!.findAll('.rank-card')
        expect(cards.map((card) => card.find('.rank-card__label').text())).toEqual([
            'Младший лейтенант',
            'Лейтенант',
            'Майор',
            'Генерал',
        ])
        expect(cards[1]!.attributes('aria-checked')).toBe('true')
        await cards[3]!.trigger('click')
        expect(cards[3]!.attributes('aria-checked')).toBe('true')

        await register('Хейл')
        expect(profiles.difficulty).toBe('xhard')
        await wrapper!.find('.main-menu__identity button').trigger('click')
        expect(wrapper!.find('.profile-slot__rank').text()).toBe('Генерал')
    })

    it('asks about personal relationships at registration, declining by default', async () => {
        await mountMenu()
        expect(wrapper!.text()).toContain('ВЫ ПРИЕМЛЕТЕ ЛИЧНЫЕ ОТНОШЕНИЯ НА СЛУЖБЕ?')
        const select = wrapper!.find<HTMLSelectElement>('#profile-romance')
        expect(select.element.value).toBe('no')
        await register('Кирх')
        expect(profiles.romance).toBe(false)
        expect(profiles.list()[0]!.romance).toBe(false)

        await wrapper!.find('.main-menu__identity button').trigger('click')
        await button('НОВЫЙ ПРОФИЛЬ').trigger('click')
        await wrapper!.find('#profile-romance').setValue('yes')
        await register('Хейл')
        expect(profiles.romance).toBe(true)
        expect(profiles.list().map((profile) => profile.romance)).toEqual([false, true])
    })

    it('gates romance by the profile, never reputation', async () => {
        await profiles.create('Без романов')
        const campaign = useCampaignStore()
        const kirch = () => campaign.crew.find((member) => member.id === 'kirch')!
        expect(kirch().affection).toBeNull()
        await profiles.create('С романами', undefined, true)
        campaign.reload()
        expect(kirch().affection).toBe(0)
        expect(kirch().standing).toBeTruthy()
    })

    it('switches profiles through the security link and reloads their progress', async () => {
        await profiles.create('Альфа')
        profiles.storage.write('campaign', {
            flags: {},
            completedLevels: ['level_1'],
            totalStars: 3,
            currentLevelIndex: 0,
            levels: [{ id: 'level_1', completed: true, stars: 3, locked: false }],
        })
        await profiles.create('Бета')
        await mountMenu()
        expect(wrapper!.find('.main-menu__briefing').text()).toBe('Экстренный рапорт, Бета.')
        expect(useCampaignStore().hasProgress).toBe(false)

        await wrapper!.find('.main-menu__security').trigger('click')
        const slots = wrapper!.findAll('.profile-slot')
        expect(slots).toHaveLength(3)
        expect(slots[0]!.text()).toContain('Секторов: 1/16 · ★ 3')
        expect(slots[2]!.text()).toContain('Ячейка свободна')
        await slots[0]!.findAll('button')[0]!.trigger('click')
        await flushPromises()

        expect(wrapper!.find('.profiles-modal').exists()).toBe(false)
        expect(wrapper!.find('.main-menu__briefing').text()).toBe(
            'Сводка с внешнего корпуса, Альфа.',
        )
        expect(useCampaignStore().hasProgress).toBe(true)
        expect(button('ПРОДОЛЖИТЬ').exists()).toBe(true)
    })

    it('deletes the active profile after confirmation and requires another one', async () => {
        await profiles.create('Альфа')
        await profiles.create('Бета')
        await mountMenu()
        await wrapper!.find('.main-menu__security').trigger('click')
        const active = wrapper!.find('.profile-slot--active')
        await active.find('.profile-slot__remove').trigger('click')
        expect(wrapper!.text()).toContain('Удалить личное дело «Бета»?')
        await button('ДА').trigger('click')
        await flushPromises()

        expect(profiles.list().map((profile) => profile.name)).toEqual(['Альфа'])
        expect(wrapper!.find('.main-menu__report').exists()).toBe(false)
        expect(wrapper!.text()).toContain('Личность не подтверждена')
        expect(button('ЗАКРЫТЬ')).toBeUndefined()
        await wrapper!.find('.profile-slot').findAll('button')[0]!.trigger('click')
        await flushPromises()
        expect(wrapper!.find('.main-menu__briefing').text()).toContain('Альфа')
    })
})
