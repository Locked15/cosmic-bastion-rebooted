import * as v from 'valibot'
import data from '@/content/campaign.json'
import { count, parseContent, rect, text } from '../content/parse'

export const SHIP_LAYERS = ['outer', 'living', 'core'] as const
export type ShipLayer = (typeof SHIP_LAYERS)[number]

const levelId = v.pipe(v.string(), v.regex(/^level_\d+$/))

const sectorSchema = v.strictObject({
    level: levelId,
    // Deck code shown on the ship map (A-7, B-3…).
    code: text,
    name: text,
    // Ship layer from the brief: outer hull, living layer, technical core.
    layer: v.picklist(SHIP_LAYERS),
    // Sectors whose victory opens this one.
    requires: v.array(levelId),
    // Room outline on the ship map (viewBox units).
    map: rect,
})
export type CampaignSector = v.InferOutput<typeof sectorSchema>

const campaignSchema = v.pipe(
    v.strictObject({
        // Bump when level layouts change: older level checkpoints are then discarded.
        contentVersion: v.pipe(count, v.minValue(1)),
        // The last mission; its result decides the ending.
        finale: levelId,
        sectors: v.pipe(v.array(sectorSchema), v.nonEmpty()),
    }),
    v.check(
        (campaign) =>
            new Set(campaign.sectors.map((sector) => sector.level)).size ===
            campaign.sectors.length,
        'Every level appears once on the map',
    ),
    // Listing prerequisites first keeps the graph acyclic and the mission order meaningful.
    v.check(
        (campaign) =>
            campaign.sectors.every((sector, index) =>
                sector.requires.every((id) =>
                    campaign.sectors.slice(0, index).some((earlier) => earlier.level === id),
                ),
            ),
        'A sector may only require sectors listed before it',
    ),
    v.check(
        (campaign) => campaign.sectors[0]!.requires.length === 0,
        'The first sector must be open from the start',
    ),
    v.check(
        (campaign) => campaign.sectors.some((sector) => sector.level === campaign.finale),
        'The finale must be on the map',
    ),
)
export type CampaignDefinition = v.InferOutput<typeof campaignSchema>

export const CAMPAIGN: CampaignDefinition = parseContent(
    campaignSchema,
    data,
    'content/campaign.json',
)

export const CONTENT_VERSION = CAMPAIGN.contentVersion

// 1-based position of a level in the campaign (story flags remember where things happened).
export function missionIndex(levelId: string): number {
    return CAMPAIGN.sectors.findIndex((sector) => sector.level === levelId) + 1
}

export function campaignSector(levelId: string): CampaignSector | null {
    return CAMPAIGN.sectors.find((sector) => sector.level === levelId) ?? null
}
