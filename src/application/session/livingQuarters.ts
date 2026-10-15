import { distance, type Enemy, type Level, type Person, type Point, type Random } from '@/domain'
import type { Personnel } from './personnel'

const FPS = 60
const SOLDIER_DPS = 6
const SCATTER_FRAMES = 240
// Soldiers back off from enemies closer than this, slower than the slowest enemy.
const SOLDIER_KEEP_DISTANCE = 90
const SOLDIER_RETREAT_SPEED = 0.6

export interface QuartersReport {
    killed: Enemy[]
    lost: number
}

// Living quarters: enemies that broke through hunt people, soldiers defend, miners panic.
export class LivingQuarters {
    enemies: Enemy[] = []
    private alert = false
    private scatterTimer = 0
    private regroupStarted = false
    private regroupPoints: Point[] = []

    constructor(
        private readonly level: Level,
        private readonly personnel: Personnel,
        private readonly rng: Random,
        // Multiplies the Guard's damage (meta upgrades).
        private readonly soldierDamage = 1,
    ) {}

    get underAttack(): boolean {
        return this.enemies.length > 0
    }

    admit(enemy: Enemy): void {
        // The enemy drops into the quarters right where it left the corridor.
        enemy.y = Math.max(enemy.y, this.level.livingQuartersY + 30)
        this.enemies.push(enemy)
        this.startAlert(false)
    }

    update(dt: number): QuartersReport {
        this.updatePeople(dt)
        const report: QuartersReport = { killed: [], lost: 0 }
        if (!this.underAttack) {
            if (this.alert) this.resetAlert()
            return report
        }

        const soldiers = this.personnel.people.filter(
            (person) => person.alive && person.type === 'military',
        )
        for (const soldier of soldiers) soldier.isShooting = false

        const offspring: Enemy[] = []
        for (const enemy of this.enemies) {
            // No towers here, but abilities like spawn/absorb still work among enemies.
            enemy.update(dt, { towers: [], enemies: this.enemies, rng: this.rng, slots: [] })
            offspring.push(...this.takeOffspring(enemy))
            if (enemy.alive && this.chasePeople(enemy)) report.lost++
        }

        for (const soldier of soldiers) {
            const target = nearest(soldier, this.enemies)
            if (!target) continue
            target.takeDamage(SOLDIER_DPS * this.soldierDamage * (dt / FPS))
            soldier.isShooting = true
            soldier.shootTimer = Math.max(soldier.shootTimer, 5)
            soldier.shootAngle = Math.atan2(target.y - soldier.y, target.x - soldier.x)
            this.retreatFrom(soldier, target, dt)
        }

        this.enemies = this.enemies.filter((enemy) => {
            if (enemy.alive) return true
            if (enemy.splitPending) enemy.onSplit(this.rng)
            offspring.push(...this.takeOffspring(enemy))
            report.killed.push(enemy)
            return false
        })
        for (const child of offspring) this.admitOffspring(child)
        this.personnel.removeDead()
        if (!this.underAttack) this.resetAlert()
        return report
    }

    // Enemies split off or spawned by an enemy inside the quarters stay inside.
    private takeOffspring(enemy: Enemy): Enemy[] {
        const children = enemy.spawnedEnemies
        enemy.spawnedEnemies = []
        return children
    }

    private admitOffspring(child: Enemy): void {
        child.spawned = true
        child.spawnDelay = 0
        child.y = Math.max(child.y, this.level.livingQuartersY + 30)
        this.enemies.push(child)
    }

    private updatePeople(dt: number): void {
        if (this.alert) {
            this.scatterTimer -= dt
            if (this.scatterTimer <= 0 && !this.regroupStarted) this.beginRegroup()
        }
        const { livingQuartersY, width, height } = this.level
        for (const person of this.personnel.people) {
            if (!person.alive) continue
            if (!this.alert) {
                person.speed = person.baseSpeed
                person.freezeIdle = false
                person.state = 'idle'
            } else if (person.type === 'military') {
                this.updateSoldier(person)
            } else {
                person.state = 'panic'
                person.speed = person.baseSpeed * 1.3
                if (this.rng.next() < 0.01 * dt) setTarget(person, this.randomPoint())
            }
            person.update(dt, livingQuartersY, width, height, this.rng)
        }
    }

    private updateSoldier(person: Person): void {
        if (person.state === 'regroup') {
            if (distance(person, { x: person.targetX, y: person.targetY }) < 6) {
                person.state = 'hold'
                person.freezeIdle = true
                person.speed = person.baseSpeed
                setTarget(person, person)
            }
        } else if (person.state === 'hold' && this.regroupPoints.length > 0) {
            const cluster = this.regroupPoints[(person.clusterId ?? 0) % this.regroupPoints.length]
            if (cluster && this.rng.next() < 0.02) {
                setTarget(person, {
                    x: cluster.x + (this.rng.next() - 0.5) * 24,
                    y: cluster.y + (this.rng.next() - 0.5) * 24,
                })
            }
        }
    }

    // Shooting soldiers step back from an enemy that gets too close.
    private retreatFrom(soldier: Person, enemy: Enemy, dt: number): void {
        const d = distance(soldier, enemy)
        if (d === 0 || d > SOLDIER_KEEP_DISTANCE) return
        const step = SOLDIER_RETREAT_SPEED * dt
        const { livingQuartersY, width, height } = this.level
        soldier.x = clamp(soldier.x + ((soldier.x - enemy.x) / d) * step, 20, width - 20)
        soldier.y = clamp(
            soldier.y + ((soldier.y - enemy.y) / d) * step,
            livingQuartersY + 20,
            height - 20,
        )
        setTarget(soldier, soldier)
    }

    // Returns true when the enemy killed someone.
    private chasePeople(enemy: Enemy): boolean {
        if (!enemy.targetPerson?.alive) {
            enemy.targetPerson = nearest(
                enemy,
                this.personnel.people.filter((person) => person.alive),
            )
        }
        const target = enemy.targetPerson
        if (!target) return false
        const d = distance(enemy, target)
        if (d > 10) {
            enemy.x += ((target.x - enemy.x) / d) * enemy.speed * 0.5
            enemy.y += ((target.y - enemy.y) / d) * enemy.speed * 0.5
            return false
        }
        this.personnel.kill(target)
        enemy.targetPerson = null
        this.startAlert(true)
        return true
    }

    private startAlert(force: boolean): void {
        if (this.alert && !force) return
        this.alert = true
        this.scatterTimer = SCATTER_FRAMES
        this.regroupStarted = false
        this.regroupPoints = []
        for (const person of this.personnel.people) {
            if (!person.alive) continue
            const soldier = person.type === 'military'
            person.isShooting = false
            person.shootTimer = 0
            person.clusterId = null
            person.state = soldier ? 'scatter' : 'panic'
            person.freezeIdle = soldier
            person.speed = person.baseSpeed * (soldier ? 1.6 : 1.3)
            setTarget(person, this.randomPoint())
        }
    }

    private beginRegroup(): void {
        this.regroupStarted = true
        this.regroupPoints = this.makeRegroupPoints(3)
        let index = 0
        for (const person of this.personnel.people) {
            if (!person.alive || person.type !== 'military') continue
            const clusterId = index++ % this.regroupPoints.length
            const cluster = this.regroupPoints[clusterId]!
            person.state = 'regroup'
            person.freezeIdle = true
            person.speed = person.baseSpeed
            person.clusterId = clusterId
            setTarget(person, {
                x: cluster.x + (this.rng.next() - 0.5) * 60,
                y: cluster.y + (this.rng.next() - 0.5) * 40,
            })
        }
    }

    private resetAlert(): void {
        this.alert = false
        this.scatterTimer = 0
        this.regroupStarted = false
        this.regroupPoints = []
        for (const person of this.personnel.people) {
            person.state = 'idle'
            person.freezeIdle = false
            person.speed = person.baseSpeed
            person.isShooting = false
            person.shootTimer = 0
        }
    }

    private makeRegroupPoints(count: number): Point[] {
        const { width, height, livingQuartersY } = this.level
        const padding = 120
        const spacing = count > 1 ? Math.max(0, width - padding * 2) / (count - 1) : 0
        return Array.from({ length: count }, (_, i) => ({
            x: clamp(padding + spacing * i, 60, width - 60),
            y: clamp(livingQuartersY + 120 + (i % 2) * 40, livingQuartersY + 60, height - 80),
        }))
    }

    private randomPoint(): Point {
        const { width, height, livingQuartersY } = this.level
        return {
            x: 60 + this.rng.next() * (width - 120),
            y: livingQuartersY + 60 + this.rng.next() * (height - livingQuartersY - 120),
        }
    }
}

function setTarget(person: Person, point: Point): void {
    person.targetX = point.x
    person.targetY = point.y
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

export function nearest<T extends Point>(from: Point, candidates: readonly T[]): T | null {
    let best: T | null = null
    let bestDistance = Infinity
    for (const candidate of candidates) {
        const d = distance(from, candidate)
        if (d < bestDistance) {
            best = candidate
            bestDistance = d
        }
    }
    return best
}
