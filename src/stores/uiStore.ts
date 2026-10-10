import { defineStore } from 'pinia'
import { ref } from 'vue'

interface Toast {
    id: number
    text: string
}

interface ConfirmRequest {
    message: string
    resolve: (answer: boolean) => void
}

const TOAST_MS = 2300

// Transient UI state: toasts, confirmation prompt, open modals.
export const useUiStore = defineStore('ui', () => {
    const toasts = ref<Toast[]>([])
    const confirmRequest = ref<ConfirmRequest | null>(null)
    const settingsOpen = ref(false)
    const helpOpen = ref(false)
    const achievementsOpen = ref(false)
    let nextToastId = 1

    function notify(text: string) {
        const id = nextToastId++
        toasts.value.push({ id, text })
        setTimeout(() => {
            toasts.value = toasts.value.filter((toast) => toast.id !== id)
        }, TOAST_MS)
    }

    function confirm(message: string): Promise<boolean> {
        confirmRequest.value?.resolve(false)
        return new Promise((resolve) => {
            confirmRequest.value = { message, resolve }
        })
    }

    function resolveConfirm(answer: boolean) {
        confirmRequest.value?.resolve(answer)
        confirmRequest.value = null
    }

    function openSettings() {
        settingsOpen.value = true
    }

    function closeSettings() {
        settingsOpen.value = false
    }

    return {
        toasts,
        confirmRequest,
        settingsOpen,
        helpOpen,
        achievementsOpen,
        notify,
        confirm,
        resolveConfirm,
        openSettings,
        closeSettings,
    }
})
