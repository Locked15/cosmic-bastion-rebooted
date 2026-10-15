// A player profile: one save slot with its own campaign, checkpoints and achievements.
export interface ProfileRecord {
    id: string
    name: string
    createdAt: number
    lastPlayedAt: number
}

// Asynchronous persistence of profiles (IndexedDB in the browser, memory in tests).
export interface ProfileRepository {
    listProfiles(): Promise<ProfileRecord[]>
    putProfile(profile: ProfileRecord): Promise<void>
    // Removes the profile together with all of its saves.
    deleteProfile(id: string): Promise<void>
    loadSaves(profileId: string): Promise<Record<string, unknown>>
    putSave(profileId: string, key: string, value: unknown): Promise<void>
    deleteSave(profileId: string, key: string): Promise<void>
    // Values shared by every profile on this device (settings, the active profile).
    loadDevice(): Promise<Record<string, unknown>>
    putDevice(key: string, value: unknown): Promise<void>
    deleteDevice(key: string): Promise<void>
}

// Saves written before profiles existed; they move into the first profile.
export interface LegacySaves {
    read(): Record<string, unknown>
    clear(): void
}
