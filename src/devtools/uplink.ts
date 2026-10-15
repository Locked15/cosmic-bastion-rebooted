import type { Pinia } from 'pinia'
import { useGameStore } from '@/stores/gameStore'

declare global {
    interface Window {
        uplink?: (input: string) => string
    }
}

// Dev-only console entry: `uplink('...')` while a mission is running.
export function installUplink(pinia: Pinia): void {
    window.uplink = (input: string) => useGameStore(pinia).enter(String(input))
}
