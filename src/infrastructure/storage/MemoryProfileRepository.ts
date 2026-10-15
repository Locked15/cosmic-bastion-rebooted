import type { ProfileRecord, ProfileRepository } from '@/application/ports/ProfileRepository'

const clone = <T>(value: T): T => structuredClone(value)

// In-memory profiles for tests.
export class MemoryProfileRepository implements ProfileRepository {
    readonly profiles = new Map<string, ProfileRecord>()
    readonly saves = new Map<string, Map<string, unknown>>()
    readonly device = new Map<string, unknown>()

    async listProfiles(): Promise<ProfileRecord[]> {
        return [...this.profiles.values()].map(clone)
    }

    async putProfile(profile: ProfileRecord): Promise<void> {
        this.profiles.set(profile.id, clone(profile))
    }

    async deleteProfile(id: string): Promise<void> {
        this.profiles.delete(id)
        this.saves.delete(id)
    }

    async loadSaves(profileId: string): Promise<Record<string, unknown>> {
        return Object.fromEntries(
            [...(this.saves.get(profileId) ?? [])].map(([k, v]) => [k, clone(v)]),
        )
    }

    async putSave(profileId: string, key: string, value: unknown): Promise<void> {
        const saves = this.saves.get(profileId) ?? new Map<string, unknown>()
        saves.set(key, clone(value))
        this.saves.set(profileId, saves)
    }

    async deleteSave(profileId: string, key: string): Promise<void> {
        this.saves.get(profileId)?.delete(key)
    }

    async loadDevice(): Promise<Record<string, unknown>> {
        return Object.fromEntries([...this.device].map(([k, v]) => [k, clone(v)]))
    }

    async putDevice(key: string, value: unknown): Promise<void> {
        this.device.set(key, clone(value))
    }

    async deleteDevice(key: string): Promise<void> {
        this.device.delete(key)
    }
}
