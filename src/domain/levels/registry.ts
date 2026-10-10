import type { Level } from '../model/Level'
import { createLevel1 } from './level1'
import { createLevel2 } from './level2'
import { createLevel3 } from './level3'
import { createLevel4 } from './level4'
import { createLevel5 } from './level5'
export const LEVEL_IDS = ['level_1', 'level_2', 'level_3', 'level_4', 'level_5'] as const
export type LevelId = (typeof LEVEL_IDS)[number]
const factories: Record<LevelId, () => Level> = {
    level_1: createLevel1,
    level_2: createLevel2,
    level_3: createLevel3,
    level_4: createLevel4,
    level_5: createLevel5,
}
export function createLevel(id: string): Level | null {
    return Object.prototype.hasOwnProperty.call(factories, id) ? factories[id as LevelId]() : null
}
