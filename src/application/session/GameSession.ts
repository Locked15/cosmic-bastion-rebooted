import {
    BARRICADE_CATALOG,
    BARRICADE_MAX_LEVEL,
    BARRICADE_SIZE,
    Barricade,
    TOWER_CATALOG,
    TOWER_MAX_LEVEL,
    TowerSlot,
    distance,
    generateWave,
    lineIntersectsRect,
    pointInRect,
    rectsOverlap,
    type BarricadeType,
    type Enemy,
    type EventEffect,
    type Level,
    type PersonType,
    type Point,
    type Random,
    type Rect,
    type TowerType,
} from '@/domain'
import type { BuildCategory, GameStatus, GameView } from '../dto/views'
import { applyEffect, canAfford } from './effects'
import { LivingQuarters } from './livingQuarters'
import { ObjectiveTracker } from './objectives'
import { Personnel } from './personnel'
import type { Scene, ScenePointer } from './scene'
import { StoryDirector, type ActiveDialog } from './story'

export type { ActiveDialog } from './story'

export const SPEED_STEPS = [0.5, 1, 2, 4, 8] as const
// Story dialogs slow the battle down instead of freezing it.
const DIALOG_SPEED = 0.5
const FPS = 60
const VICTORY_DELAY = 60
const MAX_BREAKTHROUGHS = 10
const PICK_RADIUS = 30
const SLOT_SNAP_RADIUS = 50
const REFUND_RATE = 0.5
const UPGRADE_LOCKED = 'Этот уровень улучшения ещё не открыт'
// Filter barricades slow the enemies they let through for 5 seconds.
const FILTER_SLOW_FRAMES = 5 * FPS

// Campaign context a level starts with.
export interface SessionOptions {
    unlockedTowers?: readonly TowerType[]
    unlockedBarricades?: readonly BarricadeType[]
    // Story flags carried over from earlier levels (choices, redirected refugees, …).
    campaignFlags?: Readonly<Record<string, number>>
}

export const DEFAULT_TOWERS: readonly TowerType[] = ['cannon', 'machinegun', 'rocket']
export const DEFAULT_BARRICADES: readonly BarricadeType[] = ['wall', 'filter']

export interface SessionResult {
    outcome: 'victory' | 'defeat'
    reason: string
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
const result = (error: string | null): CommandResult => (error ? fail(error) : ok)

interface MoveState {
    pathIndex: number
    distanceOnSegment: number
    x: number
    y: number
}

// One running level: owns all entities and advances the simulation frame by frame.
export class GameSession implements Scene {
    readonly level: Level
    readonly rng: Random
    readonly personnel: Personnel
    readonly quarters: LivingQuarters
    readonly story: StoryDirector
    readonly objectives: ObjectiveTracker
    readonly unlockedTowers: readonly TowerType[]
    readonly unlockedBarricades: readonly BarricadeType[]

    resources: number
    resourceRate = 0
    currentWave = 0
    waveInProgress = false
    enemies: Enemy[] = []
    slots: TowerSlot[]
    barricades: Barricade[] = []

    view: GameView = 'corridor'
    status: GameStatus = 'running'
    result: SessionResult | null = null
    speedIndex = 1
    enemySpeed = 1
    // Story buffs: multiply tower damage and barricade durability.
    damageMultiplier = 1
    barricadeMultiplier = 1
    stats: SessionStats = { killed: 0, reached: 0, lost: 0, gathered: 0 }

    pointer: ScenePointer = {
        world: null,
        build: null,
        slotId: null,
        footprint: null,
        footprintValid: false,
        hoverId: null,
    }
    selectedId: string | null = null

    private victoryCountdown: number | null = null
    private messages: string[] = []

    constructor(level: Level, rng: Random, options: SessionOptions = {}) {
        this.level = level
        this.rng = rng
        this.unlockedTowers = options.unlockedTowers ?? DEFAULT_TOWERS
        this.unlockedBarricades = options.unlockedBarricades ?? DEFAULT_BARRICADES
        this.objectives = new ObjectiveTracker(level)
        this.resources = level.startingResources
        this.personnel = new Personnel(level, rng, level.startingMiners, level.startingMilitary)
        this.quarters = new LivingQuarters(level, this.personnel, rng)
        this.story = new StoryDirector(
            level.events,
            {
                canAfford: (effect) => this.canAfford(effect),
                applyEffect: (effect) => applyEffect(this, effect),
            },
            options.campaignFlags ?? {},
        )
        this.slots = level.towerSlots.map(
            (slot) => new TowerSlot(rng.id('slot'), slot.x, slot.y, slot.type),
        )
        this.story.onWaveStart(0)
    }

    // ----- Scene / read model -----

    get miners(): number {
        return this.personnel.miners
    }

    get military(): number {
        return this.personnel.military
    }

    get inTransit(): number {
        return this.personnel.inTransit
    }

    get people() {
        return this.personnel.people
    }

    get conversions() {
        return this.personnel.conversions
    }

    get enemiesInQuarters(): Enemy[] {
        return this.quarters.enemies
    }

    get activeDialog(): ActiveDialog | null {
        return this.story.active
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

    canAfford(effect: EventEffect | null): boolean {
        return canAfford(this, effect)
    }

    applyDamageBuff(multiplier: number): void {
        this.damageMultiplier *= multiplier
        for (const slot of this.slots) {
            for (const projectile of slot.tower?.projectiles ?? []) projectile.damage *= multiplier
        }
    }

    applyBarricadeBuff(multiplier: number): void {
        this.barricadeMultiplier *= multiplier
        for (const barricade of this.barricades)
            barricade.setHealthMultiplier(this.barricadeMultiplier)
    }

    // ----- Time -----

    // Advance by real elapsed frames, applying speed, pause and dialog slow-down.
    advance(realFrames: number): void {
        if (this.ended || this.status === 'paused') return
        this.story.tick(realFrames)
        const factor = this.story.active ? DIALOG_SPEED : this.speed
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
        const quartersUnderAttack = this.quarters.underAttack
        this.updateResources(dt, quartersUnderAttack)
        this.personnel.updateConversions(dt)
        this.updateTowers(dt, quartersUnderAttack)
        this.updateBarricades(dt)
        this.updateEnemies(dt)
        this.updateQuarters(dt)
        for (const text of this.objectives.update(this))
            this.messages.push(`Задача выполнена: ${text}`)
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
        this.story.onWaveStart(this.currentWave)
        return ok
    }

    chooseDialog(index: number): CommandResult {
        return result(this.story.choose(index))
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

    clearBuildMode(): void {
        this.pointer.build = null
        this.refreshPointer()
    }

    deselect(): void {
        this.selectedId = null
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
        const outcome =
            build.category === 'tower'
                ? this.buildTower(this.pointer.slotId, build.type as TowerType)
                : this.buildBarricade(world, build.type as BarricadeType)
        if (outcome.ok) this.clearBuildMode()
        else this.messages.push(outcome.error)
        return outcome
    }

    buildTower(slotId: string | null, type: TowerType): CommandResult {
        const slot = this.slots.find((candidate) => candidate.id === slotId)
        if (!slot) return fail('Выберите свободный слот')
        if (slot.tower || slot.construction) return fail('Слот занят')
        if (slot.cooldown > 0) return fail('Слот восстанавливается после уничтожения')
        const cost = TOWER_CATALOG[type].cost
        if (this.resources < cost) return fail('Недостаточно ресурсов!')
        this.resources -= cost
        slot.startConstruction(type)
        return ok
    }

    // `point` is where the player clicked; the barricade snaps onto the track or a breach.
    buildBarricade(point: Point, type: BarricadeType): CommandResult {
        const placement = this.barricadePlacement(point)
        if (!placement) return fail('Баррикаду можно ставить только на путь врагов или пролом')
        if (this.barricadeAt(placement)) return fail('Здесь уже стоит баррикада')
        const cost = BARRICADE_CATALOG[type].cost
        if (this.resources < cost) return fail('Недостаточно ресурсов!')
        this.resources -= cost
        this.buildBarricadeAt(placement, type)
        return ok
    }

    // Starts construction of a barricade on an already validated area (also used by checkpoints).
    buildBarricadeAt(area: Rect, type: BarricadeType): Barricade {
        const barricade = new Barricade(
            type,
            area.x,
            area.y,
            area.width,
            area.height,
            this.rng.id('barricade'),
        )
        barricade.setHealthMultiplier(this.barricadeMultiplier)
        barricade.startBuild()
        this.barricades.push(barricade)
        return barricade
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
        return result(this.personnel.startConversion(from, to, count))
    }

    // ----- Placement and hit testing -----

    barricadePlacement(point: Point): Rect | null {
        return this.level.barricadePlacement(point, BARRICADE_SIZE)
    }

    private barricadeAt(area: Rect): Barricade | null {
        return this.barricades.find((barricade) => rectsOverlap(barricade, area)) ?? null
    }

    private refreshPointer(): void {
        const { world, build } = this.pointer
        this.pointer.slotId = null
        this.pointer.footprint = null
        this.pointer.footprintValid = false
        this.pointer.hoverId = null
        if (!world || this.view !== 'corridor') return

        if (build?.category === 'tower') {
            this.pointer.slotId = this.nearestFreeSlot(world)?.id ?? null
        } else if (build?.category === 'barricade') {
            const placement = this.barricadePlacement(world)
            const half = BARRICADE_SIZE / 2
            this.pointer.footprint = placement ?? {
                x: world.x - half,
                y: world.y - half,
                width: BARRICADE_SIZE,
                height: BARRICADE_SIZE,
            }
            this.pointer.footprintValid = !!placement && !this.barricadeAt(placement)
        } else {
            this.pointer.hoverId = this.pickObject(world)
        }
    }

    private nearestFreeSlot(world: Point): TowerSlot | null {
        let best: TowerSlot | null = null
        let bestDistance = SLOT_SNAP_RADIUS
        for (const slot of this.slots) {
            if (slot.tower || slot.construction || slot.cooldown > 0) continue
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

    // Highest upgrade level unlocked by the campaign tech tree.
    get upgradeTier(): number {
        return this.story.flags.tech_upgrade_tier ?? TOWER_MAX_LEVEL
    }

    private upgradeTower(slot: TowerSlot): CommandResult {
        const tower = slot.tower
        if (!tower) return fail('Башня ещё не построена')
        if (tower.level >= this.upgradeTier) return fail(UPGRADE_LOCKED)
        if (!tower.active) return fail('Башня неактивна')
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
        if (barricade.level >= this.upgradeTier) return fail(UPGRADE_LOCKED)
        if (barricade.upgrading) return fail('Улучшение уже идёт')
        if (barricade.level >= BARRICADE_MAX_LEVEL) return fail('Максимальный уровень')
        const cost = BARRICADE_CATALOG[barricade.type].upgradeCosts[barricade.level] ?? Infinity
        if (this.resources < cost) return fail('Недостаточно ресурсов для усиления!')
        this.resources -= cost
        barricade.startUpgrade()
        return ok
    }

    // ----- Simulation steps -----

    // Miners only produce during a wave, so idling between waves cannot farm resources.
    private updateResources(dt: number, quartersUnderAttack: boolean): void {
        if (!this.waveInProgress || quartersUnderAttack) {
            this.resourceRate = 0
            return
        }
        this.resourceRate = this.personnel.miners * 0.5
        const gain = (this.resourceRate / FPS) * dt
        this.resources += gain
        this.stats.gathered += gain
    }

    private updateTowers(dt: number, quartersUnderAttack: boolean): void {
        const military = this.personnel.military
        const towers = this.slots.flatMap((slot) => (slot.tower ? [slot.tower] : []))
        for (const enemy of this.enemies) {
            if (enemy.alive && enemy.spawned) enemy.prepareCombat(towers, this.rng)
        }
        for (const slot of this.slots) {
            if (slot.updateConstruction(military, dt)) this.completeObjective('repair_tower')
            const tower = slot.tower
            if (!tower) continue
            if (tower.updateUpgrade(military, dt)) this.completeObjective('upgrade_tower')
            tower.damageMultiplier = this.damageMultiplier
            // Towers hold fire while the living quarters are under attack.
            if (!quartersUnderAttack) tower.update(dt, this.enemies, this.rng)
            else tower.holdFire(dt)
        }
    }

    private updateBarricades(dt: number): void {
        for (const barricade of this.barricades) {
            if (barricade.building && barricade.updateBuild(this.personnel.military, dt)) {
                if (this.level.floorBreaches.some((breach) => rectsOverlap(barricade, breach))) {
                    this.completeObjective('close_breach')
                }
            }
            barricade.setHealthMultiplier(this.barricadeMultiplier)
            barricade.updateUpgrade(this.personnel.military, dt)
            barricade.update(dt)
            barricade.resetAttackers(
                this.enemies
                    .filter(
                        (enemy) =>
                            enemy.alive && enemy.spawned && enemy._barricadeId === barricade.id,
                    )
                    .map((enemy) => enemy.id),
            )
            if (barricade.pushTimer >= 300) {
                barricade.pushTimer %= 300
                for (const enemy of this.enemies) {
                    if (enemy.alive && enemy._barricadeId === barricade.id) {
                        enemy.knockBack(barricade.pushBackStrength)
                        enemy._barricadeId = null
                    }
                }
            }
        }
        // A breach stays sealed only while an intact barricade covers it.
        for (const breach of this.level.floorBreaches) {
            breach.closed = this.barricades.some(
                (barricade) => barricade.active && rectsOverlap(barricade, breach),
            )
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
                enemy._barricadeId = null
                const before = saveMove(enemy)
                const teleported = enemy.abilityStates.hasTeleported
                const ambushed = enemy.abilityStates.ambushed
                enemy.update(dt, {
                    towers,
                    enemies: this.enemies,
                    rng: this.rng,
                    slots: this.slots,
                })
                if (
                    enemy.alive &&
                    teleported === enemy.abilityStates.hasTeleported &&
                    ambushed === enemy.abilityStates.ambushed
                )
                    this.resolveBarricades(enemy, before, dt)
                if (enemy.alive && (enemy.reached || this.level.checkBreachFall(enemy))) {
                    this.breakThrough(enemy)
                    continue
                }
            }

            if (enemy.alive) {
                survivors.push(enemy)
                spawned.push(...enemy.spawnedEnemies)
                enemy.spawnedEnemies = []
            } else {
                this.stats.killed++
                if (enemy.splitPending) enemy.onSplit(this.rng)
                if (enemy.spawnedEnemies.length > 0) spawned.push(...enemy.spawnedEnemies)
                else this.resources += enemy.reward
            }
        }

        this.enemies = [...survivors, ...spawned]

        if (this.waveInProgress && this.enemies.length === 0 && !this.quarters.underAttack) {
            this.completeWave()
        }
    }

    // Barricades stop an enemy in front of them until they are destroyed.
    private resolveBarricades(enemy: Enemy, before: MoveState, dt: number): void {
        for (const barricade of this.barricades) {
            if (!barricade.active) continue
            const touches =
                lineIntersectsRect(before, enemy, barricade) || pointInRect(enemy, barricade)
            if (!touches) continue

            if (this.passesFilter(barricade, enemy)) {
                enemy.slowMultiplier = Math.min(
                    enemy.slowMultiplier,
                    barricade.filterSlowMultiplier,
                )
                enemy.slowTimer = Math.max(enemy.slowTimer, FILTER_SLOW_FRAMES)
                continue
            }

            restoreMove(enemy, before)
            enemy.reached = false
            enemy._barricadeId = barricade.id
            // Shields limit how many enemies can damage them at once.
            if (barricade.canAcceptAttacker(enemy.id)) {
                barricade.registerAttacker(enemy.id)
                barricade.takeDamage(enemy.mass * dt * 0.1)
            }
            if (barricade.damageToEnemies > 0) {
                enemy.takeDamage((barricade.damageToEnemies * dt) / FPS)
                if (!enemy.alive) barricade.currentAttackers.delete(enemy.id)
            }
            return
        }
    }

    // A fully upgraded filter lets small enemies through (slowed) and stops the rest.
    private passesFilter(barricade: Barricade, enemy: Enemy): boolean {
        return barricade.type === 'filter' && barricade.filterMode && enemy.size === 'small'
    }

    private breakThrough(enemy: Enemy): void {
        this.stats.reached++
        this.quarters.admit(enemy)
        this.messages.push('Враг прорвался в жилой отсек!')
    }

    private updateQuarters(dt: number): void {
        const report = this.quarters.update(dt)
        this.stats.lost += report.lost
        for (const enemy of report.killed) {
            this.stats.killed++
            this.resources += enemy.reward
        }
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
        if (this.personnel.total <= 0 && this.personnel.inTransit <= 0) {
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
        this.story.close()
    }

    private completeObjective(id: string): void {
        const text = this.objectives.complete(id)
        if (text) this.messages.push(`Задача выполнена: ${text}`)
    }
}

function saveMove(enemy: Enemy): MoveState {
    return {
        pathIndex: enemy.pathIndex,
        distanceOnSegment: enemy.distanceOnSegment,
        x: enemy.x,
        y: enemy.y,
    }
}

function restoreMove(enemy: Enemy, state: MoveState): void {
    enemy.pathIndex = state.pathIndex
    enemy.distanceOnSegment = state.distanceOnSegment
    enemy.x = state.x
    enemy.y = state.y
}
