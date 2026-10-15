import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { RequisitionService, type RequisitionView } from '@/application'
import { useServices } from './services'
import { useUiStore } from './uiStore'

const LOG_LINES = 5

// A terminal line; `amount` is printed after the text with the requisition seal.
export interface TerminalLine {
    text: string
    amount?: number
}

// The profile's requisitions and the quartermaster's terminal that spends them.
export const useRequisitionStore = defineStore('requisitions', () => {
    const { storage, sound } = useServices()
    const ui = useUiStore()
    let service = new RequisitionService(storage)
    const view = shallowRef<RequisitionView>(service.view())
    // Terminal output, newest last.
    const log = ref<TerminalLine[]>([])
    // The record approved last blinks on the screen.
    const flashId = ref<string | null>(null)

    function refresh() {
        view.value = service.view()
    }

    function print(text: string, amount?: number) {
        log.value = [...log.value, { text, amount }].slice(-LOG_LINES)
    }

    // Re-read after the active profile changed.
    function reload() {
        service = new RequisitionService(storage)
        log.value = []
        flashId.value = null
        refresh()
    }

    function bonuses() {
        return service.bonuses
    }

    function buy(id: string): boolean {
        const upgrade = view.value.tiers
            .flatMap((tier) => tier.upgrades)
            .find((item) => item.id === id)
        const result = service.buy(id)
        if (!result.ok) {
            print(`ОТКАЗ: ${result.error.toUpperCase()}`)
            sound.play('breach')
            return false
        }
        print(`НАРЯД ${upgrade?.form} «${upgrade?.name}» УТВЕРЖДЁН · СПИСАНО`, upgrade?.cost ?? 0)
        sound.play('build')
        flashId.value = null
        flashId.value = id
        refresh()
        return true
    }

    async function reset() {
        const { refund, refundPercent, spent } = view.value
        if (!spent) {
            print('ПЕЧЬ ПУСТА: УТВЕРЖДЁННЫХ НАРЯДОВ НЕТ')
            return
        }
        const confirmed = await ui.confirm(
            `Сжечь все наряды? Интендантство вернёт ${refund} реквизиций (${refundPercent}% от потраченных ${spent}).`,
        )
        if (!confirmed) return
        const returned = service.reset()
        flashId.value = null
        refresh()
        print('НАРЯДЫ СОЖЖЕНЫ · ВОЗВРАЩЕНО', returned)
        sound.play('waveClear')
    }

    function award(outcome: 'victory' | 'defeat', stars: number, firstVictory: boolean): number {
        const amount = service.award(outcome, stars, firstVictory)
        refresh()
        return amount
    }

    return { view, log, flashId, refresh, reload, bonuses, buy, reset, award }
})
