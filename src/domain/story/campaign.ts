import * as v from 'valibot'
import data from '@/content/campaign.json'
import { count, parseContent, rect, text } from '../content/parse'

// `training` is the Guard simulator: on the map, but not part of the ship's story.
export const SHIP_LAYERS = ['outer', 'living', 'core', 'training'] as const
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
    // Room outline on the ship deck plan (viewBox units, see ui/components/ShipDeckMap.vue).
    map: rect,
    // Conduit drawn from each required sector to this one: [x, y] points; a straight line
    // between room centres when omitted.
    routes: v.optional(
        v.record(levelId, v.pipe(v.array(v.tuple([v.number(), v.number()])), v.minLength(2))),
        {},
    ),
})
export type CampaignSector = v.InferOutput<typeof sectorSchema>

// Service rooms on the ship map: not missions, but places the officer can visit between them.
export const FACILITY_IDS = ['wardroom', 'quartermaster'] as const
export type FacilityId = (typeof FACILITY_IDS)[number]

const facilitySchema = v.strictObject({
    id: v.picklist(FACILITY_IDS),
    code: text,
    name: text,
    // Sectors whose victory opens the room (the wardroom after the living quarters…).
    requires: v.array(levelId),
    // Drawn outside the hull above the bow, like the simulator (viewBox units of the ship map).
    map: rect,
    // Conduit drawn from each required sector to the room: [x, y] points; a straight line
    // between room centres when omitted. It ties the room to the victory that opens it.
    routes: v.optional(
        v.record(levelId, v.pipe(v.array(v.tuple([v.number(), v.number()])), v.minLength(2))),
        {},
    ),
})
export type CampaignFacility = v.InferOutput<typeof facilitySchema>

const campaignSchema = v.pipe(
    v.strictObject({
        // Bump when level layouts change: older level checkpoints are then discarded.
        contentVersion: v.pipe(count, v.minValue(1)),
        // The last mission; its result decides the ending.
        finale: levelId,
        sectors: v.pipe(v.array(sectorSchema), v.nonEmpty()),
        facilities: v.array(facilitySchema),
    }),
    v.check(
        (campaign) =>
            campaign.facilities.length === FACILITY_IDS.length &&
            FACILITY_IDS.every((id) => campaign.facilities.some((room) => room.id === id)),
        'Every service room appears once on the map',
    ),
    v.check(
        (campaign) =>
            campaign.facilities.every((room) =>
                room.requires.every((id) => campaign.sectors.some((s) => s.level === id)),
            ),
        'Service rooms may only require sectors on the map',
    ),
    v.check(
        (campaign) =>
            campaign.facilities.every((room) =>
                Object.keys(room.routes).every((id) => room.requires.includes(id)),
            ),
        'Service room routes may only lead from required sectors',
    ),
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
        (campaign) =>
            campaign.sectors.every((sector) =>
                Object.keys(sector.routes).every((id) => sector.requires.includes(id)),
            ),
        'Routes may only lead from required sectors',
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

// 1-based position of a mission in the campaign, training excluded (story flags remember
// where things happened, e.g. which sector redirected refugees came from).
export function missionIndex(levelId: string): number {
    const missions = CAMPAIGN.sectors.filter((sector) => sector.layer !== 'training')
    return missions.findIndex((sector) => sector.level === levelId) + 1
}

export function campaignSector(levelId: string): CampaignSector | null {
    return CAMPAIGN.sectors.find((sector) => sector.level === levelId) ?? null
}

// Longest prerequisite chain; training and unknown levels have no campaign depth.
export function sectorDepth(levelId: string): number {
    const sector = campaignSector(levelId)
    if (!sector || sector.layer === 'training') return 0
    return 1 + Math.max(0, ...sector.requires.map(sectorDepth))
}
