import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { provideTestServices } from './testServices'
import ConfirmModal from '@/ui/layouts/ConfirmModal.vue'
import QuartermasterPage from '@/ui/pages/QuartermasterPage.vue'

let wrapper: VueWrapper | null = null
let storage: MemoryStore

const Shell = defineComponent(() => () => [h(QuartermasterPage), h(ConfirmModal)])

async function mountTerminal(balance: number, levels: Record<string, number> = {}) {
    storage.write('requisitions', {
        version: 2,
        balance,
        earned: balance,
        spent: 0,
        levels,
        missions: {},
    })
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', name: 'menu', component: { template: '<main />' } },
            { path: '/levels', name: 'levels', component: { template: '<main />' } },
            { path: '/quartermaster', name: 'quartermaster', component: QuartermasterPage },
        ],
    })
    await router.push('/quartermaster')
    wrapper = mount(Shell, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return router
}

const rows = () => wrapper!.findAll('.requisition-node')
const tabs = () => wrapper!.findAll('.quartermaster__tab')
const press = async (key: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
    await flushPromises()
}
const key = (label: string) =>
    wrapper!.findAll('.keycap').find((candidate) => candidate.text().startsWith(label))!
const counter = () => wrapper!.find('.mechanical-counter').attributes('aria-label')

beforeEach(async () => {
    setActivePinia(createPinia())
    storage = new MemoryStore()
    await provideTestServices({ storage })
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
})

describe('quartermaster terminal', () => {
    it('shows four trees as tabs and five tiers split by dotted rules', async () => {
        await mountTerminal(100)
        expect(tabs().map((tab) => tab.text())).toEqual([
            '[1] МАШИНЕРИЯ',
            '[2] ЭКИПАЖ',
            '[3] НАУКА ▒',
            '[4] ОСОБЫЕ ▒',
        ])
        expect(tabs()[0]!.attributes('aria-selected')).toBe('true')
        expect(wrapper!.findAll('.quartermaster__tier')).toHaveLength(5)
        expect(wrapper!.findAll('hr.quartermaster__rule')).toHaveLength(4)
        expect(wrapper!.text()).toContain('РАЗРЯД V')
        expect(wrapper!.text()).toContain('С 4 НАРЯДОВ')
        expect(counter()).toBe('РЕКВИЗИЦИИ НА СЧЁТЕ 100')

        await tabs()[2]!.trigger('click')
        expect(wrapper!.text()).toContain('ОТКРОЕТСЯ ПОСЛЕ ПОБЕДЫ В СЕКТОРЕ C-9')
        await press('4')
        expect(wrapper!.text()).toContain('ДОПУСК ТОЛЬКО ДЛЯ МАЙОРОВ И ГЕНЕРАЛОВ')
        await press('ArrowRight')
        expect(tabs()[0]!.attributes('aria-selected')).toBe('true')
    })

    it('approves the selected form with the key and keeps closed tiers shut', async () => {
        await mountTerminal(100)
        await rows()[1]!.trigger('click')
        expect(rows()[1]!.attributes('aria-selected')).toBe('true')
        await key('УТВЕРДИТЬ').trigger('click')
        expect(counter()).toBe('РЕКВИЗИЦИИ НА СЧЁТЕ 85')
        expect(rows()[1]!.text()).toContain('■□□□□')
        expect(wrapper!.text()).toContain('НАРЯД СТ-М-07 «Оптика наведения» УТВЕРЖДЁН · СПИСАНО 15')

        // Tier II needs four purchases first.
        await rows()[2]!.trigger('click')
        expect(rows()[2]!.classes()).toContain('requisition-node--blocked')
        expect(wrapper!.text()).toContain('РАЗРЯД II ОТКРОЕТСЯ ПОСЛЕ 4 НАРЯДОВ')
        expect(key('УТВЕРДИТЬ').attributes('disabled')).toBeDefined()
    })

    it('moves the cursor with the arrows and approves with Enter', async () => {
        await mountTerminal(100)
        await press('ArrowDown')
        expect(rows()[1]!.attributes('aria-selected')).toBe('true')
        await press('Enter')
        expect(counter()).toBe('РЕКВИЗИЦИИ НА СЧЁТЕ 85')
        await press('ArrowLeft')
        expect(tabs()[3]!.attributes('aria-selected')).toBe('true')
    })

    it('opens tier II after four purchases in any tree', async () => {
        await mountTerminal(1_000, { tower_damage: 2, mining: 2 })
        expect(wrapper!.text()).toContain('НАРЯДОВ УТВЕРЖДЕНО: 4')
        await rows()[2]!.trigger('click')
        expect(rows()[2]!.classes()).not.toContain('requisition-node--blocked')
        await key('УТВЕРДИТЬ').trigger('click')
        expect(rows()[2]!.text()).toContain('■')
    })

    it('burns all forms with the lever after confirmation and returns 75%', async () => {
        await mountTerminal(100)
        await key('УТВЕРДИТЬ').trigger('click')
        await key('УТВЕРДИТЬ').trigger('click')
        expect(counter()).toBe('РЕКВИЗИЦИИ НА СЧЁТЕ 65')
        await wrapper!.find('.reset-lever__slot').trigger('click')
        await new Promise((resolve) => setTimeout(resolve, 400))
        await flushPromises()
        expect(wrapper!.text()).toContain('вернёт 26 реквизиций (75% от потраченных 35)')
        await wrapper!
            .findAll('button')
            .find((button) => button.text() === 'ДА')!
            .trigger('click')
        await flushPromises()
        expect(counter()).toBe('РЕКВИЗИЦИИ НА СЧЁТЕ 91')
        expect(rows()[0]!.text()).toContain('□□□□□')
    })

    it('leaves for the ship map with Esc', async () => {
        const router = await mountTerminal(0)
        await press('Escape')
        expect(router.currentRoute.value.name).toBe('levels')
    })
})
