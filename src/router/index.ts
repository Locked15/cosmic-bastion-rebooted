import { createRouter, createWebHistory } from 'vue-router'
import { useCampaignStore } from '@/stores/campaignStore'
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
            path: '/wardroom',
            name: 'wardroom',
            component: () => import('@/ui/pages/WardroomPage.vue'),
        },
        {
            path: '/quartermaster',
            name: 'quartermaster',
            component: () => import('@/ui/pages/QuartermasterPage.vue'),
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

// Service rooms that open with campaign victories; closed ones send back to the ship map.
const FACILITY_ROUTES = ['wardroom', 'quartermaster']

// Missions belong to a profile: without one the player signs in on the main menu first.
router.beforeEach((to) => {
    if (to.name === 'menu') return true
    if (useProfileStore().required) return { name: 'menu' }
    const room = String(to.name)
    if (FACILITY_ROUTES.includes(room) && !useCampaignStore().isFacilityOpen(room))
        return { name: 'levels' }
    return true
})

export default router
