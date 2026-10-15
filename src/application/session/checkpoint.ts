import { CONTENT_VERSION, type BarricadeType, type DifficultyId, type TowerType } from '@/domain'
import type { GameSession, SessionStats } from './GameSession'
import type { StoryState } from './story'

// Long enough to finish any construction or upgrade in one step when replaying a save.
const INSTANT = 1e9

// Level progress saved between waves (no enemies on the field).
export interface LevelCheckpoint {
    version: 1
    // Content version the level layout came from (missing in saves before it existed).
    content?: number
    levelId: string
    wave: number
    overridesUsed?: boolean
    difficulty?: DifficultyId
    resources: number
    miners: number
    military: number
    stats: SessionStats
    damageMultiplier: number
    barricadeMultiplier: number
    towers: ({ type: TowerType; level: number } | null)[]
    barricades: {
        type: BarricadeType
        x: number
        y: number
        width: number
        height: number
        level: number
        health: number
        // Broken barricades stay on the track and can still be repaired after resuming.
        destroyed?: boolean
    }[]
    objectives: string[]
    story: StoryState
}

export function canCheckpoint(session: GameSession): boolean {
    return (
        !session.ended &&
        !session.waveInProgress &&
        session.enemies.length === 0 &&
        !session.quarters.underAttack &&
        !session.story.active
    )
}

export function createCheckpoint(session: GameSession): LevelCheckpoint {
    // People being retrained are saved in their new role.
    const transit = { miner: 0, military: 0 }
    for (const conversion of session.conversions) transit[conversion.toType] += conversion.count
    return {
        version: 1,
        content: CONTENT_VERSION,
        levelId: session.level.id,
        wave: session.currentWave,
        difficulty: session.difficulty,
        overridesUsed: session.overrides.used,
        resources: session.resources,
        miners: session.miners + transit.miner,
        military: session.military + transit.military,
        stats: { ...session.stats },
        damageMultiplier: session.damageMultiplier,
        barricadeMultiplier: session.barricadeMultiplier,
        towers: session.slots.map((slot) => {
            const type = slot.tower?.type ?? slot.construction?.type
            // An upgrade in progress is already paid for, so it is saved as done.
            const level = (slot.tower?.level ?? 0) + (slot.tower?.upgrading ? 1 : 0)
            return type ? { type, level } : null
        }),
        barricades: session.barricades.map((barricade) => ({
            type: barricade.type,
            x: barricade.x,
            y: barricade.y,
            width: barricade.width,
            height: barricade.height,
            level: barricade.level + (barricade.upgrading ? 1 : 0),
            health: barricade.active ? barricade.currentHealth : Infinity,
            // A repair in progress is already paid for, so it is saved as done.
            destroyed: barricade.destroyed && !barricade.building,
        })),
        objectives: session.objectives.all.filter((o) => o.completed).map((o) => o.id),
        story: session.story.toState(),
    }
}

// Apply a checkpoint to a freshly created session of the same level.
export function restoreCheckpoint(session: GameSession, checkpoint: LevelCheckpoint): void {
    if (checkpoint.levelId !== session.level.id) throw new Error('Checkpoint is for another level')
    session.overrides.used ||= checkpoint.overridesUsed ?? false
    session.story.restore(checkpoint.story)
    session.currentWave = checkpoint.wave
    // Resume at the difficulty the run started with, whatever the settings say now.
    if (checkpoint.difficulty) session.difficulty = checkpoint.difficulty
    session.resources = checkpoint.resources
    session.stats = { ...checkpoint.stats }
    session.damageMultiplier = checkpoint.damageMultiplier
    session.barricadeMultiplier = checkpoint.barricadeMultiplier
    resetPersonnel(session, checkpoint.miners, checkpoint.military)

    checkpoint.towers.forEach((saved, index) => {
        const slot = session.slots[index]
        if (!slot || !saved) return
        slot.startConstruction(saved.type)
        slot.updateConstruction(1, INSTANT)
        for (let level = 0; level < saved.level; level++) {
            slot.tower?.startUpgrade()
            slot.tower?.updateUpgrade(1, INSTANT)
        }
    })

    for (const saved of checkpoint.barricades) {
        const barricade = session.buildBarricadeAt(saved, saved.type)
        barricade.updateBuild(1, INSTANT)
        for (let level = 0; level < saved.level; level++) {
            barricade.startUpgrade()
            barricade.updateUpgrade(1, INSTANT)
        }
        barricade.currentHealth = Math.min(barricade.maxHealth, saved.health)
        if (saved.destroyed) barricade.destroy()
    }

    for (const id of checkpoint.objectives) session.objectives.complete(id)
}

function resetPersonnel(session: GameSession, miners: number, military: number): void {
    const { personnel } = session
    personnel.remove('miner', personnel.miners)
    personnel.remove('military', personnel.military)
    personnel.add('miner', miners)
    personnel.add('military', military)
}
