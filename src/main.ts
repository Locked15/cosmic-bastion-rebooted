import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createMathRandom } from '@/domain'
import { renderScene } from '@/infrastructure/canvas'
import { SynthSoundPlayer } from '@/infrastructure/audio/SynthSoundPlayer'
import { RafScheduler } from '@/infrastructure/clock/RafScheduler'
import { LocalStorageStore } from '@/infrastructure/storage/LocalStorageStore'
import { provideServices } from '@/stores/services'
import App from './App.vue'
import router from './router'
import '@/styles/main.scss'

// Composition root: the only place that knows the concrete adapters.
provideServices({
    storage: new LocalStorageStore(),
    sound: new SynthSoundPlayer(),
    createScheduler: () => new RafScheduler(),
    createRandom: () => createMathRandom(),
    renderScene,
})

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
