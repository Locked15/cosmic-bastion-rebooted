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
    const { storage, sound, profiles } = useServices()
    const ui = useUiStore()
    // Special favours depend on the officer's rank.
    const create = () => new RequisitionService(storage, { difficulty: () => profiles.difficulty })
    let service = create()
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

    // An account from before the four trees was converted: say so on the terminal.
    function announceMigration() {
        if (service.migrationRefund)
            print('НАРЯДЫ ПЕРЕСМОТРЕНЫ ПО НОВОМУ УСТАВУ · ВОЗВРАЩЕНО', service.migrationRefund)
    }
    announceMigration()

    // Re-read after the active profile changed.
    function reload() {
        service = create()
        log.value = []
        flashId.value = null
        announceMigration()
        refresh()
    }

    function bonuses() {
        return service.bonuses
    }

    function buy(id: string): boolean {
        const upgrade = view.value.trees
            .flatMap((tree) => tree.tiers.flatMap((tier) => tier.upgrades))
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

    function award(
        levelId: string,
        result: { outcome: 'victory' | 'defeat'; stars: number; wavesHeld: number },
        multiplier = 1,
    ): number {
        const amount = service.award(levelId, result, multiplier)
        refresh()
        return amount
    }

    return { view, log, flashId, refresh, reload, bonuses, buy, reset, award }
})
