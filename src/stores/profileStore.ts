import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { MAX_PROFILES, PROFILE_NAME_MAX, type ProfileSummary } from '@/application'
import { useAchievementsStore } from './achievementsStore'
import { useCampaignStore } from './campaignStore'
import { useRequisitionStore } from './requisitionStore'
import { useGameStore } from './gameStore'
import { useServices } from './services'
import { useUiStore } from './uiStore'

export interface ProfileSlotView extends ProfileSummary {
    progress: string
    lastPlayed: string
}

// Profiles (save slots) and the security dialog that manages them.
export const useProfileStore = defineStore('profiles', () => {
    const { profiles: service } = useServices()
    const ui = useUiStore()
    const profiles = ref<ProfileSlotView[]>([])
    const briefing = ref<string | null>(null)
    const activeName = ref<string | null>(null)
    const canCreate = ref(false)
    const hasLegacySaves = ref(false)
    const busy = ref(false)
    const dialogOpen = ref(false)

    // Without an active profile the dialog cannot be dismissed: someone has to sign in.
    const required = computed(() => activeName.value === null)

    function refresh() {
        profiles.value = service.list().map((profile) => ({
            ...profile,
            progress: `Секторов: ${profile.completedLevels}/${profile.totalLevels} · ★ ${profile.stars}`,
            lastPlayed: new Date(profile.lastPlayedAt).toLocaleDateString('ru-RU'),
        }))
        briefing.value = service.briefing()
        activeName.value = service.active?.name ?? null
        canCreate.value = service.canCreate
        hasLegacySaves.value = service.hasLegacySaves
        if (required.value) dialogOpen.value = true
    }
    refresh()

    // Other stores read the profile's saves; they reload after a switch.
    function switched() {
        useGameStore().stop()
        useCampaignStore().reload()
        useAchievementsStore().reload()
        useRequisitionStore().reload()
        refresh()
    }

    async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
        if (busy.value) return false
        busy.value = true
        try {
            const result = await action()
            if (!result.ok) ui.notify(result.error ?? 'Ошибка')
            return result.ok
        } finally {
            busy.value = false
        }
    }

    async function create(name: string): Promise<boolean> {
        const created = await run(() => service.create(name))
        if (created) {
            switched()
            dialogOpen.value = false
            ui.notify(`Офицер ${activeName.value} зарегистрирован`)
        }
        return created
    }

    async function select(id: string) {
        if (await run(() => service.activate(id))) {
            switched()
            dialogOpen.value = false
        }
    }

    async function remove(id: string) {
        const profile = profiles.value.find((candidate) => candidate.id === id)
        if (!profile) return
        const confirmed = await ui.confirm(
            `Удалить личное дело «${profile.name}»? Весь прогресс будет потерян навсегда.`,
        )
        if (confirmed && (await run(() => service.remove(id)))) {
            switched()
            ui.notify(`Личное дело «${profile.name}» уничтожено`)
        }
    }

    function open() {
        refresh()
        dialogOpen.value = true
    }

    function close() {
        if (!required.value) dialogOpen.value = false
    }

    return {
        profiles,
        briefing,
        activeName,
        canCreate,
        hasLegacySaves,
        busy,
        dialogOpen,
        required,
        maxProfiles: MAX_PROFILES,
        nameMaxLength: PROFILE_NAME_MAX,
        refresh,
        create,
        select,
        remove,
        open,
        close,
    }
})
