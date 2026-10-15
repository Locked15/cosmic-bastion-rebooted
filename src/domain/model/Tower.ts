import type { Point } from '../geometry'
import type { Random } from '../random'
import { TOWER_CATALOG } from '../rules/towerCatalog'
import type { TowerStats, TowerType } from '../rules/towerCatalog'
import type { Enemy } from './Enemy'
import { Projectile, ExplosiveProjectile } from './Projectile'
export abstract class Tower {
    id: string
    type: TowerType
    x = 0
    y = 0
    active = true
    level = 0
    broken = false
    repairing = false
    repairProgress = 0
    repairTime = 180
    upgrading = false
    upgradeProgress = 0
    upgradeTime = 240
    damage = 0
    range = 0
    fireRate = 0
    fireTimer = 0
    disabled = false
    disableTimer = 0
    angle = 0
    targetAngle = 0
    projectiles: Projectile[] = []
    // Catalog stats of level 0; upgrades apply the catalog stats of each level on top.
    baseStats: TowerStats
    abilities: { name: string; description: string }[]
    showShockEffect = 0
    damageMultiplier = 1
    // Multiplies the range from the catalog (meta upgrades).
    rangeMultiplier = 1
    blindTimer = 0
    blindTarget: Point | null = null
    blindEnemy: Enemy | null = null

    blind(point: Point, duration: number, enemy: Enemy | null = null): void {
        this.blindTarget = { ...point }
        this.blindTimer = duration
        this.blindEnemy = enemy
    }

    eligibleTargets(enemies: Enemy[]): Enemy[] {
        const visible = enemies.filter((enemy) => enemy.alive && enemy.spawned)
        return visible.filter(
            (enemy) =>
                !enemy.hasAbility('confuse') ||
                !enemy.abilityStates.confuseTimer ||
                !visible.some(
                    (other) => other !== enemy && this.distanceTo(other.x, other.y) <= this.range,
                ),
        )
    }

    tickStatus(deltaTime: number): boolean {
        this.blindTimer = Math.max(0, this.blindTimer - deltaTime)
        if (!this.blindTimer) {
            this.blindTarget = null
            this.blindEnemy = null
        }
        if (!this.active) return false
        if (this.disabled) {
            this.disableTimer = Math.max(0, this.disableTimer - deltaTime)
            this.disabled = this.disableTimer > 0
            return false
        }
        return true
    }

    constructor(type: TowerType, x: number, y: number, id: string) {
        this.id = id
        this.type = type
        this.x = x
        this.y = y

        this.baseStats = { ...TOWER_CATALOG[type].stats }
        this.abilities = []
    }

    snapshot(): TowerSnapshot {
        return {
            id: this.id,
            type: this.type,
            level: this.level,
            x: this.x,
            y: this.y,
            active: this.active,
            broken: this.broken,
            repairing: this.repairing,
            repairProgress: this.repairProgress,
            repairTime: this.repairTime,
            upgrading: this.upgrading,
            upgradeProgress: this.upgradeProgress,
            upgradeTime: this.upgradeTime,
            disabled: this.disabled,
            disableTimer: this.disableTimer,
            fireTimer: this.fireTimer,
            fireRate: this.fireRate,
            damage: this.damage,
            range: this.range,
            abilities: this.abilities.map((ability) => ({ ...ability })),
            showShockEffect: this.showShockEffect || 0,
        }
    }

    setBaseStats(): void {
        this.resetAbilities()
        this.resetBehaviour()
        this.applyStats(this.baseStats)
    }

    // Switch off what upgrades of this tower type switch on.
    protected resetBehaviour(): void {}

    protected applyStats(stats: TowerStats): void {
        Object.assign(this, stats)
        if (stats.range !== undefined) this.range = stats.range * this.rangeMultiplier
    }

    setRangeMultiplier(multiplier: number): void {
        if (multiplier === this.rangeMultiplier) return
        this.range = (this.range / this.rangeMultiplier) * multiplier
        this.rangeMultiplier = multiplier
    }

    resetAbilities(): void {
        this.abilities = []
    }

    unlockAbility(name: string, description: string): void {
        if (!name) return
        if (!this.abilities.some((ability) => ability.name === name)) {
            this.abilities.push({ name, description: description || '' })
        }
    }

    unlockAbilityByLevel(level: number = this.level): void {
        const benefits = TOWER_CATALOG[this.type].benefits
        if (!benefits) return
        const ability = level >= 1 && level <= 3 ? benefits[level as 1 | 2 | 3] : undefined
        if (ability) {
            this.unlockAbility(ability.name, ability.description)
        }
    }

    startRepair(): boolean {
        if (this.active || this.repairing) return false
        this.repairing = true
        this.repairProgress = 0
        return true
    }

    updateRepair(militaryCount: number, deltaTime: number = 1): boolean {
        if (!this.repairing) return false

        const repairSpeed = Math.max(1, militaryCount * 0.5)
        this.repairProgress += repairSpeed * deltaTime

        if (this.repairProgress >= this.repairTime) {
            this.active = true
            this.broken = false
            this.repairing = false
            this.repairProgress = 0
            return true
        }

        return false
    }

    startUpgrade(): boolean {
        if (!this.active || this.upgrading || this.level >= 3) return false
        this.upgrading = true
        this.upgradeProgress = 0
        return true
    }

    updateUpgrade(militaryCount: number, deltaTime: number = 1): boolean {
        if (!this.upgrading) return false

        const upgradeSpeed = Math.max(1, militaryCount * 0.3)
        this.upgradeProgress += upgradeSpeed * deltaTime

        if (this.upgradeProgress >= this.upgradeTime) {
            this.level++
            this.upgrading = false
            this.upgradeProgress = 0
            this.applyUpgrade()
            return true
        }

        return false
    }

    applyUpgrade(): void {
        const upgrade = TOWER_CATALOG[this.type].upgrades[this.level - 1]
        if (upgrade) this.applyStats(upgrade.stats)
        this.unlockAbilityByLevel()
    }

    disable(duration: number): void {
        this.disabled = true
        this.disableTimer = duration
    }

    update(deltaTime: number, enemies: Enemy[], rng: Random): void {
        this.projectiles = this.projectiles.filter((projectile) => {
            projectile.update(deltaTime)
            return projectile.active
        })
        if (!this.tickStatus(deltaTime)) return

        if (this.fireTimer > 0) {
            this.fireTimer = Math.max(0, this.fireTimer - deltaTime)
        }

        if (this.fireTimer <= 0) {
            this.findTargetAndFire(enemies, deltaTime, rng)
        }
        this.updateRotation()
    }

    holdFire(deltaTime: number): void {
        this.tickStatus(deltaTime)
        this.fireTimer = Math.max(0, this.fireTimer - deltaTime)
        this.showShockEffect = Math.max(0, this.showShockEffect - deltaTime)
    }

    findTargetAndFire(enemies: Enemy[], deltaTime: number, rng: Random): void {
        const target = this.blindEnemy ?? this.findTarget(enemies)
        if (target) {
            this.targetAngle = Math.atan2(target.y - this.y, target.x - this.x)
            const before = this.projectiles.length
            this.fire(target, enemies, rng)
            if (this.blindTarget) {
                this.targetAngle = Math.atan2(
                    this.blindTarget.y - this.y,
                    this.blindTarget.x - this.x,
                )
                for (const projectile of this.projectiles.slice(before)) {
                    projectile.fixedTarget = { ...this.blindTarget }
                    projectile.impactEnemies = enemies
                }
            }
            this.fireTimer = this.fireRate
        }
    }

    findTarget(enemies: Enemy[]): Enemy | null {
        let closest: Enemy | null = null
        let closestDist = Infinity

        for (const enemy of this.eligibleTargets(enemies)) {
            if (!enemy.alive) continue

            const dist = this.distanceTo(enemy.x, enemy.y)
            if (dist <= this.range && dist < closestDist) {
                closestDist = dist
                closest = enemy
            }
        }

        return closest
    }

    findStrongestTarget(enemies: Enemy[]): Enemy | null {
        let strongest: Enemy | null = null
        let maxHealth = 0

        for (const enemy of this.eligibleTargets(enemies)) {
            if (!enemy.alive) continue

            const dist = this.distanceTo(enemy.x, enemy.y)
            if (dist <= this.range && enemy.maxHealth > maxHealth) {
                maxHealth = enemy.maxHealth
                strongest = enemy
            }
        }

        return strongest
    }

    fire(target: Enemy, allEnemies: Enemy[], rng: Random): void {
        const projectile = new Projectile(
            this.x,
            this.y,
            target,
            this.damage * this.damageMultiplier,
            rng.id('projectile'),
            'bullet',
            false,
            this.id,
        )
        this.projectiles.push(projectile)
    }

    updateRotation(): void {
        const angleDiff = this.targetAngle - this.angle
        const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff))
        this.angle += normalizedDiff * 0.2
    }

    distanceTo(x: number, y: number): number {
        const dx = this.x - x
        const dy = this.y - y
        return Math.sqrt(dx * dx + dy * dy)
    }
}
export class CannonTower extends Tower {
    multiTarget = false

    constructor(x: number, y: number, id: string) {
        super('cannon', x, y, id)
        this.setBaseStats()
    }

    protected resetBehaviour(): void {
        this.multiTarget = false
    }

    fire(target: Enemy, allEnemies: Enemy[], rng: Random): void {
        if (this.multiTarget && this.level >= 3 && !this.blindTarget) {
            const targets = this.eligibleTargets(allEnemies)
                .filter((e) => e.alive && this.distanceTo(e.x, e.y) <= this.range)
                .sort((a, b) => this.distanceTo(a.x, a.y) - this.distanceTo(b.x, b.y))
                .slice(0, 3)

            targets.forEach((t) => {
                const projectile = new Projectile(
                    this.x,
                    this.y,
                    t,
                    this.damage * this.damageMultiplier,
                    rng.id('projectile'),
                    'cannon',
                    false,
                    this.id,
                )
                this.projectiles.push(projectile)
            })
        } else {
            const projectile = new Projectile(
                this.x,
                this.y,
                target,
                this.damage * this.damageMultiplier,
                rng.id('projectile'),
                'cannon',
                false,
                this.id,
            )
            this.projectiles.push(projectile)
        }
    }
}
export class RocketTower extends Tower {
    explosionRadius = 40
    knockback = false

    constructor(x: number, y: number, id: string) {
        super('rocket', x, y, id)
        this.setBaseStats()
    }

    protected resetBehaviour(): void {
        this.knockback = false
    }

    fire(target: Enemy, allEnemies: Enemy[], rng: Random): void {
        const projectile = new ExplosiveProjectile(
            this.x,
            this.y,
            target,
            this.damage * this.damageMultiplier,
            this.explosionRadius,
            this.knockback,
            allEnemies,
            rng.id('projectile'),
            this.id,
        )
        this.projectiles.push(projectile)
    }
}
export class MachineGunTower extends Tower {
    slowEffect = false

    constructor(x: number, y: number, id: string) {
        super('machinegun', x, y, id)
        this.setBaseStats()
    }

    protected resetBehaviour(): void {
        this.slowEffect = false
    }

    fire(target: Enemy, allEnemies: Enemy[], rng: Random): void {
        const projectile = new Projectile(
            this.x,
            this.y,
            target,
            this.damage * this.damageMultiplier,
            rng.id('projectile'),
            'bullet',
            this.slowEffect,
            this.id,
        )
        this.projectiles.push(projectile)
    }
}
export class LaserTower extends Tower {
    currentTarget: Enemy | null = null
    piercing = false
    beamEnd: Point | null = null
    beamHits: Point[] = []
    beamTimer = 0
    beamDuration = 60

    constructor(x: number, y: number, id: string) {
        super('laser', x, y, id)
        this.setBaseStats()
    }

    protected resetBehaviour(): void {
        this.piercing = false
        this.currentTarget = null
        this.beamEnd = null
        this.beamTimer = 0
    }

    // The final upgrade turns the beam into a ray across the whole map.
    protected applyStats(stats: TowerStats): void {
        super.applyStats(stats)
        if (this.piercing) this.range = Infinity
    }

    holdFire(deltaTime: number): void {
        super.holdFire(deltaTime)
        if (this.beamTimer > 0) this.fireTimer = this.fireRate
        this.beamTimer = 0
        this.currentTarget = null
        this.beamEnd = null
        this.beamHits = []
    }

    update(deltaTime: number, enemies: Enemy[], _rng?: Random): void {
        void _rng
        this.beamEnd = null
        this.beamHits = []
        if (!this.tickStatus(deltaTime)) return
        this.fireTimer = Math.max(0, this.fireTimer - deltaTime)
        if (!this.beamTimer && !this.fireTimer) {
            this.currentTarget =
                this.blindEnemy ??
                (this.piercing ? this.findStrongestTarget(enemies) : this.findTarget(enemies))
            if (this.currentTarget) this.beamTimer = this.beamDuration
        }
        if (this.beamTimer > 0) {
            const target = this.currentTarget
            if (
                !this.blindTarget &&
                (!target?.alive ||
                    !target.spawned ||
                    this.distanceTo(target.x, target.y) > this.range ||
                    !this.eligibleTargets(enemies).includes(target))
            ) {
                this.beamTimer = 0
                this.fireTimer = this.fireRate
                this.currentTarget = null
                return
            }
            const point = this.blindTarget ?? target
            if (point) {
                const dx = point.x - this.x
                const dy = point.y - this.y
                const length = Math.hypot(dx, dy)
                this.targetAngle = Math.atan2(dy, dx)
                // A piercing ray extends well beyond the map, through its chosen target.
                const scale = this.piercing && length ? 10000 / length : 1
                this.beamEnd = { x: this.x + dx * scale, y: this.y + dy * scale }
                const duration = Math.min(deltaTime, this.beamTimer)
                for (const enemy of enemies.filter(
                    (candidate) => candidate.alive && candidate.spawned,
                )) {
                    const bx = this.beamEnd.x - this.x
                    const by = this.beamEnd.y - this.y
                    const squared = bx ** 2 + by ** 2
                    const t = squared
                        ? Math.max(
                              0,
                              Math.min(
                                  1,
                                  ((enemy.x - this.x) * bx + (enemy.y - this.y) * by) / squared,
                              ),
                          )
                        : 0
                    if (Math.hypot(enemy.x - this.x - t * bx, enemy.y - this.y - t * by) <= 10) {
                        enemy.takeDamage(
                            this.damage *
                                this.damageMultiplier *
                                duration *
                                (enemy === target ? 1 : 0.5),
                            this.id,
                        )
                        this.beamHits.push({ x: enemy.x, y: enemy.y })
                    }
                }
            }
            this.beamTimer = Math.max(0, this.beamTimer - deltaTime)
            if (!this.beamTimer) {
                this.fireTimer = this.fireRate
                this.currentTarget = null
            }
        }
        this.updateRotation()
    }
}
export class ShockTower extends Tower {
    stunEffect = false
    stunCooldown = 600

    constructor(x: number, y: number, id: string) {
        super('shock', x, y, id)
        this.setBaseStats()
    }

    protected resetBehaviour(): void {
        this.stunEffect = false
    }

    findTargetAndFire(enemies: Enemy[]): void {
        if (this.fireTimer > 0) return

        let hitAny = false
        this.eligibleTargets(enemies).forEach((enemy) => {
            if (
                enemy.alive &&
                (!this.blindTarget ||
                    enemy.distanceTo(this.blindTarget.x, this.blindTarget.y) <= 10)
            ) {
                enemy.takeDamage(this.damage * this.damageMultiplier, this.id)

                hitAny = true
            }
        })

        if (hitAny) {
            this.fireTimer = this.fireRate
            this.showShockEffect = 30
        }
    }

    update(deltaTime: number, enemies: Enemy[], rng: Random): void {
        super.update(deltaTime, enemies, rng)
        if (this.active && !this.disabled && this.stunEffect) {
            this.stunCooldown = Math.max(0, this.stunCooldown - deltaTime)
            if (!this.stunCooldown) {
                const targets = this.eligibleTargets(enemies).filter(
                    (enemy) =>
                        !this.blindTarget ||
                        enemy.distanceTo(this.blindTarget.x, this.blindTarget.y) <= 10,
                )
                for (const enemy of targets) {
                    const group = targets.filter(
                        (other) => enemy.distanceTo(other.x, other.y) <= 50,
                    )
                    if (group.length >= 3)
                        group.forEach((other) => {
                            other.stunTimer = Math.max(other.stunTimer, 420)
                        })
                }
                this.stunCooldown = 600
            }
        }
        if (this.showShockEffect > 0) {
            this.showShockEffect = Math.max(0, this.showShockEffect - deltaTime)
        }
    }
}
export function createTower(type: TowerType, x: number, y: number, id: string): Tower {
    const constructors = {
        cannon: CannonTower,
        rocket: RocketTower,
        machinegun: MachineGunTower,
        laser: LaserTower,
        shock: ShockTower,
    }
    return new constructors[type](x, y, id)
}
// Slots create a fresh subclass when construction finishes, including after demolition.
export class TowerSlot {
    cooldown = 0
    tower: Tower | null = null
    construction: { type: TowerType; progress: number; time: number } | null = null
    constructor(
        public id: string,
        public x: number,
        public y: number,
        public defaultType: TowerType,
    ) {}
    startConstruction(type: TowerType): boolean {
        if (this.tower || this.construction || this.cooldown > 0) return false
        this.construction = { type, progress: 0, time: 180 }
        return true
    }
    updateConstruction(militaryCount: number, deltaTime: number = 1): boolean {
        this.cooldown = Math.max(0, this.cooldown - deltaTime)
        const construction = this.construction
        if (!construction) return false
        construction.progress += Math.max(1, militaryCount * 0.5) * deltaTime
        if (construction.progress < construction.time) return false
        this.tower = createTower(construction.type, this.x, this.y, this.id)
        this.construction = null
        return true
    }
    destroy(): void {
        this.demolish()
        this.cooldown = 300
    }
    demolish(): void {
        this.tower = null
        this.construction = null
    }
}

export type TowerSnapshot = Pick<
    Tower,
    | 'id'
    | 'type'
    | 'level'
    | 'x'
    | 'y'
    | 'active'
    | 'broken'
    | 'repairing'
    | 'repairProgress'
    | 'repairTime'
    | 'upgrading'
    | 'upgradeProgress'
    | 'upgradeTime'
    | 'disabled'
    | 'disableTimer'
    | 'fireTimer'
    | 'fireRate'
    | 'damage'
    | 'range'
    | 'abilities'
    | 'showShockEffect'
>
