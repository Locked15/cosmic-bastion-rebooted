import { applyRelationship, type EventEffect } from '@/domain'
import type { GameSession } from './GameSession'

// Simulate the complete transaction before applying anything, including nested costs.
export function canAfford(session: GameSession, effect: EventEffect | null): boolean {
    const balance = {
        resources: session.resources,
        miners: session.personnel.miners,
        military: session.personnel.military,
    }
    function check(effect: EventEffect | null): boolean {
        if (!effect) return true
        switch (effect.type) {
            case 'transaction': {
                const { cost } = effect
                if (Object.values(cost).some((value) => !Number.isFinite(value) || value < 0))
                    return false
                balance.resources -= cost.resources ?? 0
                balance.miners -= cost.miners ?? 0
                balance.military -= cost.military ?? 0
                if (Object.values(balance).some((value) => value < 0)) return false
                return effect.effects.every(check)
            }
            case 'resources':
                balance.resources += effect.value
                balance.military += effect.military ?? 0
                break
            case 'removeMilitary':
                balance.military -= effect.count
                balance.resources += effect.resources
                break
            case 'superWeapon':
                balance.military += effect.military
                break
            case 'convert':
                balance.miners -= effect.count
                break
            case 'addMiners':
                balance.miners += effect.count
                break
            case 'addMilitary':
                balance.military += effect.count
                break
            case 'addPersonnel':
                balance.miners += effect.miners
                balance.military += effect.military
                break
            case 'emergency':
                balance.resources += effect.resources
                balance.military += effect.military
                break
        }
        return Object.values(balance).every((value) => value >= 0)
    }
    return check(effect)
}

export function applyEffect(session: GameSession, effect: EventEffect | null): void {
    if (!effect) return
    const { personnel } = session
    switch (effect.type) {
        case 'transaction':
            session.resources -= effect.cost.resources ?? 0
            personnel.remove('miner', effect.cost.miners ?? 0)
            personnel.remove('military', effect.cost.military ?? 0)
            for (const nested of effect.effects) applyEffect(session, nested)
            break
        case 'flag':
            session.story.flags[effect.name] = effect.value
            break
        case 'unlockTower':
            session.story.flags[`tech_${effect.tower}`] = 1
            break
        case 'unlockBarricade':
            session.story.flags[`tech_${effect.barricade}`] = 1
            break
        case 'resources':
            session.resources += effect.value
            personnel.add('military', effect.military ?? 0)
            break
        case 'convert':
            personnel.startConversion('miner', 'military', effect.count)
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
        case 'relationship':
            applyRelationship(session.story.flags, effect)
            break
    }
}
