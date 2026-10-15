import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ProfileRecord, ProfileRepository } from '@/application/ports/ProfileRepository'

const DB_NAME = 'cosmic-bastion'
const DB_VERSION = 1

interface SaveRecord {
    profileId: string
    key: string
    value: unknown
}

interface CosmicBastionDb extends DBSchema {
    profiles: { key: string; value: ProfileRecord }
    // One row per profile and save key (campaign, achievements, checkpoint:level_N…).
    saves: { key: [string, string]; value: SaveRecord; indexes: { 'by-profile': string } }
    // Device-wide values: settings, the active profile.
    device: { key: string; value: unknown }
}

// Profiles and their saves in IndexedDB.
export class IdbProfileRepository implements ProfileRepository {
    private constructor(private readonly db: IDBPDatabase<CosmicBastionDb>) {}

    static async open(name = DB_NAME): Promise<IdbProfileRepository> {
        const db = await openDB<CosmicBastionDb>(name, DB_VERSION, {
            upgrade(database) {
                database.createObjectStore('profiles', { keyPath: 'id' })
                const saves = database.createObjectStore('saves', {
                    keyPath: ['profileId', 'key'],
                })
                saves.createIndex('by-profile', 'profileId')
                database.createObjectStore('device')
            },
        })
        return new IdbProfileRepository(db)
    }

    listProfiles(): Promise<ProfileRecord[]> {
        return this.db.getAll('profiles')
    }

    async putProfile(profile: ProfileRecord): Promise<void> {
        await this.db.put('profiles', profile)
    }

    async deleteProfile(id: string): Promise<void> {
        const tx = this.db.transaction(['profiles', 'saves'], 'readwrite')
        await tx.objectStore('profiles').delete(id)
        let cursor = await tx.objectStore('saves').index('by-profile').openCursor(id)
        while (cursor) {
            await cursor.delete()
            cursor = await cursor.continue()
        }
        await tx.done
    }

    async loadSaves(profileId: string): Promise<Record<string, unknown>> {
        const rows = await this.db.getAllFromIndex('saves', 'by-profile', profileId)
        return Object.fromEntries(rows.map((row) => [row.key, row.value]))
    }

    async putSave(profileId: string, key: string, value: unknown): Promise<void> {
        await this.db.put('saves', { profileId, key, value })
    }

    async deleteSave(profileId: string, key: string): Promise<void> {
        await this.db.delete('saves', [profileId, key])
    }

    async loadDevice(): Promise<Record<string, unknown>> {
        const tx = this.db.transaction('device')
        const [keys, values] = await Promise.all([tx.store.getAllKeys(), tx.store.getAll()])
        return Object.fromEntries(keys.map((key, index) => [key, values[index]]))
    }

    async putDevice(key: string, value: unknown): Promise<void> {
        await this.db.put('device', value, key)
    }

    async deleteDevice(key: string): Promise<void> {
        await this.db.delete('device', key)
    }

    close(): void {
        this.db.close()
    }
}
