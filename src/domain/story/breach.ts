import * as v from 'valibot'
import data from '@/content/events/breach.json'
import { parseContent, positive } from '../content/parse'
import { flagName, type StoryFlags } from '../levels/flags'
import { dialogSchema, type LevelEvent } from '../levels/schema'
import { CAMPAIGN, missionIndex } from './campaign'

// The breach after a lost first mission: while its flag holds, every later mission has more
// enemies and opens with the breach event (content/events/breach.json).
const BREACH = parseContent(
    v.pipe(
        v.strictObject({
            flag: flagName,
            // Missions after this one (in campaign order, training excluded) are affected.
            after: v.pipe(v.string(), v.regex(/^level_\d+$/)),
            // Multiplies the number of enemies per wave.
            enemies: v.pipe(positive, v.minValue(1)),
            dialog: dialogSchema,
        }),
        v.check(
            (breach) => CAMPAIGN.sectors.some((sector) => sector.level === breach.after),
            'The breach must follow a sector on the map',
        ),
    ),
    data,
    'content/events/breach.json',
)

export const BREACH_FLAG = BREACH.flag
export const BREACH_EVENT_ID = 'hull_breach'

// Whether the level suffers the breach under these flags.
export function breachApplies(levelId: string, flags: Readonly<StoryFlags>): boolean {
    const index = missionIndex(levelId)
    return (flags[BREACH.flag] ?? 0) >= 1 && index > missionIndex(BREACH.after) && index > 0
}

// Enemies per wave are multiplied by this while the breach holds.
export const BREACH_ENEMIES = BREACH.enemies

// The special event opening every affected level.
export function breachEvent(): LevelEvent {
    return { id: BREACH_EVENT_ID, wave: 0, trigger: 'start', delay: 0, dialog: BREACH.dialog }
}
