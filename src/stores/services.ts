import type { FrameScheduler, KeyValueStore, Scene } from '@/application'
import type { Random } from '@/domain'

// Concrete adapters the stores need. Wired once by the composition root (main.ts) or by tests.
export interface AppServices {
    storage: KeyValueStore
    createScheduler: () => FrameScheduler
    createRandom: () => Random
    renderScene: (
        ctx: CanvasRenderingContext2D,
        scene: Scene,
        width: number,
        height: number,
    ) => void
}

let services: AppServices | null = null

export function provideServices(value: AppServices): void {
    services = value
}

export function useServices(): AppServices {
    if (!services) throw new Error('App services are not configured: call provideServices() first')
    return services
}
