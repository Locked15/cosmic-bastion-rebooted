import { createSeededRandom } from '@/domain'
import { MemoryProfileRepository } from '@/infrastructure/storage/MemoryProfileRepository'
import { MemoryStore } from '@/infrastructure/storage/MemoryStore'
import { provideServices, type AppServices } from '@/stores/services'
import { ProfileService } from '../profiles/ProfileService'
import { silentSoundPlayer } from '../ports/SoundPlayer'

// App services for store and UI tests: memory storage, silent sound, a seeded random.
export async function provideTestServices(
    overrides: Partial<AppServices> = {},
): Promise<AppServices> {
    const services: AppServices = {
        storage: new MemoryStore(),
        deviceStorage: new MemoryStore(),
        profiles: await ProfileService.open(new MemoryProfileRepository()),
        sound: silentSoundPlayer,
        createRandom: () => createSeededRandom(1),
        createScheduler: () => ({ start() {}, stop() {} }),
        renderScene: () => {},
        ...overrides,
    }
    provideServices(services)
    return services
}
