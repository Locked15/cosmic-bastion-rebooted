import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ProfileService } from '@/application'
import { createMathRandom } from '@/domain'
import { renderScene } from '@/infrastructure/canvas'
import { HtmlMusicPlayer } from '@/infrastructure/audio/HtmlMusicPlayer'
import { SynthSoundPlayer } from '@/infrastructure/audio/SynthSoundPlayer'
import { RafScheduler } from '@/infrastructure/clock/RafScheduler'
import { IdbProfileRepository } from '@/infrastructure/storage/IdbProfileRepository'
import { LegacyLocalStorage } from '@/infrastructure/storage/LegacyLocalStorage'
import { provideServices } from '@/stores/services'
import App from './App.vue'
import router from './router'
import '@/styles/main.scss'

// Composition root: the only place that knows the concrete adapters.
async function bootstrap() {
    // Profiles live in IndexedDB; they are loaded into memory before the app starts.
    const profiles = await ProfileService.open(await IdbProfileRepository.open(), {
        legacy: new LegacyLocalStorage(),
    })
    provideServices({
        storage: profiles.storage,
        deviceStorage: profiles.device,
        profiles,
        sound: new SynthSoundPlayer(),
        music: new HtmlMusicPlayer(),
        createScheduler: () => new RafScheduler(),
        createRandom: () => createMathRandom(),
        renderScene,
    })

    const app = createApp(App)
    const pinia = createPinia()
    app.use(pinia)
    app.use(router)
    app.mount('#app')

    if (import.meta.env.DEV) {
        const { installUplink } = await import('./devtools/uplink')
        installUplink(pinia)
    }
}

void bootstrap()
