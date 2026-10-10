import type { EventEffect } from '@/domain'
import type { GameSession } from './GameSession'

export function canAfford(session: GameSession, effect: EventEffect | null): boolean {
    if (!effect) return true
    switch (effect.type) {
        case 'resources':
            return session.resources + effect.value >= 0
        case 'removeMilitary':
            return session.personnel.military >= effect.count
        case 'superWeapon':
            return session.personnel.military + Math.min(0, effect.military) >= 0
        default:
            return true
    }
}

export function applyEffect(session: GameSession, effect: EventEffect | null): void {
    if (!effect) return
    const { personnel } = session
    switch (effect.type) {
        case 'resources':
            session.resources += effect.value
            personnel.add('military', effect.military ?? 0)
            break
        case 'convert':
            personnel.startConversion('miner', 'military', Math.min(effect.count, personnel.miners))
            break
        case 'addMilitary':
            personnel.add('military', effect.count)
            break
        case 'addMiners':
            personnel.add('miner', effect.count)
            break
        case 'addPersonnel':
            personnel.add('miner', effect.miners)
            personnel.add('military', effect.military)
            break
        case 'removeMilitary':
            personnel.remove('military', effect.count)
            session.resources += effect.resources
            break
        case 'emergency':
            session.resources += effect.resources
            personnel.add('military', effect.military)
            break
        case 'superWeapon': {
            if (effect.military < 0) personnel.remove('military', -effect.military)
            else personnel.add('military', effect.military)
            const alive = session.enemies.filter((enemy) => enemy.alive && enemy.spawned)
            const kills = Math.floor(alive.length * effect.killPercent)
            for (let i = 0; i < kills; i++) {
                const index = Math.floor(session.rng.next() * alive.length)
                alive.splice(index, 1)[0]?.die()
            }
            break
        }
        case 'buffDamage':
            session.applyDamageBuff(effect.value)
            break
        case 'buffBarricades':
            session.applyBarricadeBuff(effect.value)
            break
    }
}
