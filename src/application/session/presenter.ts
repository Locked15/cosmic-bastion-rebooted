import { DIFFICULTIES, TOWER_CATALOG } from '@/domain'
import type { GameSnapshot } from '../dto/views'
import type { GameSession } from './GameSession'
import { presentBuildOptions } from './presenters/buildOptions'
import { presentDialog } from './presenters/dialog'
import { presentResult } from './presenters/result'
import { presentSelection } from './presenters/selection'

export { starsFor } from './presenters/result'

// Turns the live session into plain view data for the UI.
export function presentSession(session: GameSession): GameSnapshot {
    return {
        swarmMemory: session.remembered
            ? {
                  tower: TOWER_CATALOG[session.remembered].name,
                  percent: Math.round(DIFFICULTIES[session.difficulty].swarmMemory * 100),
              }
            : null,
        levelId: session.level.id,
        levelName: session.level.name,
        status: session.status,
        view: session.view,
        speed: session.speed,
        wave: presentWave(session),
        resources: session.resources,
        resourceRate: session.resourceRate,
        personnel: { miners: session.miners, military: session.military, lost: session.stats.lost },
        conversions: session.conversions.map((conversion) => ({
            id: conversion.id,
            title: `${conversion.fromType === 'miner' ? '⚒→⚔' : '⚔→⚒'} (${conversion.count})`,
            percent: conversion.getProgress(),
        })),
        livingQuarters: {
            underAttack: session.quarters.underAttack,
            enemies: session.enemiesInQuarters.length,
            inTransit: session.personnel.inTransit,
        },
        breakthroughs: { count: session.stats.reached, limit: session.maxBreakthroughs },
        buildOptions: presentBuildOptions(session),
        selection: presentSelection(session),
        dialog: presentDialog(session),
        result: presentResult(session),
    }
}

function presentWave(session: GameSession): GameSnapshot['wave'] {
    const total = session.level.totalWaves
    const wave = session.waveInProgress ? session.currentWave : session.currentWave + 1
    const ahead = wave <= total
    return {
        current: session.currentWave,
        total,
        inProgress: session.waveInProgress,
        routes: ahead
            ? session.level.openRoutes(wave).map((route) => ({
                  label: route.label,
                  opening: route.opensOnWave === wave && wave > 1,
              }))
            : [],
        boss: ahead && session.bossOnWave(wave),
    }
}
