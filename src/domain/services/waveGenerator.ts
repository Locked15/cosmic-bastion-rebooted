import type { Random } from '../random'
import { Enemy } from '../model/Enemy'
import type { EnemyAbility, EnemySize } from '../rules/enemyRules'
const regularAbilities: EnemyAbility[] = [
    'split',
    'accelerate',
    'teleport',
    'adaptation',
    'sabotage',
]
const bossAbilities: EnemyAbility[] = [
    'absorb',
    'ambush',
    'dodge',
    'confuse',
    'blind',
    'destroy',
    'spawn',
]
function randomSize(wave: number, rng: Random): EnemySize {
    const value = rng.next()
    const largeChance = Math.min(0.15 + wave * 0.04, 0.4)
    if (value < largeChance) return 'large'
    if (value < largeChance + 0.5) return 'medium'
    return 'small'
}
function randomAbilities(count: number, rng: Random, boss = false): EnemyAbility[] {
    const pool = boss ? [...bossAbilities] : [...regularAbilities]
    const selected: EnemyAbility[] = []
    while (selected.length < count && pool.length > 0) {
        const index = Math.floor(rng.next() * pool.length)
        const ability = pool.splice(index, 1)[0]!
        if (ability === 'adaptation' || ability === 'sabotage') return [ability]
        selected.push(ability)
        for (const exclusive of ['adaptation', 'sabotage']) {
            const exclusiveIndex = pool.indexOf(exclusive as EnemyAbility)
            if (exclusiveIndex >= 0) pool.splice(exclusiveIndex, 1)
        }
    }
    return selected
}
export function generateWave(waveNumber: number, difficulty: number, rng: Random): Enemy[] {
    const enemies: Enemy[] = []
    const count = Math.floor((8 + waveNumber * 3) * difficulty)
    for (let i = 0; i < count; i++) {
        const value = rng.next()
        const abilityChance = Math.min(0.4 + waveNumber * 0.06, 0.8)
        const miniBossChance = Math.min(0.08 + waveNumber * 0.03, 0.3)
        let enemy: Enemy
        if (value < miniBossChance && waveNumber >= 2) {
            const abilities = randomAbilities(rng.next() < 0.5 ? 1 : 2, rng)
            const size = rng.next() > 0.3 ? 'large' : 'medium'
            enemy = new Enemy('miniboss', size, rng.id('enemy'), abilities)
        } else if (value < abilityChance && waveNumber >= 1) {
            const ability = regularAbilities[Math.floor(rng.next() * regularAbilities.length)]!
            enemy = new Enemy('ability', randomSize(waveNumber, rng), rng.id('enemy'), [ability])
        } else {
            enemy = new Enemy('simple', randomSize(waveNumber, rng), rng.id('enemy'))
        }
        enemy.spawnDelay = i * 10
        enemy.spawned = false
        enemies.push(enemy)
    }
    if (waveNumber % 4 === 0 && waveNumber > 0) {
        const abilities = randomAbilities(1, rng, true)
        const boss = new Enemy('boss', 'large', rng.id('enemy'), abilities)
        boss.spawnDelay = count * 10 + 50
        boss.spawned = false
        enemies.push(boss)
    }
    return enemies
}
