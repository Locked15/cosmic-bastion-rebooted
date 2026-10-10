import type { Point } from '../geometry'
import type { Random } from '../random'
import { ENEMY_BASE_STATS, ENEMY_KIND_MODIFIERS } from '../rules/enemyRules'
import type { EnemyKind, EnemySize, EnemyAbility } from '../rules/enemyRules'
import type { Tower } from './Tower'
import type { Person } from './Personnel'
export interface EnemyAbilityStates {
    adaptedTower?: string
    accelerateTimer?: number
    absorbTimer?: number
    hasTeleported?: boolean
    hasSabotaged?: boolean
}
export interface EnemyUpdateContext {
    towers: Tower[]
    enemies: Enemy[]
    rng: Random
}
export class Enemy {
    baseSpeed = 0
    speed = 0
    damage = 0
    mass = 0
    id: string
    type: EnemyKind
    size: EnemySize
    abilities: EnemyAbility[]
    abilityStates: EnemyAbilityStates = {}
    x = 0
    y = 0
    pathIndex = 0
    path: Point[] = []
    distanceOnSegment = 0
    alive = true
    reached = false
    spawned = true
    spawnDelay = 0
    slowTimer = 0
    slowMultiplier = 1
    stunTimer = 0
    accelerateMultiplier = 1
    opacity = 1
    flashTimer = 0
    blockFlashTimer = 0
    targetPerson: Person | null = null
    _barricadeSlowActive = false
    _barricadeId: string | null
    maxHealth = 0
    reward = 0
    splitPending = false
    spawnedEnemies: Enemy[] = []
    currentHealth = 0

    constructor(type: EnemyKind, size: EnemySize, id: string, abilities: EnemyAbility[] = []) {
        this.id = id
        this.type = type
        this.size = size

        this.setBaseStats()

        this.abilities = abilities

        this.currentHealth = this.maxHealth

        this._barricadeId = null
    }

    setBaseStats(): void {
        const stats = ENEMY_BASE_STATS[this.size]
        this.maxHealth = stats.maxHealth
        this.baseSpeed = stats.speed
        this.speed = stats.speed
        this.damage = stats.damage
        this.reward = stats.reward
        this.mass = stats.mass

        const modifier = ENEMY_KIND_MODIFIERS[this.type]
        this.maxHealth *= modifier.health
        this.reward *= modifier.reward
        this.mass *= modifier.mass
        this.maxHealth = Math.floor(this.maxHealth)
        this.reward = Math.floor(this.reward)
    }

    snapshot(): EnemySnapshot {
        return {
            id: this.id,
            type: this.type,
            size: this.size,
            x: this.x,
            y: this.y,
            maxHealth: this.maxHealth,
            currentHealth: this.currentHealth,
            baseSpeed: this.baseSpeed,
            speed: this.speed,
            alive: this.alive,
            reached: this.reached,
            spawned: this.spawned,
            spawnDelay: this.spawnDelay,
            pathIndex: this.pathIndex,
            distanceOnSegment: this.distanceOnSegment,
            abilities: [...this.abilities],
            abilityStates: { ...this.abilityStates },
            slowTimer: this.slowTimer,
            slowMultiplier: this.slowMultiplier,
            stunTimer: this.stunTimer,
            accelerateMultiplier: this.accelerateMultiplier,
            flashTimer: this.flashTimer,
            blockFlashTimer: this.blockFlashTimer,
        }
    }

    setPath(path: Point[]): void {
        this.path = path ? [...path] : []
        if (this.path.length > 0) {
            this.x = this.path[0]!.x
            this.y = this.path[0]!.y
        }
    }

    takeDamage(damage: number, sourceId?: string): void {
        if (!this.alive) return

        if (this.hasAbility('adaptation') && sourceId) {
            if (!this.abilityStates.adaptedTower) {
                this.abilityStates.adaptedTower = sourceId
            }

            if (sourceId !== this.abilityStates.adaptedTower) {
                return
            }
        }

        if (this.hasAbility('weakImmunity')) {
            const threshold = this.maxHealth * 0.005
            if (damage < threshold) {
                this.blockFlashTimer = 5
                return
            }
        }

        this.currentHealth -= damage
        this.flashTimer = 5

        if (this.currentHealth <= 0) {
            this.die()
        }
    }

    die(): void {
        if (!this.alive) return
        this.alive = false

        if (this.hasAbility('split')) {
            this.splitPending = true
        }
    }

    update(deltaTime: number, ctx: EnemyUpdateContext): void {
        // Damage queues splits; the next update supplies their random source.
        if (this.splitPending) {
            this.onSplit(ctx.rng)
            this.splitPending = false
        }
        if (!this.alive) return

        if (this.flashTimer > 0) {
            this.flashTimer = Math.max(0, this.flashTimer - deltaTime)
        }
        if (this.blockFlashTimer > 0) {
            this.blockFlashTimer = Math.max(0, this.blockFlashTimer - deltaTime)
        }

        this.updateAbilities(deltaTime, ctx.towers, ctx.enemies, ctx.rng)

        this.move(deltaTime)

        this.slowTimer = Math.max(0, this.slowTimer - deltaTime)
        if (this.slowTimer === 0) {
            this.slowMultiplier = 1
        }
        this.stunTimer = Math.max(0, this.stunTimer - deltaTime)
    }

    move(deltaTime: number): void {
        if (this.stunTimer > 0) return

        if (this.pathIndex >= this.path.length - 1) {
            this.reached = true
            return
        }

        const current = this.path[this.pathIndex]!
        const next = this.path[this.pathIndex + 1]!

        const dx = next.x - current.x
        const dy = next.y - current.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        const slowMultiplier = this.slowTimer > 0 ? this.slowMultiplier : 1
        const moveDistance = this.speed * this.accelerateMultiplier * slowMultiplier * deltaTime
        this.distanceOnSegment += moveDistance

        if (this.distanceOnSegment >= distance) {
            this.pathIndex++
            this.distanceOnSegment = 0

            if (this.pathIndex < this.path.length) {
                this.x = this.path[this.pathIndex]!.x
                this.y = this.path[this.pathIndex]!.y
            }
        } else {
            const ratio = this.distanceOnSegment / distance
            this.x = current.x + dx * ratio
            this.y = current.y + dy * ratio
        }
    }

    hasAbility(abilityName: EnemyAbility): boolean {
        return this.abilities && this.abilities.includes(abilityName)
    }

    updateAbilities(deltaTime: number, towers: Tower[], enemies: Enemy[], rng: Random): void {
        if (this.hasAbility('accelerate')) {
            if (!this.abilityStates.accelerateTimer) {
                this.abilityStates.accelerateTimer = 0
            }
            this.abilityStates.accelerateTimer += deltaTime

            if (this.abilityStates.accelerateTimer >= 120) {
                this.accelerateMultiplier *= 1.03
                this.abilityStates.accelerateTimer = 0
            }
        }

        if (this.hasAbility('teleport')) {
            if (!this.abilityStates.hasTeleported) {
                for (const tower of towers) {
                    if (!tower.active) continue

                    const dist = this.distanceTo(tower.x, tower.y)
                    if (dist <= tower.range * 0.7) {
                        this.teleportPastTower(tower, rng)
                        this.abilityStates.hasTeleported = true
                        break
                    }
                }
            }
        }

        if (this.hasAbility('sabotage')) {
            if (!this.abilityStates.hasSabotaged) {
                if (this.pathIndex >= Math.floor(this.path.length * 0.6)) {
                    this.sabotageRandomTower(towers, rng)
                    this.abilityStates.hasSabotaged = true
                }
            }
        }

        if (this.hasAbility('absorb')) {
            if (!this.abilityStates.absorbTimer) {
                this.abilityStates.absorbTimer = 0
            }
            this.abilityStates.absorbTimer += deltaTime

            if (this.abilityStates.absorbTimer >= 240) {
                this.absorbNearbyEnemy(enemies)
                this.abilityStates.absorbTimer = 0
            }
        }
    }

    onSplit(rng: Random): void {
        const count = this.size === 'large' ? 5 : this.size === 'medium' ? 3 : 2
        this.spawnedEnemies = []

        for (let i = 0; i < count; i++) {
            const smallEnemy = new Enemy('simple', 'small', rng.id('enemy'))
            if (this.path) {
                smallEnemy.setPath(this.path)
            }
            smallEnemy.pathIndex = this.pathIndex
            smallEnemy.distanceOnSegment = this.distanceOnSegment
            smallEnemy.x = this.x + (rng.next() - 0.5) * 30
            smallEnemy.y = this.y + (rng.next() - 0.5) * 30
            smallEnemy.spawnDelay = 10 + rng.next() * 20
            smallEnemy.spawned = false
            this.spawnedEnemies.push(smallEnemy)
        }
    }

    teleportPastTower(_tower: Tower, rng: Random): void {
        this.pathIndex = Math.min(
            this.pathIndex + 4 + Math.floor(rng.next() * 2),
            this.path.length - 1,
        )
        if (this.pathIndex < this.path.length) {
            this.x = this.path[this.pathIndex]!.x
            this.y = this.path[this.pathIndex]!.y
        }
        this.distanceOnSegment = 0
    }

    sabotageRandomTower(towers: Tower[], rng: Random): void {
        const activeTowers = towers.filter((t) => t.active && !t.disabled)
        if (activeTowers.length === 0) return

        const target = activeTowers[Math.floor(rng.next() * activeTowers.length)]
        if (target && target.disable) {
            target.disable(240)
        }
    }

    absorbNearbyEnemy(enemies: Enemy[]): void {
        let closest: Enemy | null = null
        let closestDist = 80

        for (const enemy of enemies) {
            if (enemy === this || !enemy.alive || enemy.type === 'boss') continue

            const dist = this.distanceTo(enemy.x, enemy.y)
            if (dist < closestDist) {
                closestDist = dist
                closest = enemy
            }
        }

        if (closest) {
            this.currentHealth = Math.min(
                this.maxHealth,
                this.currentHealth + closest.currentHealth * 0.3,
            )
            closest.alive = false
        }
    }

    distanceTo(x: number, y: number): number {
        const dx = this.x - x
        const dy = this.y - y
        return Math.sqrt(dx * dx + dy * dy)
    }
}

export type EnemySnapshot = Pick<
    Enemy,
    | 'id'
    | 'type'
    | 'size'
    | 'x'
    | 'y'
    | 'maxHealth'
    | 'currentHealth'
    | 'baseSpeed'
    | 'speed'
    | 'alive'
    | 'reached'
    | 'spawned'
    | 'spawnDelay'
    | 'pathIndex'
    | 'distanceOnSegment'
    | 'abilities'
    | 'abilityStates'
    | 'slowTimer'
    | 'slowMultiplier'
    | 'stunTimer'
    | 'accelerateMultiplier'
    | 'flashTimer'
    | 'blockFlashTimer'
>
