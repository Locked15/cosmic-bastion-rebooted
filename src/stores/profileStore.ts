import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
    MAX_PROFILES,
    PROFILE_NAME_MAX,
    rankView,
    type ProfileSummary,
    type RankView,
} from '@/application'
import { DEFAULT_DIFFICULTY, DIFFICULTY_IDS, type DifficultyId } from '@/domain'
import { useAchievementsStore } from './achievementsStore'
import { useCampaignStore } from './campaignStore'
import { useRequisitionStore } from './requisitionStore'
import { useGameStore } from './gameStore'
import { useServices } from './services'
import { useUiStore } from './uiStore'

export interface ProfileSlotView extends ProfileSummary {
    progress: string
    lastPlayed: string
    rank: string
}

// Profiles (save slots) and the security dialog that manages them.
export const useProfileStore = defineStore('profiles', () => {
    const { profiles: service } = useServices()
    const ui = useUiStore()
    const profiles = ref<ProfileSlotView[]>([])
    const briefing = ref<string | null>(null)
    const activeName = ref<string | null>(null)
    const activeRank = ref<RankView>(rankView(DEFAULT_DIFFICULTY))
    // Ranks offered at registration, from the most forgiving to the hardest.
    const ranks: RankView[] = DIFFICULTY_IDS.map(rankView)
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
            rank: rankView(profile.difficulty).label,
        }))
        briefing.value = service.briefing()
        activeName.value = service.active?.name ?? null
        activeRank.value = rankView(service.difficulty)
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

    async function create(
        name: string,
        difficulty: DifficultyId = DEFAULT_DIFFICULTY,
        romance = false,
    ): Promise<boolean> {
        const created = await run(() => service.create(name, difficulty, romance))
        if (created) {
            switched()
            dialogOpen.value = false
            ui.notify(`${activeRank.value.label} ${activeName.value} зарегистрирован`)
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

    // Dev console only: the game never lets a profile change its rank.
    async function overrideRank(difficulty: DifficultyId): Promise<boolean> {
        const done = await run(() => service.overrideDifficulty(difficulty))
        if (done) {
            useCampaignStore().reload()
            refresh()
        }
        return done
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
        activeRank,
        ranks,
        defaultRank: DEFAULT_DIFFICULTY,
        canCreate,
        hasLegacySaves,
        busy,
        dialogOpen,
        required,
        maxProfiles: MAX_PROFILES,
        nameMaxLength: PROFILE_NAME_MAX,
        refresh,
        create,
        overrideRank,
        select,
        remove,
        open,
        close,
    }
})
