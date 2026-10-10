import { BARRICADE_CATALOG } from '../rules/barricadeCatalog'
import type { BarricadeType } from '../rules/barricadeCatalog'
export class Barricade {
    id: string
    type: BarricadeType
    x = 0
    y = 0
    width = 0
    height = 0
    level = 0
    active = false
    broken = true
    building = false
    buildProgress = 0
    buildTime = 120
    upgrading = false
    upgradeProgress = 0
    upgradeTime = 240
    healthMultiplier = 1
    repairTimer = 0
    pushTimer = 0
    maxHealth = 100
    currentHealth = 100
    selfRepair = false
    repairRate = 0
    damageMitigation = 0.4
    damageToEnemies = 0
    filterSlowMultiplier = 1
    pushBackStrength = 0
    counterDamage = 0
    knockbackEnemies = false
    filterMode = false
    forceField = false
    maxAttackers = Infinity
    currentAttackers: Set<string> = new Set<string>()
    abilities: { name: string; description: string }[] = []

    constructor(
        type: BarricadeType,
        x: number,
        y: number,
        width: number,
        height: number,
        id: string,
    ) {
        this.id = id
        this.type = type
        this.x = x
        this.y = y
        this.width = width
        this.height = height

        this.setStats()
    }

    snapshot(): BarricadeSnapshot {
        return {
            id: this.id,
            type: this.type,
            level: this.level,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            maxHealth: this.maxHealth,
            currentHealth: this.currentHealth,
            active: this.active,
            broken: this.broken,
            building: this.building,
            buildProgress: this.buildProgress,
            buildTime: this.buildTime,
            upgrading: this.upgrading,
            upgradeProgress: this.upgradeProgress,
            upgradeTime: this.upgradeTime,
            abilities: this.abilities.map((ability) => ({ ...ability })),
        }
    }

    setStats(): void {
        this.selfRepair = false
        this.repairRate = 0
        this.damageMitigation = 0.4
        this.damageToEnemies = 0
        this.filterSlowMultiplier = 1
        this.pushBackStrength = 0
        this.counterDamage = 0
        this.knockbackEnemies = false
        this.filterMode = false
        this.forceField = false
        this.maxAttackers = Infinity
        this.resetAbilities()

        if (this.type === 'wall') {
            this.maxHealth = 400
            this.buildTime = 140
            this.damageMitigation = 0.35
            this.pushBackStrength = 3
        } else if (this.type === 'filter') {
            this.maxHealth = 220
            this.buildTime = 160
            this.damageMitigation = 0.45
            this.damageToEnemies = 4
            this.filterSlowMultiplier = 0.45
        } else if (this.type === 'shield') {
            this.maxHealth = 550
            this.buildTime = 200
            this.damageMitigation = 0.25
            this.damageToEnemies = 10
        }

        this.currentHealth = this.maxHealth
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
        const benefits = BARRICADE_CATALOG[this.type].benefits
        if (!benefits) return
        const ability = level >= 1 && level <= 3 ? benefits[level as 1 | 2 | 3] : undefined
        if (ability) {
            this.unlockAbility(ability.name, ability.description)
        }
    }

    resetAttackers(stoppedIds: readonly string[] = []): void {
        for (const id of this.currentAttackers) {
            if (!stoppedIds.includes(id)) this.currentAttackers.delete(id)
        }
    }

    setHealthMultiplier(multiplier: number): void {
        const ratio = multiplier / this.healthMultiplier
        this.maxHealth *= ratio
        this.currentHealth *= ratio
        this.healthMultiplier = multiplier
    }

    startUpgrade(): boolean {
        if (!this.active || this.upgrading || this.level >= 3) return false
        this.upgrading = true
        this.upgradeProgress = 0
        return true
    }

    updateUpgrade(militaryCount: number, deltaTime: number): boolean {
        if (!this.upgrading) return false
        this.upgradeProgress += Math.max(1, militaryCount * 0.3) * deltaTime
        if (this.upgradeProgress < this.upgradeTime) return false
        this.level++
        this.upgrading = false
        this.upgradeProgress = 0
        this.applyUpgrade()
        return true
    }

    canAcceptAttacker(enemyId: string): boolean {
        if (!this.currentAttackers) {
            this.currentAttackers = new Set<string>()
        }
        if (this.currentAttackers.has(enemyId)) return true
        return this.currentAttackers.size < this.maxAttackers
    }

    registerAttacker(enemyId: string): void {
        if (!this.currentAttackers) {
            this.currentAttackers = new Set<string>()
        }
        this.currentAttackers.add(enemyId)
    }

    startBuild(): boolean {
        if (this.active || this.building) return false
        this.building = true
        this.buildProgress = 0
        return true
    }

    updateBuild(militaryCount: number, deltaTime: number = 1): boolean {
        if (!this.building) return false

        const buildSpeed = Math.max(1, militaryCount * 0.4)
        this.buildProgress += buildSpeed * deltaTime

        if (this.buildProgress >= this.buildTime) {
            this.active = true
            this.broken = false
            this.building = false
            this.buildProgress = 0
            this.currentHealth = this.maxHealth
            return true
        }

        return false
    }

    takeDamage(damage: number): void {
        if (!this.active) return
        if (damage <= 0) return

        this.currentHealth -= damage
        if (this.currentHealth <= 0) {
            this.destroy()
        }
    }

    destroy(): void {
        this.active = false
        this.broken = true
        this.currentHealth = 0
        this.upgrading = false
        this.upgradeProgress = 0
    }

    update(deltaTime: number): void {
        if (!this.active) return

        if (this.selfRepair) {
            this.repairTimer += deltaTime
            while (this.repairTimer >= 300) {
                this.repairTimer -= 300
                this.currentHealth = Math.min(
                    this.maxHealth,
                    this.currentHealth + this.maxHealth * 0.05,
                )
            }
        }
        if (this.knockbackEnemies) this.pushTimer += deltaTime
    }

    applyUpgrade(): void {
        if (this.type === 'wall') {
            if (this.level === 1) {
                this.maxHealth = 520 * this.healthMultiplier
                this.currentHealth = this.maxHealth
            }
            if (this.level === 2) this.selfRepair = true
            if (this.level === 3) {
                this.knockbackEnemies = true
                this.pushBackStrength = 30
            }
        } else if (this.type === 'filter') {
            if (this.level === 1) {
                this.maxHealth = 280 * this.healthMultiplier
                this.currentHealth = this.maxHealth
                this.damageToEnemies = 8
            }
            if (this.level === 2) this.selfRepair = true
            if (this.level === 3) this.filterMode = true
        } else if (this.type === 'shield') {
            if (this.level === 1 || this.level === 2) this.currentHealth = this.maxHealth
            if (this.level === 2) this.damageToEnemies = 16
            if (this.level === 3) {
                this.forceField = true
                this.maxAttackers = 5
            }
        }
        this.unlockAbilityByLevel()
    }
}

export type BarricadeSnapshot = Pick<
    Barricade,
    | 'id'
    | 'type'
    | 'level'
    | 'x'
    | 'y'
    | 'width'
    | 'height'
    | 'maxHealth'
    | 'currentHealth'
    | 'active'
    | 'broken'
    | 'building'
    | 'buildProgress'
    | 'buildTime'
    | 'upgrading'
    | 'upgradeProgress'
    | 'upgradeTime'
    | 'abilities'
>
