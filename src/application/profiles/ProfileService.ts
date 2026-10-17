import {
    DEFAULT_DIFFICULTY,
    LEVEL_IDS,
    briefingLine,
    isDifficultyId,
    type CampaignProgress,
    type DifficultyId,
} from '@/domain'
import type { LegacySaves, ProfileRecord, ProfileRepository } from '../ports/ProfileRepository'
import type { CommandResult } from '../session/GameSession'
import { CachedStore, SwitchingStore } from './CachedStore'

export const MAX_PROFILES = 3
export const PROFILE_NAME_MAX = 24
const ACTIVE_KEY = 'activeProfile'
// Device-wide keys among legacy saves; everything else belongs to a profile.
const DEVICE_KEYS = ['settings']

export interface ProfileSummary {
    id: string
    name: string
    lastPlayedAt: number
    completedLevels: number
    totalLevels: number
    stars: number
    active: boolean
    difficulty: DifficultyId
    romance: boolean
}

export interface ProfileServiceOptions {
    legacy?: LegacySaves
    createId?: () => string
    now?: () => number
}

// Up to three profiles, each with its own saves. Services read the active profile through
// `storage`; device-wide values (settings) live in `device`.
export class ProfileService {
    readonly storage = new SwitchingStore()
    private activeId: string | null = null
    private readonly createId: () => string
    private readonly now: () => number

    private constructor(
        private readonly repository: ProfileRepository,
        readonly device: CachedStore,
        private profiles: ProfileRecord[],
        private readonly saves: Map<string, CachedStore>,
        private readonly legacy: LegacySaves | undefined,
        options: ProfileServiceOptions,
    ) {
        this.createId = options.createId ?? (() => crypto.randomUUID())
        this.now = options.now ?? (() => Date.now())
    }

    // Loads every profile into memory and activates the last used one.
    static async open(
        repository: ProfileRepository,
        options: ProfileServiceOptions = {},
    ): Promise<ProfileService> {
        const [records, deviceData] = await Promise.all([
            repository.listProfiles(),
            repository.loadDevice(),
        ])
        const device = new CachedStore(deviceData, {
            put: (key, value) => repository.putDevice(key, value),
            remove: (key) => repository.deleteDevice(key),
        })
        const saves = new Map<string, CachedStore>()
        for (const record of records) {
            saves.set(
                record.id,
                ProfileService.cache(repository, record.id, await repository.loadSaves(record.id)),
            )
        }
        const service = new ProfileService(
            repository,
            device,
            [...records].sort((a, b) => a.createdAt - b.createdAt),
            saves,
            options.legacy,
            options,
        )
        service.adoptLegacyDeviceSaves()
        const last = device.read<string>(ACTIVE_KEY)
        const initial = records.some((record) => record.id === last) ? last : records[0]?.id
        if (initial) await service.activate(initial)
        return service
    }

    get active(): ProfileRecord | null {
        return this.profiles.find((profile) => profile.id === this.activeId) ?? null
    }

    get canCreate(): boolean {
        return this.profiles.length < MAX_PROFILES
    }

    // Progress saved before profiles existed is moved into the first new profile.
    get hasLegacySaves(): boolean {
        return this.profiles.length === 0 && Object.keys(this.legacyProfileSaves()).length > 0
    }

    list(): ProfileSummary[] {
        return this.profiles.map((profile) => {
            const campaign = this.saves.get(profile.id)?.read<CampaignProgress>('campaign')
            return {
                id: profile.id,
                name: profile.name,
                lastPlayedAt: profile.lastPlayedAt,
                completedLevels: campaign?.completedLevels.length ?? 0,
                totalLevels: LEVEL_IDS.length,
                stars: campaign?.totalStars ?? 0,
                active: profile.id === this.activeId,
                difficulty: rankOf(profile),
                romance: profile.romance === true,
            }
        })
    }

    // First line of the main-menu report, by the active profile's story progress.
    briefing(): string | null {
        const profile = this.active
        if (!profile) return null
        const campaign = this.storage.read<CampaignProgress>('campaign')
        return briefingLine(profile.name, {
            completedLevels: campaign?.completedLevels ?? [],
            flags: campaign?.flags ?? {},
        })
    }

    // Difficulty of the active profile, fixed when it was registered.
    get difficulty(): DifficultyId {
        return this.active ? rankOf(this.active) : DEFAULT_DIFFICULTY
    }

    // Whether the active officer accepted personal relationships at registration (off by
    // default). It gates romance only; reputation with the crew always works.
    get romance(): boolean {
        return this.active?.romance === true
    }

    async create(
        rawName: string,
        difficulty: DifficultyId = DEFAULT_DIFFICULTY,
        romance = false,
    ): Promise<CommandResult> {
        const name = rawName.trim().replace(/\s+/g, ' ')
        if (!name) return { ok: false, error: 'Введите имя офицера' }
        if (name.length > PROFILE_NAME_MAX)
            return { ok: false, error: `Имя длиннее ${PROFILE_NAME_MAX} символов` }
        if (!this.canCreate)
            return { ok: false, error: `Доступно не более ${MAX_PROFILES} профилей` }
        if (this.profiles.some((profile) => profile.name.toLowerCase() === name.toLowerCase()))
            return { ok: false, error: 'Профиль с таким именем уже есть' }
        if (!isDifficultyId(difficulty)) return { ok: false, error: 'Неизвестное звание' }
        const now = this.now()
        const profile: ProfileRecord = {
            id: this.createId(),
            name,
            createdAt: now,
            lastPlayedAt: now,
            difficulty,
            romance,
        }
        const imported = this.profiles.length === 0 ? this.legacyProfileSaves() : {}
        await this.repository.putProfile(profile)
        const store = ProfileService.cache(this.repository, profile.id, {})
        for (const [key, value] of Object.entries(imported)) store.write(key, value)
        await store.flush()
        if (Object.keys(imported).length) this.legacy?.clear()
        this.saves.set(profile.id, store)
        this.profiles.push(profile)
        await this.activate(profile.id)
        return { ok: true }
    }

    async activate(id: string): Promise<CommandResult> {
        const profile = this.profiles.find((candidate) => candidate.id === id)
        const store = this.saves.get(id)
        if (!profile || !store) return { ok: false, error: 'Профиль не найден' }
        this.activeId = id
        this.storage.use(store)
        profile.lastPlayedAt = this.now()
        this.device.write(ACTIVE_KEY, id)
        await this.repository.putProfile({ ...profile })
        return { ok: true }
    }

    // Re-ranks the active profile. Not offered by the game itself: only the dev console uses it.
    async overrideDifficulty(difficulty: DifficultyId): Promise<CommandResult> {
        const profile = this.active
        if (!profile) return { ok: false, error: 'Нет активного профиля' }
        if (!isDifficultyId(difficulty)) return { ok: false, error: 'Неизвестное звание' }
        profile.difficulty = difficulty
        await this.repository.putProfile({ ...profile })
        return { ok: true }
    }

    // Deletes the profile and its saves. Without an active profile nothing can be played.
    async remove(id: string): Promise<CommandResult> {
        if (!this.profiles.some((profile) => profile.id === id))
            return { ok: false, error: 'Профиль не найден' }
        await this.saves.get(id)?.flush()
        await this.repository.deleteProfile(id)
        this.profiles = this.profiles.filter((profile) => profile.id !== id)
        this.saves.delete(id)
        if (this.activeId === id) {
            this.activeId = null
            this.storage.use(new CachedStore())
            this.device.remove(ACTIVE_KEY)
        }
        return { ok: true }
    }

    // Resolves once all pending writes reached the repository.
    async flush(): Promise<void> {
        await Promise.all([
            this.device.flush(),
            ...[...this.saves.values()].map((store) => store.flush()),
        ])
    }

    private static cache(
        repository: ProfileRepository,
        profileId: string,
        data: Record<string, unknown>,
    ): CachedStore {
        return new CachedStore(data, {
            put: (key, value) => repository.putSave(profileId, key, value),
            remove: (key) => repository.deleteSave(profileId, key),
        })
    }

    private legacyProfileSaves(): Record<string, unknown> {
        const entries = Object.entries(this.legacy?.read() ?? {})
        return Object.fromEntries(entries.filter(([key]) => !DEVICE_KEYS.includes(key)))
    }

    private adoptLegacyDeviceSaves(): void {
        const legacy = this.legacy?.read() ?? {}
        for (const key of DEVICE_KEYS) {
            if (legacy[key] !== undefined && this.device.read(key) === null)
                this.device.write(key, legacy[key])
        }
        // Profile progress waits for the first profile; with profiles present it is stale.
        if (this.profiles.length > 0 || !Object.keys(this.legacyProfileSaves()).length)
            this.legacy?.clear()
    }
}

function rankOf(profile: ProfileRecord): DifficultyId {
    return isDifficultyId(profile.difficulty) ? profile.difficulty : DEFAULT_DIFFICULTY
}
