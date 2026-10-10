import { distance, type Point } from '../geometry'
import type { Random } from '../random'
import { ENEMY_BASE_STATS, ENEMY_KIND_MODIFIERS } from '../rules/enemyRules'
import type { EnemyKind, EnemySize, EnemyAbility } from '../rules/enemyRules'
import type { Tower, TowerSlot } from './Tower'
import type { Person } from './Personnel'
export interface EnemyAbilityStates {
    adaptedTower?: string
    accelerateTimer?: number
    absorbTimer?: number
    hasTeleported?: boolean
    hasSabotaged?: boolean
    markedTower?: string
    adaptationExemptTower?: string
    adaptationActive?: boolean
    projectileHits?: number
    ambushed?: boolean
    bossTimer?: number
    confuseTimer?: number
}
export interface EnemyUpdateContext {
    towers: Tower[]
    enemies: Enemy[]
    rng: Random
    slots?: TowerSlot[]
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
    spawnedBy: string | null = null
    ambushFlashTimer = 0
    private offspring: Enemy[] = []

    constructor(type: EnemyKind, size: EnemySize, id: string, abilities: EnemyAbility[] = []) {
        this.id = id
        this.type = type
        this.size = size

        const exclusive = abilities.find(
            (ability) => ability === 'adaptation' || ability === 'sabotage',
        )
        this.abilities = exclusive ? [exclusive] : [...abilities]
        this.setBaseStats()

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
        if (this.type === 'miniboss' && this.abilities.length === 1) this.maxHealth *= 2
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

        if (
            this.hasAbility('adaptation') &&
            sourceId &&
            this.abilityStates.adaptationActive &&
            sourceId !== this.abilityStates.adaptationExemptTower &&
            sourceId !== this.abilityStates.adaptedTower
        )
            return

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

        this.ambushFlashTimer = Math.max(0, this.ambushFlashTimer - deltaTime)
        this.prepareCombat(ctx.towers, ctx.rng)
        this.updateAbilities(deltaTime, ctx.towers, ctx.enemies, ctx.rng, ctx.slots)

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

        const slowMultiplier = this.slowTimer > 0 ? this.slowMultiplier : 1
        this.setProgress(
            this.pathProgress + this.speed * this.accelerateMultiplier * slowMultiplier * deltaTime,
        )
    }

    get pathLength(): number {
        return this.path
            .slice(1)
            .reduce(
                (length, point, i) =>
                    length + Math.hypot(point.x - this.path[i]!.x, point.y - this.path[i]!.y),
                0,
            )
    }

    get pathProgress(): number {
        let progress = this.distanceOnSegment
        for (let i = 0; i < this.pathIndex; i++) {
            progress += Math.hypot(
                this.path[i + 1]!.x - this.path[i]!.x,
                this.path[i + 1]!.y - this.path[i]!.y,
            )
        }
        return progress
    }

    setProgress(progress: number): void {
        if (!this.path.length) return
        let remaining = Math.max(0, Math.min(progress, this.pathLength))
        this.pathIndex = 0
        while (this.pathIndex < this.path.length - 1) {
            const a = this.path[this.pathIndex]!
            const b = this.path[this.pathIndex + 1]!
            const length = Math.hypot(b.x - a.x, b.y - a.y)
            if (remaining < length) {
                this.distanceOnSegment = remaining
                this.x = a.x + ((b.x - a.x) * remaining) / length
                this.y = a.y + ((b.y - a.y) * remaining) / length
                this.reached = false
                return
            }
            remaining -= length
            this.pathIndex++
        }
        this.distanceOnSegment = 0
        Object.assign(this, this.path[this.pathIndex])
        this.reached = true
    }

    knockBack(distance: number): void {
        this.setProgress(this.pathProgress - distance)
    }

    prepareCombat(towers: Tower[], rng: Random): void {
        if (!this.hasAbility('adaptation')) return
        const active = towers.filter((tower) => tower.active)
        this.abilityStates.adaptationActive = active.length > 1
        const end = this.path[this.path.length - 1] ?? this
        const last = active.reduce<Tower | null>(
            (best, tower) => (!best || distance(tower, end) < distance(best, end) ? tower : best),
            null,
        )
        this.abilityStates.adaptationExemptTower = last?.id
        const inRange = active.filter((tower) => this.distanceTo(tower.x, tower.y) <= tower.range)
        if (
            inRange.length &&
            !inRange.some((tower) => tower.id === this.abilityStates.adaptedTower)
        ) {
            this.abilityStates.adaptedTower = inRange[Math.floor(rng.next() * inRange.length)]?.id
        }
    }

    dodgeProjectile(): boolean {
        if (!this.hasAbility('dodge')) return false
        this.abilityStates.projectileHits = (this.abilityStates.projectileHits ?? 0) + 1
        const dodged = this.abilityStates.projectileHits % 3 === 0
        if (dodged) this.blockFlashTimer = 5
        return dodged
    }

    hasAbility(abilityName: EnemyAbility): boolean {
        return this.abilities && this.abilities.includes(abilityName)
    }

    updateAbilities(
        deltaTime: number,
        towers: Tower[],
        enemies: Enemy[],
        rng: Random,
        slots: TowerSlot[] = [],
    ): void {
        if (this.hasAbility('accelerate')) {
            let timer = (this.abilityStates.accelerateTimer ?? 0) + deltaTime
            while (timer >= 300) {
                this.accelerateMultiplier *= 1.05
                timer -= 300
            }
            this.abilityStates.accelerateTimer = timer
        }
        if (this.hasAbility('ambush') && !this.abilityStates.ambushed && this.path.length > 1) {
            this.setProgress(rng.next() * this.pathLength * 0.5)
            this.abilityStates.ambushed = true
            this.ambushFlashTimer = 60
        }
        if (this.hasAbility('teleport') && !this.abilityStates.hasTeleported) {
            const active = towers.filter((tower) => tower.active)
            let marked = active.find((tower) => tower.id === this.abilityStates.markedTower)
            if (!marked && active.length) {
                marked = active[Math.floor(rng.next() * active.length)]!
                this.abilityStates.markedTower = marked.id
            }
            if (marked && this.distanceTo(marked.x, marked.y) <= marked.range) {
                this.teleportPastTower(marked)
                this.abilityStates.hasTeleported = true
            }
        }
        if (this.hasAbility('sabotage') && !this.abilityStates.hasSabotaged) {
            if (towers.some((tower) => tower.active && !tower.disabled)) {
                this.sabotageRandomTower(towers, rng)
                this.abilityStates.hasSabotaged = true
            }
        }
        this.updateBossAbilities(deltaTime, towers, enemies, rng, slots)
    }

    updateBossAbilities(
        deltaTime: number,
        towers: Tower[],
        enemies: Enemy[],
        rng: Random,
        slots: TowerSlot[],
    ): void {
        if (
            !this.abilities.some((ability) =>
                ['absorb', 'spawn', 'destroy', 'confuse', 'blind'].includes(ability),
            )
        )
            return
        this.abilityStates.confuseTimer = Math.max(
            0,
            (this.abilityStates.confuseTimer ?? 0) - deltaTime,
        )
        // Confuse: 6 s every 12 s. Blind: 8 s every 12 s. Destroy: every 15 s.
        const interval = this.hasAbility('absorb')
            ? 480
            : this.hasAbility('spawn')
              ? 600
              : this.hasAbility('destroy')
                ? 900
                : 720
        this.abilityStates.bossTimer = (this.abilityStates.bossTimer ?? 0) + deltaTime
        while (this.abilityStates.bossTimer >= interval) {
            this.abilityStates.bossTimer -= interval
            if (this.hasAbility('absorb')) this.absorbNearbyEnemy(enemies)
            if (this.hasAbility('confuse')) this.abilityStates.confuseTimer = 360
            if (this.hasAbility('blind')) {
                towers
                    .filter((tower) => tower.active)
                    .sort((a, b) => this.distanceTo(a.x, a.y) - this.distanceTo(b.x, b.y))
                    .slice(0, 2)
                    .forEach((tower) => tower.blind({ x: this.x, y: this.y }, 480, this))
            }
            if (this.hasAbility('destroy')) {
                const targets = slots.filter((slot) => slot.tower?.active)
                targets[Math.floor(rng.next() * targets.length)]?.destroy()
            }
            if (this.hasAbility('spawn')) {
                this.offspring = this.offspring.filter((enemy) => enemy.alive)
                const alive = new Set(
                    [...enemies, ...this.offspring, ...this.spawnedEnemies].filter(
                        (enemy) => enemy.alive && enemy.spawnedBy === this.id,
                    ),
                ).size
                if (alive < 5) {
                    const child = new Enemy('simple', 'medium', rng.id('enemy'))
                    child.spawnedBy = this.id
                    child.setPath(this.path)
                    child.setProgress(this.pathProgress)
                    this.spawnedEnemies.push(child)
                    this.offspring.push(child)
                }
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
            smallEnemy.x = this.x
            smallEnemy.y = this.y
            smallEnemy.spawnDelay = 10 + rng.next() * 20
            smallEnemy.spawned = false
            this.spawnedEnemies.push(smallEnemy)
        }
    }

    teleportPastTower(tower: Tower): void {
        let progress = 0
        const current = this.pathProgress
        for (let i = 0; i < this.path.length - 1; i++) {
            const a = this.path[i]!
            const b = this.path[i + 1]!
            const dx = b.x - a.x
            const dy = b.y - a.y
            const length = Math.hypot(dx, dy)
            if (!length) continue
            const ox = a.x - tower.x
            const oy = a.y - tower.y
            const projection = -(ox * dx + oy * dy) / length ** 2
            const discriminant =
                projection ** 2 - (ox ** 2 + oy ** 2 - tower.range ** 2) / length ** 2
            if (discriminant >= 0) {
                const exit = projection + Math.sqrt(discriminant)
                const exitProgress = progress + exit * length
                if (exit >= 0 && exit <= 1 && exitProgress >= current) {
                    this.setProgress(exitProgress)
                    return
                }
            }
            progress += length
        }
        this.setProgress(this.pathLength)
    }

    sabotageRandomTower(towers: Tower[], rng: Random): void {
        const activeTowers = towers.filter((t) => t.active && !t.disabled)
        if (activeTowers.length === 0) return

        const target = activeTowers[Math.floor(rng.next() * activeTowers.length)]
        if (target && target.disable) {
            target.disable(600)
        }
    }

    absorbNearbyEnemy(enemies: Enemy[]): void {
        let closest: Enemy | null = null
        let closestDist = 80

        for (const enemy of enemies) {
            if (enemy === this || !enemy.alive || !enemy.spawned || enemy.type === 'boss') continue

            const dist = this.distanceTo(enemy.x, enemy.y)
            if (dist < closestDist) {
                closestDist = dist
                closest = enemy
            }
        }

        if (closest) {
            this.currentHealth = Math.min(this.maxHealth, this.currentHealth + closest.maxHealth)
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
