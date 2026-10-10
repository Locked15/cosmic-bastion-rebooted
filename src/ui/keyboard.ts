import { onBeforeUnmount, onMounted } from 'vue'

// Calls handler for keys pressed outside of text inputs. Returns true from handler to prevent default.
export function onKeyStroke(handler: (key: string) => boolean | void) {
    function listener(event: KeyboardEvent) {
        const target = event.target as HTMLElement | null
        if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
        if (handler(event.key)) event.preventDefault()
    }

    onMounted(() => document.addEventListener('keydown', listener))
    onBeforeUnmount(() => document.removeEventListener('keydown', listener))
}
