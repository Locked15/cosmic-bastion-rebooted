import { parseContent } from '../content/parse'
import { Level } from '../model/Level'
import { CAMPAIGN } from '../story/campaign'
import { levelSchema, type LevelDefinition } from './schema'

// Every file in content/levels is bundled and validated at startup.
const files = import.meta.glob<unknown>('@/content/levels/*.json', {
    eager: true,
    import: 'default',
})

const definitions = new Map<string, LevelDefinition>()
for (const [path, data] of Object.entries(files)) {
    const definition = parseContent(levelSchema, data, path)
    const fileId = path
        .split('/')
        .pop()!
        .replace(/\.json$/, '')
    if (definition.id !== fileId) throw new Error(`${path}: id must match the file name`)
    definitions.set(definition.id, definition)
}

// Levels in campaign order.
export const LEVEL_IDS: readonly string[] = CAMPAIGN.sectors.map((sector) => sector.level)
for (const id of LEVEL_IDS) {
    if (!definitions.has(id)) throw new Error(`content/campaign.json: no level file for ${id}`)
}

export function levelDefinition(id: string): LevelDefinition | null {
    return definitions.get(id) ?? null
}

export function createLevel(id: string): Level | null {
    const definition = definitions.get(id)
    return definition ? Level.fromDefinition(definition) : null
}
