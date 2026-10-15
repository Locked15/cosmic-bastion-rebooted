import { defineStore } from 'pinia'
import { ref } from 'vue'
import { AchievementService, type AchievementView, type GameSession } from '@/application'
import { useServices } from './services'
import { useUiStore } from './uiStore'

export const useAchievementsStore = defineStore('achievements', () => {
    const { storage, sound } = useServices()
    const ui = useUiStore()
    let service = new AchievementService(storage)
    const achievements = ref<AchievementView[]>(service.list())

    // Check the running level and announce anything newly earned.
    function check(session: GameSession) {
        const earned = service.check({
            killed: session.stats.killed,
            activeTowers: session.slots.filter((slot) => slot.tower?.active).length,
            military: session.military,
            gathered: session.stats.gathered,
            personnelLost: session.stats.lost,
            victory: session.status === 'victory',
        })
        if (earned.length === 0) return
        for (const title of earned) ui.notify(`🏆 ДОСТИЖЕНИЕ: ${title}`)
        sound.play('achievement')
        achievements.value = service.list()
    }

    // Re-read after the active profile changed.
    function reload() {
        service = new AchievementService(storage)
        achievements.value = service.list()
    }

    return { achievements, check, reload }
})
