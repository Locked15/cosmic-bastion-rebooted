import {
    BARRICADE_CATALOG,
    BARRICADE_MAX_LEVEL,
    BARRICADE_SIZE,
    Barricade,
    Conversion,
    Person,
    TOWER_CATALOG,
    TOWER_MAX_LEVEL,
    TowerSlot,
    distance,
    generateWave,
    pointInRect,
    rectsOverlap,
    type BarricadeType,
    type Enemy,
    type EventEffect,
    type Level,
    type LevelEvent,
    type PersonType,
    type Point,
    type Random,
    type StoryDialog,
    type TowerType,
} from '@/domain'
import type { BuildCategory, GameStatus, GameView } from '../dto/views'
import type { Scene, ScenePointer } from './scene'

export const SPEED_STEPS = [0.5, 1, 2, 4, 8] as const
// Story dialogs slow the battle down instead of freezing it.
const DIALOG_SPEED = 0.5
const FPS = 60
const VICTORY_DELAY = 60
const MAX_BREAKTHROUGHS = 10
const SOLDIER_DPS = 6
const PICK_RADIUS = 30
const SLOT_SNAP_RADIUS = 50
const REFUND_RATE = 0.5

export interface SessionResult {
    outcome: 'victory' | 'defeat'
    reason: string
}

export interface ActiveDialog {
    dialog: StoryDialog
    // Real-time frames left before the last choice is picked automatically; null = untimed.
    framesLeft: number | null
}

export interface SessionStats {
    killed: number
    reached: number
    lost: number
    gathered: number
}

export type CommandResult = { ok: true } | { ok: false; error: string }

const ok: CommandResult = { ok: true }
const fail = (error: string): CommandResult => ({ ok: false, error })

// One running level: owns all entities and advances the simulation frame by frame.
export class GameSession implements Scene {
    readonly level: Level
    readonly rng: Random

    resources: number
    miners: number
    military: number
    resourceRate = 0

    currentWave = 0
    waveInProgress = false
    enemies: Enemy[] = []
    enemiesInQuarters: Enemy[] = []
    slots: TowerSlot[]
    barricades: Barricade[] = []
    conversions: Conversion[] = []
    people: Person[] = []

    view: GameView = 'corridor'
    status: GameStatus = 'running'
    result: SessionResult | null = null
    speedIndex = 1
    enemySpeed = 1
    stats: SessionStats = { killed: 0, reached: 0, lost: 0, gathered: 0 }

    activeDialog: ActiveDialog | null = null
    pointer: ScenePointer = {
        world: null,
        build: null,
        slotId: null,
        footprint: null,
        hoverId: null,
    }
    selectedId: string | null = null

    private dialogQueue: StoryDialog[] = []
    private pendingEvents: LevelEvent[]
    private victoryCountdown: number | null = null
    private messages: string[] = []
    private quartersAlert = false
    private scatterTimer = 0
    private regroupStarted = false
    private regroupPoints: Point[] = []

    constructor(level: Level, rng: Random) {
        this.level = level
        this.rng = rng
        this.resources = level.startingResources
        this.miners = level.startingMiners
        this.military = level.startingMilitary
        this.pendingEvents = [...level.events]
        this.slots = level.towerSlots.map(
            (slot) => new TowerSlot(rng.id('slot'), slot.x, slot.y, slot.type),
        )
        this.spawnPeople('miner', this.miners)
        this.spawnPeople('military', this.military)
        this.triggerEvents()
    }

    get speed(): number {
        return SPEED_STEPS[this.speedIndex] ?? 1
    }

    get ended(): boolean {
        return this.status === 'victory' || this.status === 'defeat'
    }

    // Messages produced since the last call (for toasts).
    drainMessages(): string[] {
        const drained = this.messages
        this.messages = []
        return drained
    }

    // ----- Time -----

    // Advance by real elapsed frames, applying speed, pause and dialog slow-down.
    advance(realFrames: number): void {
        if (this.ended || this.status === 'paused') return
        this.tickDialog(realFrames)
        const factor = this.activeDialog ? DIALOG_SPEED : this.speed
        let remaining = realFrames * factor
        // Sub-steps of at most one frame keep collisions stable at high speed.
        while (remaining > 0 && !this.ended) {
            const step = Math.min(1, remaining)
            this.update(step)
            remaining -= step
        }
    }

    update(dt: number): void {
        if (this.ended) return
        if (this.victoryCountdown !== null) {
            this.victoryCountdown -= dt
            if (this.victoryCountdown <= 0) {
                this.finish('victory', '')
                return
            }
        }
        const quartersUnderAttack = this.enemiesInQuarters.length > 0
        this.updateResources(dt, quartersUnderAttack)
        this.updateConversions(dt)
        this.updateTowers(dt, quartersUnderAttack)
        this.updateBarricades(dt)
        this.updateEnemies(dt)
        this.updatePeople(dt)
        this.updateQuarters(dt)
        this.checkDefeat()
    }

    // ----- Commands -----

    togglePause(): void {
        if (this.ended) return
        this.status = this.status === 'paused' ? 'running' : 'paused'
    }

    cycleSpeed(): void {
        this.speedIndex = (this.speedIndex + 1) % SPEED_STEPS.length
        this.messages.push(`Скорость: ×${this.speed}`)
    }

    toggleView(): void {
        this.view = this.view === 'corridor' ? 'living' : 'corridor'
        this.clearBuildMode()
        this.selectedId = null
    }

    startWave(): CommandResult {
        if (this.ended) return fail('Уровень завершён')
        if (this.waveInProgress) return fail('Волна уже идёт')
        if (this.currentWave >= this.level.totalWaves) return fail('Все волны пройдены')
        this.currentWave++
        this.waveInProgress = true
        const path = this.level.getCurrentPath(this.barricades)
        const wave = generateWave(this.currentWave, this.level.waveDifficulty, this.rng)
        for (const enemy of wave) enemy.setPath(path)
        this.enemies.push(...wave)
        this.triggerEvents()
        return ok
    }

    setBuildMode(category: BuildCategory, type: string): void {
        const entry =
            category === 'tower'
                ? TOWER_CATALOG[type as TowerType]
                : BARRICADE_CATALOG[type as BarricadeType]
        if (!entry) return
        this.pointer.build = { category, type, cost: entry.cost, name: entry.name }
        this.selectedId = null
        this.refreshPointer()
    }

    deselect(): void {
        this.selectedId = null
    }

    clearBuildMode(): void {
        this.pointer.build = null
        this.refreshPointer()
    }

    pointerMove(world: Point | null): void {
        this.pointer.world = world
        this.refreshPointer()
    }

    // Primary click in the corridor: place a build or select an object.
    pointerDown(world: Point): CommandResult {
        if (this.view !== 'corridor' || this.status === 'paused' || this.ended) return ok
        this.pointer.world = world
        this.refreshPointer()
        const build = this.pointer.build
        if (!build) {
            this.selectedId = this.pickObject(world)
            return ok
        }
        const result =
            build.category === 'tower'
                ? this.buildTower(this.pointer.slotId, build.type as TowerType)
                : this.buildBarricade(world, build.type as BarricadeType)
        if (result.ok) this.clearBuildMode()
        else this.messages.push(result.error)
        return result
    }

    buildTower(slotId: string | null, type: TowerType): CommandResult {
        const slot = this.slots.find((candidate) => candidate.id === slotId)
        if (!slot) return fail('Выберите свободный слот')
        if (slot.tower || slot.construction) return fail('Слот занят')
        const cost = TOWER_CATALOG[type].cost
        if (this.resources < cost) return fail('Недостаточно ресурсов!')
        this.resources -= cost
        slot.startConstruction(type)
        return ok
    }

    buildBarricade(center: Point, type: BarricadeType): CommandResult {
        const cost = BARRICADE_CATALOG[type].cost
        if (this.resources < cost) return fail('Недостаточно ресурсов!')
        this.resources -= cost
        const half = BARRICADE_SIZE / 2
        const barricade = new Barricade(
            type,
            center.x - half,
            center.y - half,
            BARRICADE_SIZE,
            BARRICADE_SIZE,
            this.rng.id('barricade'),
        )
        barricade.startBuild()
        this.barricades.push(barricade)
        return ok
    }

    upgrade(id: string | null = this.selectedId): CommandResult {
        const slot = this.slots.find((candidate) => candidate.id === id)
        if (slot) return this.upgradeTower(slot)
        const barricade = this.barricades.find((candidate) => candidate.id === id)
        if (barricade) return this.upgradeBarricade(barricade)
        return fail('Ничего не выбрано')
    }

    demolish(id: string | null = this.selectedId): CommandResult {
        const slot = this.slots.find((candidate) => candidate.id === id)
        if (slot) {
            const type = slot.tower?.type ?? slot.construction?.type
            if (!type) return fail('Нечего демонтировать')
            this.resources += Math.floor(TOWER_CATALOG[type].cost * REFUND_RATE)
            slot.demolish()
        } else {
            const barricade = this.barricades.find((candidate) => candidate.id === id)
            if (!barricade) return fail('Нечего демонтировать')
            this.resources += Math.floor(BARRICADE_CATALOG[barricade.type].cost * REFUND_RATE)
            this.barricades = this.barricades.filter((candidate) => candidate !== barricade)
        }
        if (this.selectedId === id) this.selectedId = null
        return ok
    }

    convert(from: PersonType, to: PersonType, count: number): CommandResult {
        if (from === to || count <= 0) return fail('Неверный перевод')
        const available = from === 'miner' ? this.miners : this.military
        if (available < count) {
            return fail(from === 'miner' ? 'Недостаточно шахтёров!' : 'Недостаточно военных!')
        }
        if (from === 'miner') this.miners -= count
        else this.military -= count
        this.conversions.push(new Conversion(from, to, count, this.rng.id('conversion')))
        return ok
    }

    chooseDialog(index: number): CommandResult {
        const active = this.activeDialog
        const choice = active?.dialog.choices[index]
        if (!active || !choice) return fail('Нет такого варианта')
        if (!this.canAfford(choice.effect)) return fail('Недостаточно ресурсов')
        this.activeDialog = null
        this.applyEffect(choice.effect)
        this.openNextDialog()
        return ok
    }

    canAfford(effect: EventEffect | null): boolean {
        if (!effect) return true
        switch (effect.type) {
            case 'resources':
                return this.resources + effect.value >= 0
            case 'removeMilitary':
                return this.military >= effect.count
            case 'superWeapon':
                return this.military + Math.min(0, effect.military) >= 0
            default:
                return true
        }
    }

    // ----- Hit testing -----

    private refreshPointer(): void {
        const { world, build } = this.pointer
        this.pointer.slotId = null
        this.pointer.footprint = null
        this.pointer.hoverId = null
        if (!world || this.view !== 'corridor') return

        if (build?.category === 'tower') {
            this.pointer.slotId = this.nearestFreeSlot(world)?.id ?? null
        } else if (build?.category === 'barricade') {
            const half = BARRICADE_SIZE / 2
            this.pointer.footprint = {
                x: world.x - half,
                y: world.y - half,
                width: BARRICADE_SIZE,
                height: BARRICADE_SIZE,
            }
        } else {
            this.pointer.hoverId = this.pickObject(world)
        }
    }

    private nearestFreeSlot(world: Point): TowerSlot | null {
        let best: TowerSlot | null = null
        let bestDistance = SLOT_SNAP_RADIUS
        for (const slot of this.slots) {
            if (slot.tower || slot.construction) continue
            const d = distance(slot, world)
            if (d < bestDistance) {
                best = slot
                bestDistance = d
            }
        }
        return best
    }

    private pickObject(world: Point): string | null {
        const slot = this.slots.find((candidate) => distance(candidate, world) < PICK_RADIUS)
        if (slot && (slot.tower || slot.construction)) return slot.id
        return this.barricades.find((barricade) => pointInRect(world, barricade))?.id ?? null
    }

    // ----- Upgrades -----

    private upgradeTower(slot: TowerSlot): CommandResult {
        const tower = slot.tower
        if (!tower) return fail('Башня ещё не построена')
        if (tower.upgrading) return fail('Улучшение уже идёт')
        if (tower.level >= TOWER_MAX_LEVEL) return fail('Максимальный уровень')
        const cost = TOWER_CATALOG[tower.type].upgradeCosts[tower.level] ?? Infinity
        if (this.resources < cost) return fail('Недостаточно ресурсов для улучшения!')
        this.resources -= cost
        tower.startUpgrade()
        return ok
    }

    private upgradeBarricade(barricade: Barricade): CommandResult {
        if (!barricade.active) return fail('Баррикада не готова')
        if (barricade.level >= BARRICADE_MAX_LEVEL) return fail('Максимальный уровень')
        const cost = BARRICADE_CATALOG[barricade.type].upgradeCosts[barricade.level] ?? Infinity
        if (this.resources < cost) return fail('Недостаточно ресурсов для усиления!')
        this.resources -= cost
        barricade.level++
        barricade.applyUpgrade()
        return ok
    }

    // ----- Simulation steps -----

    private updateResources(dt: number, quartersUnderAttack: boolean): void {
        if (quartersUnderAttack) {
            this.resourceRate = 0
            return
        }
        this.resourceRate = this.miners * 0.5
        const gain = (this.resourceRate / FPS) * dt
        this.resources += gain
        this.stats.gathered += gain
    }

    private updateConversions(dt: number): void {
        for (const conversion of this.conversions) {
            if (!conversion.update(dt)) continue
            if (conversion.toType === 'military') this.military += conversion.count
            else this.miners += conversion.count
            this.retypePeople(conversion.fromType, conversion.toType, conversion.count)
        }
        this.conversions = this.conversions.filter((conversion) => !conversion.completed)
    }

    private updateTowers(dt: number, quartersUnderAttack: boolean): void {
        for (const slot of this.slots) {
            if (slot.updateConstruction(this.military, dt)) this.completeObjective('repair_tower')
            const tower = slot.tower
            if (!tower) continue
            if (tower.updateUpgrade(this.military, dt)) this.completeObjective('upgrade_tower')
            // Towers hold fire while the living quarters are under attack.
            if (!quartersUnderAttack) tower.update(dt, this.enemies, this.rng)
        }
    }

    private updateBarricades(dt: number): void {
        for (const barricade of this.barricades) {
            if (barricade.building && barricade.updateBuild(this.military, dt)) {
                this.completeObjective('close_breach')
                this.level.floorBreaches.forEach((breach, index) => {
                    if (rectsOverlap(barricade, breach)) this.level.closeBreach(index)
                })
            }
            barricade.update(dt)
            barricade.resetAttackers()
        }
    }

    private updateEnemies(dt: number): void {
        const towers = this.slots.flatMap((slot) => (slot.tower ? [slot.tower] : []))
        const spawned: Enemy[] = []
        const survivors: Enemy[] = []

        for (const enemy of this.enemies) {
            if (!enemy.spawned) {
                enemy.spawnDelay -= dt
                if (enemy.spawnDelay > 0) {
                    survivors.push(enemy)
                    continue
                }
                enemy.spawned = true
            }

            if (enemy.alive) {
                enemy.speed = enemy.baseSpeed * this.enemySpeed
                enemy.update(dt, { towers, enemies: this.enemies, rng: this.rng })
                if (enemy.alive && (enemy.reached || this.level.checkBreachFall(enemy))) {
                    this.breakThrough(enemy)
                    continue
                }
                if (enemy.alive) this.collideWithBarricades(enemy, dt)
            }

            if (enemy.alive) {
                survivors.push(enemy)
            } else {
                this.stats.killed++
                if (enemy.splitPending) enemy.onSplit(this.rng)
                if (enemy.spawnedEnemies.length > 0) spawned.push(...enemy.spawnedEnemies)
                else this.resources += enemy.reward
            }
        }

        this.enemies = [...survivors, ...spawned]

        if (
            this.waveInProgress &&
            this.enemies.length === 0 &&
            this.enemiesInQuarters.length === 0
        ) {
            this.completeWave()
        }
    }

    private collideWithBarricades(enemy: Enemy, dt: number): void {
        for (const barricade of this.barricades) {
            if (!barricade.active || !pointInRect(enemy, barricade)) continue
            // Shields limit how many enemies can damage them at once.
            if (barricade.canAcceptAttacker(enemy.id)) {
                barricade.registerAttacker(enemy.id)
                barricade.takeDamage(enemy.damage * dt * 0.1)
            }
            this.pushBack(enemy, 5)
            if (barricade.damageToEnemies > 0) {
                enemy.takeDamage(barricade.damageToEnemies * dt * 0.1)
            }
            if (barricade.filterSlowMultiplier < 1) enemy.speed *= barricade.filterSlowMultiplier
            if (barricade.pushBackStrength > 0) this.pushBack(enemy, barricade.pushBackStrength)
        }
    }

    private pushBack(enemy: Enemy, amount: number): void {
        const current = enemy.path[enemy.pathIndex]
        const previous = enemy.path[enemy.pathIndex - 1] ?? current
        if (!current || !previous) return
        const length = distance(current, previous)
        if (length === 0) {
            enemy.x -= amount
            return
        }
        enemy.x += ((previous.x - current.x) / length) * amount
        enemy.y += ((previous.y - current.y) / length) * amount
    }

    private breakThrough(enemy: Enemy): void {
        this.stats.reached++
        // The enemy drops into the quarters right where it left the corridor.
        enemy.y = Math.max(enemy.y, this.level.livingQuartersY + 30)
        this.enemiesInQuarters.push(enemy)
        this.startAlert(false)
        this.messages.push('Враг прорвался в жилой отсек!')
    }

    private completeWave(): void {
        this.waveInProgress = false
        if (this.currentWave >= this.level.totalWaves) {
            this.victoryCountdown = VICTORY_DELAY
        } else {
            this.messages.push(`Волна ${this.currentWave} отражена!`)
        }
    }

    private checkDefeat(): void {
        if (this.miners <= 0 && this.military <= 0) {
            this.finish('defeat', 'Весь персонал погиб')
        } else if (this.stats.reached >= MAX_BREAKTHROUGHS) {
            this.finish('defeat', 'Слишком много врагов прорвалось в жилой отсек')
        }
    }

    private finish(outcome: 'victory' | 'defeat', reason: string): void {
        if (this.ended) return
        if (outcome === 'victory') this.completeObjective('survive')
        this.status = outcome
        this.result = { outcome, reason }
        this.activeDialog = null
    }

    private completeObjective(id: string): void {
        const objective = this.level.objectives.find((candidate) => candidate.id === id)
        if (objective && !objective.completed) {
            objective.completed = true
            this.messages.push(`Задача выполнена: ${objective.text}`)
        }
    }

    // ----- Living quarters -----

    private updatePeople(dt: number): void {
        if (this.quartersAlert) {
            this.scatterTimer -= dt
            if (this.scatterTimer <= 0 && !this.regroupStarted) this.beginRegroup()
        }

        for (const person of this.people) {
            if (!person.alive) continue
            if (!this.quartersAlert) {
                person.speed = person.baseSpeed
                person.freezeIdle = false
                person.state = 'idle'
            } else if (person.type === 'military') {
                this.updateSoldierDuringAlert(person)
            } else {
                person.state = 'panic'
                person.speed = person.baseSpeed * 1.3
                if (this.rng.next() < 0.01 * dt) this.setTarget(person, this.randomQuartersPoint())
            }
            const { livingQuartersY, width, height } = this.level
            person.update(dt, livingQuartersY, width, height, this.rng)
        }
    }

    private updateSoldierDuringAlert(person: Person): void {
        if (person.state === 'regroup') {
            if (distance(person, { x: person.targetX, y: person.targetY }) < 6) {
                person.state = 'hold'
                person.freezeIdle = true
                person.speed = person.baseSpeed
                this.setTarget(person, person)
            }
        } else if (person.state === 'hold' && this.regroupPoints.length > 0) {
            const cluster = this.regroupPoints[(person.clusterId ?? 0) % this.regroupPoints.length]
            if (cluster && this.rng.next() < 0.02) {
                this.setTarget(person, {
                    x: cluster.x + (this.rng.next() - 0.5) * 24,
                    y: cluster.y + (this.rng.next() - 0.5) * 24,
                })
            }
        }
    }

    private updateQuarters(dt: number): void {
        if (this.enemiesInQuarters.length === 0) {
            if (this.quartersAlert) this.resetAlert()
            return
        }

        const soldiers = this.people.filter((person) => person.alive && person.type === 'military')
        for (const soldier of soldiers) soldier.isShooting = false

        for (const enemy of this.enemiesInQuarters) {
            enemy.update(dt, { towers: [], enemies: [], rng: this.rng })
            this.chasePeople(enemy)
        }

        for (const soldier of soldiers) {
            const target = this.nearest(soldier, this.enemiesInQuarters)
            if (!target) continue
            target.takeDamage(SOLDIER_DPS * (dt / FPS))
            soldier.isShooting = true
            soldier.shootTimer = Math.max(soldier.shootTimer, 5)
            soldier.shootAngle = Math.atan2(target.y - soldier.y, target.x - soldier.x)
        }

        this.enemiesInQuarters = this.enemiesInQuarters.filter((enemy) => {
            if (enemy.alive) return true
            this.stats.killed++
            this.resources += enemy.reward
            return false
        })
        this.people = this.people.filter((person) => person.alive)

        if (this.enemiesInQuarters.length === 0) this.resetAlert()
    }

    private chasePeople(enemy: Enemy): void {
        if (!enemy.targetPerson?.alive) {
            enemy.targetPerson = this.nearest(
                enemy,
                this.people.filter((person) => person.alive),
            )
        }
        const target = enemy.targetPerson
        if (!target) return
        const d = distance(enemy, target)
        if (d > 10) {
            enemy.x += ((target.x - enemy.x) / d) * enemy.speed * 0.5
            enemy.y += ((target.y - enemy.y) / d) * enemy.speed * 0.5
            return
        }
        target.alive = false
        if (target.type === 'miner') this.miners = Math.max(0, this.miners - 1)
        else this.military = Math.max(0, this.military - 1)
        this.stats.lost++
        enemy.targetPerson = null
        this.startAlert(true)
    }

    private startAlert(force: boolean): void {
        if (this.quartersAlert && !force) return
        this.quartersAlert = true
        this.scatterTimer = 240
        this.regroupStarted = false
        this.regroupPoints = []
        for (const person of this.people) {
            if (!person.alive) continue
            person.isShooting = false
            person.shootTimer = 0
            person.clusterId = null
            const soldier = person.type === 'military'
            person.state = soldier ? 'scatter' : 'panic'
            person.freezeIdle = soldier
            person.speed = person.baseSpeed * (soldier ? 1.6 : 1.3)
            this.setTarget(person, this.randomQuartersPoint())
        }
    }

    private beginRegroup(): void {
        this.regroupStarted = true
        this.regroupPoints = this.makeRegroupPoints(3)
        let index = 0
        for (const person of this.people) {
            if (!person.alive || person.type !== 'military') continue
            const clusterId = index++ % this.regroupPoints.length
            const cluster = this.regroupPoints[clusterId]!
            person.state = 'regroup'
            person.freezeIdle = true
            person.speed = person.baseSpeed
            person.clusterId = clusterId
            this.setTarget(person, {
                x: cluster.x + (this.rng.next() - 0.5) * 60,
                y: cluster.y + (this.rng.next() - 0.5) * 40,
            })
        }
    }

    private resetAlert(): void {
        this.quartersAlert = false
        this.scatterTimer = 0
        this.regroupStarted = false
        this.regroupPoints = []
        for (const person of this.people) {
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
            x: Math.min(width - 60, Math.max(60, padding + spacing * i)),
            y: Math.min(
                height - 80,
                Math.max(livingQuartersY + 60, livingQuartersY + 120 + (i % 2) * 40),
            ),
        }))
    }

    private randomQuartersPoint(): Point {
        const { width, height, livingQuartersY } = this.level
        return {
            x: 60 + this.rng.next() * (width - 120),
            y: livingQuartersY + 60 + this.rng.next() * (height - livingQuartersY - 120),
        }
    }

    private setTarget(person: Person, point: Point): void {
        person.targetX = point.x
        person.targetY = point.y
    }

    private nearest<T extends Point>(from: Point, candidates: T[]): T | null {
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

    // ----- Personnel figures -----

    private spawnPeople(type: PersonType, count: number): void {
        const { width, livingQuartersY } = this.level
        for (let i = 0; i < count; i++) {
            const soldiers = this.people.filter((person) => person.type === 'military').length
            const position =
                type === 'military'
                    ? { x: 50 + soldiers * 30, y: livingQuartersY + 50 }
                    : {
                          x: 100 + this.rng.next() * (width - 200),
                          y: livingQuartersY + 100 + this.rng.next() * 200,
                      }
            this.people.push(new Person(type, position.x, position.y, this.rng.id('person')))
        }
    }

    private removePeople(type: PersonType, count: number): number {
        const field = type === 'military' ? 'military' : 'miners'
        const removed = Math.min(count, this[field])
        this[field] -= removed
        for (let i = 0; i < removed; i++) {
            const index = this.people.findIndex((person) => person.alive && person.type === type)
            if (index !== -1) this.people.splice(index, 1)
        }
        return removed
    }

    private retypePeople(from: PersonType, to: PersonType, count: number): void {
        const candidates = this.people.filter((person) => person.alive && person.type === from)
        for (const person of candidates.slice(0, count)) {
            person.type = to
            person.baseSpeed = to === 'military' ? 1.5 : 1.1
            person.speed = person.baseSpeed
        }
    }

    private addPersonnel(type: PersonType, count: number): void {
        if (count <= 0) return
        if (type === 'military') this.military += count
        else this.miners += count
        this.spawnPeople(type, count)
    }

    // ----- Story events -----

    private triggerEvents(): void {
        const due = this.pendingEvents.filter((event) => event.wave === this.currentWave)
        this.pendingEvents = this.pendingEvents.filter((event) => !due.includes(event))
        this.dialogQueue.push(...due.map((event) => event.dialog))
        if (!this.activeDialog) this.openNextDialog()
    }

    private openNextDialog(): void {
        const dialog = this.dialogQueue.shift()
        this.activeDialog = dialog
            ? {
                  dialog,
                  framesLeft: dialog.timed && dialog.timeLimit ? dialog.timeLimit * FPS : null,
              }
            : null
    }

    private tickDialog(realFrames: number): void {
        const active = this.activeDialog
        if (!active || active.framesLeft === null) return
        active.framesLeft -= realFrames
        if (active.framesLeft > 0) return
        // Time is up: take the last option the player can afford.
        const choices = active.dialog.choices
        for (let index = choices.length - 1; index >= 0; index--) {
            if (this.canAfford(choices[index]!.effect)) {
                this.chooseDialog(index)
                return
            }
        }
        this.activeDialog = null
        this.openNextDialog()
    }

    private applyEffect(effect: EventEffect | null): void {
        if (!effect) return
        switch (effect.type) {
            case 'resources':
                this.resources += effect.value
                this.addPersonnel('military', effect.military ?? 0)
                break
            case 'convert':
                this.convert('miner', 'military', Math.min(effect.count, this.miners))
                break
            case 'addMilitary':
                this.addPersonnel('military', effect.count)
                break
            case 'addMiners':
                this.addPersonnel('miner', effect.count)
                break
            case 'addPersonnel':
                this.addPersonnel('miner', effect.miners)
                this.addPersonnel('military', effect.military)
                break
            case 'removeMilitary':
                this.removePeople('military', effect.count)
                this.resources += effect.resources
                break
            case 'emergency':
                this.resources += effect.resources
                this.addPersonnel('military', effect.military)
                break
            case 'superWeapon': {
                if (effect.military < 0) this.removePeople('military', -effect.military)
                else this.addPersonnel('military', effect.military)
                const alive = this.enemies.filter((enemy) => enemy.alive && enemy.spawned)
                const kills = Math.floor(alive.length * effect.killPercent)
                for (let i = 0; i < kills; i++) {
                    const index = Math.floor(this.rng.next() * alive.length)
                    alive.splice(index, 1)[0]?.die()
                }
                break
            }
            case 'buffDamage':
            case 'buffBarricades':
                // Not implemented yet, see TODO.md.
                break
        }
    }
}
