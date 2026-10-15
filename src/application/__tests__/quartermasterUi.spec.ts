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

async function mountTerminal(balance: number) {
    storage.write('requisitions', { balance, earned: balance, spent: 0, levels: {} })
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', name: 'menu', component: { template: '<main />' } },
            { path: '/quartermaster', name: 'quartermaster', component: QuartermasterPage },
        ],
    })
    await router.push('/quartermaster')
    wrapper = mount(Shell, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return router
}

const rows = () => wrapper!.findAll('.requisition-row')
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
    it('lists every requisition by rank and approves the selected one with the key', async () => {
        await mountTerminal(100)
        expect(rows()).toHaveLength(10)
        expect(wrapper!.text()).toContain('== РАЗРЯД IV — ОСОБЫЙ ==')
        expect(counter()).toBe('РЕКВИЗИЦИИ НА СЧЁТЕ 100')

        await rows()[3]!.trigger('click')
        expect(rows()[3]!.attributes('aria-selected')).toBe('true')
        await key('УТВЕРДИТЬ').trigger('click')
        expect(counter()).toBe('РЕКВИЗИЦИИ НА СЧЁТЕ 55')
        expect(rows()[3]!.text()).toContain('■□□□□')
        expect(wrapper!.text()).toContain('НАРЯД СТ-О-11 «Оптика наведения» УТВЕРЖДЁН · СПИСАНО 45')

        // Rank IV costs more than what is left: the key is disabled for it.
        await rows()[9]!.trigger('click')
        expect(key('УТВЕРДИТЬ').attributes('disabled')).toBeDefined()
    })

    it('moves the cursor with the arrows and approves with Enter', async () => {
        await mountTerminal(100)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
        await flushPromises()
        expect(rows()[1]!.attributes('aria-selected')).toBe('true')
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
        await flushPromises()
        expect(counter()).toBe('РЕКВИЗИЦИИ НА СЧЁТЕ 75')
    })

    it('burns all forms with the lever after confirmation and returns 75%', async () => {
        await mountTerminal(100)
        await key('УТВЕРДИТЬ').trigger('click')
        await key('УТВЕРДИТЬ').trigger('click')
        expect(counter()).toBe('РЕКВИЗИЦИИ НА СЧЁТЕ 45')
        await wrapper!.find('.reset-lever__slot').trigger('click')
        await new Promise((resolve) => setTimeout(resolve, 400))
        await flushPromises()
        expect(wrapper!.text()).toContain('вернёт 41 реквизиций (75% от потраченных 55)')
        await wrapper!
            .findAll('button')
            .find((button) => button.text() === 'ДА')!
            .trigger('click')
        await flushPromises()
        expect(counter()).toBe('РЕКВИЗИЦИИ НА СЧЁТЕ 86')
        expect(rows()[0]!.text()).toContain('□□□□□')
    })
})
