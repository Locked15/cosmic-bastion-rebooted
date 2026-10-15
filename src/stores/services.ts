import type {
    FrameScheduler,
    KeyValueStore,
    ProfileService,
    Scene,
    SoundPlayer,
} from '@/application'
import type { Random } from '@/domain'

// Concrete adapters the stores need. Wired once by the composition root (main.ts) or by tests.
export interface AppServices {
    // Saves of the active profile (campaign, checkpoints, achievements).
    storage: KeyValueStore
    // Values shared by all profiles on this device (settings).
    deviceStorage: KeyValueStore
    profiles: ProfileService
    sound: SoundPlayer
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
