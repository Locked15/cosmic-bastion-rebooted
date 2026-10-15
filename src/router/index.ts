import { createRouter, createWebHistory } from 'vue-router'
import { useProfileStore } from '@/stores/profileStore'
import MainMenuPage from '@/ui/pages/MainMenuPage.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        { path: '/', name: 'menu', component: MainMenuPage },
        {
            path: '/levels',
            name: 'levels',
            component: () => import('@/ui/pages/LevelSelectPage.vue'),
        },
        {
            path: '/game/:levelId',
            name: 'game',
            component: () => import('@/ui/pages/GamePage.vue'),
            props: true,
        },
        { path: '/:pathMatch(.*)*', redirect: { name: 'menu' } },
    ],
})

// Missions belong to a profile: without one the player signs in on the main menu first.
router.beforeEach((to) =>
    to.name === 'menu' || !useProfileStore().required ? true : { name: 'menu' },
)

export default router
