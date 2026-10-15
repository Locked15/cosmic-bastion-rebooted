import type { Random } from '../random'
import { Enemy } from '../model/Enemy'
import { WAVE_RULES, type EnemyAbility, type EnemySize, type WaveChance } from '../rules/enemyRules'

// Abilities a level forbids (story consequences, e.g. a purged medbay stops sabotage).
export interface WaveOptions {
    excludedAbilities?: readonly EnemyAbility[]
    boss?: { onThisWave: boolean; abilities: number; banned: readonly EnemyAbility[] }
}

const EXCLUSIVE: readonly EnemyAbility[] = ['adaptation', 'sabotage']

function chance(rule: WaveChance, wave: number): number {
    return Math.min(rule.base + wave * rule.perWave, rule.max)
}

function randomSize(wave: number, rng: Random): EnemySize {
    const value = rng.next()
    const largeChance = chance(WAVE_RULES.largeChance, wave)
    if (value < largeChance) return 'large'
    if (value < largeChance + WAVE_RULES.mediumShare) return 'medium'
    return 'small'
}

function randomAbilities(
    count: number,
    rng: Random,
    available: readonly EnemyAbility[],
): EnemyAbility[] {
    const pool = [...available]
    const selected: EnemyAbility[] = []
    while (selected.length < count && pool.length > 0) {
        const index = Math.floor(rng.next() * pool.length)
        const ability = pool.splice(index, 1)[0]!
        if (EXCLUSIVE.includes(ability)) return [ability]
        selected.push(ability)
        for (const exclusive of EXCLUSIVE) {
            const exclusiveIndex = pool.indexOf(exclusive)
            if (exclusiveIndex >= 0) pool.splice(exclusiveIndex, 1)
        }
    }
    return selected
}

export function generateWave(
    waveNumber: number,
    difficulty: number,
    rng: Random,
    options: WaveOptions = {},
): Enemy[] {
    const rules = WAVE_RULES
    const excluded = options.excludedAbilities ?? []
    const regular = rules.regularAbilities.filter((ability) => !excluded.includes(ability))
    const boss = rules.bossAbilities.filter(
        (ability) => !excluded.includes(ability) && !options.boss?.banned.includes(ability),
    )
    const enemies: Enemy[] = []
    const count = Math.floor((rules.baseCount + waveNumber * rules.countPerWave) * difficulty)
    for (let i = 0; i < count; i++) {
        const value = rng.next()
        const abilityChance = chance(rules.abilityChance, waveNumber)
        const miniBossChance = chance(rules.miniBossChance, waveNumber)
        let enemy: Enemy
        if (value < miniBossChance && waveNumber >= rules.miniBossFromWave && regular.length) {
            const abilities = randomAbilities(rng.next() < 0.5 ? 1 : 2, rng, regular)
            const size = rng.next() > 0.3 ? 'large' : 'medium'
            enemy = new Enemy('miniboss', size, rng.id('enemy'), abilities)
        } else if (value < abilityChance && waveNumber >= rules.abilityFromWave && regular.length) {
            const ability = regular[Math.floor(rng.next() * regular.length)]!
            enemy = new Enemy('ability', randomSize(waveNumber, rng), rng.id('enemy'), [ability])
        } else {
            enemy = new Enemy('simple', randomSize(waveNumber, rng), rng.id('enemy'))
        }
        enemy.spawnDelay = i * rules.spawnInterval
        enemy.spawned = false
        enemies.push(enemy)
    }
    if (options.boss?.onThisWave) {
        const abilities = randomAbilities(options.boss.abilities, rng, boss)
        const enemy = new Enemy('boss', 'large', rng.id('enemy'), abilities)
        enemy.spawnDelay = count * rules.spawnInterval + rules.bossDelay
        enemy.spawned = false
        enemies.push(enemy)
    }
    return enemies
}
