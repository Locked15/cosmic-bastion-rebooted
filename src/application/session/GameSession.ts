import {
    BARRICADE_CATALOG,
    BARRICADE_MAX_LEVEL,
    BARRICADE_SIZE,
    Barricade,
    DEFAULT_DIFFICULTY,
    DIFFICULTIES,
    SWARM_MEMORY_RULES,
    assignRoutes,
    sectorDepth,
    TOWER_CATALOG,
    barricadeRepairCost,
    TOWER_MAX_LEVEL,
    TowerSlot,
    NO_BONUSES,
    distance,
    generateWave,
    lineIntersectsRect,
    pointInRect,
    rectsOverlap,
    type BarricadeType,
    type DifficultyId,
    type Enemy,
    type EnemyAbility,
    type MetaBonuses,
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
import { ObjectiveTracker, type ObjectiveEvent } from './objectives'
import { Personnel } from './personnel'
import { SessionOverrides } from './overrides'
import type { Scene, ScenePointer } from './scene'
import { StoryDirector, type ActiveDialog } from './story'

export type { ActiveDialog } from './story'

export const SPEED_STEPS = [0.5, 1, 2, 4, 8] as const
const FPS = 60
const VICTORY_DELAY = 60
const PICK_RADIUS = 30
const SLOT_SNAP_RADIUS = 50
export const REFUND_RATE = DIFFICULTIES[DEFAULT_DIFFICULTY].refundRate
const UPGRADE_LOCKED = 'Этот уровень улучшения ещё не открыт'
// Filter barricades slow the enemies they let through for 5 seconds.
const FILTER_SLOW_FRAMES = 5 * FPS

// Campaign context a level starts with.
export interface SessionOptions {
    unlockedTowers?: readonly TowerType[]
    unlockedBarricades?: readonly BarricadeType[]
    // Story flags carried over from earlier levels (choices, redirected refugees, …).
    campaignFlags?: Readonly<Record<string, number>>
    difficulty?: DifficultyId
    depth?: number
    // Consequences of earlier missions applied when the level starts.
    startEffects?: readonly { effect: EventEffect; message?: string }[]
    // Enemy abilities that never appear in this run.
    excludedAbilities?: readonly EnemyAbility[]
    // Permanent upgrades of the profile, bought with requisitions.
    bonuses?: MetaBonuses
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
    readonly overrides = new SessionOverrides()
    readonly level: Level
    readonly rng: Random
    readonly personnel: Personnel
    readonly quarters: LivingQuarters
    readonly story: StoryDirector
    readonly objectives: ObjectiveTracker
    readonly unlockedTowers: readonly TowerType[]
    readonly unlockedBarricades: readonly BarricadeType[]
    readonly excludedAbilities: readonly EnemyAbility[]
    readonly bonuses: MetaBonuses
    readonly depth: number
    remembered: TowerType | null = null
    private readonly waveKills = new Map<TowerType, number>()
    private readonly towerTypes = new Map<string, TowerType>()
    private readonly towerDamageMultipliers = new Map<string, number>()

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
    // Fixed for the level run; checkpoints restore it.
    difficulty: DifficultyId
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

    // Enemies whose health has already been scaled for the difficulty.
    private readonly toughened = new WeakSet<Enemy>()
    private victoryCountdown: number | null = null
    private messages: string[] = []

    constructor(level: Level, rng: Random, options: SessionOptions = {}) {
        this.level = level
        this.rng = rng
        this.depth = options.depth ?? sectorDepth(level.id)
        this.difficulty = options.difficulty ?? DEFAULT_DIFFICULTY
        this.unlockedTowers = options.unlockedTowers ?? DEFAULT_TOWERS
        this.unlockedBarricades = options.unlockedBarricades ?? DEFAULT_BARRICADES
        this.excludedAbilities = options.excludedAbilities ?? []
        this.bonuses = options.bonuses ?? NO_BONUSES
        this.objectives = new ObjectiveTracker(level)
        this.resources =
            Math.round(level.startingResources * DIFFICULTIES[this.difficulty].startResources) +
            this.bonuses.startResources
        this.damageMultiplier = this.bonuses.towerDamage
        this.barricadeMultiplier = this.bonuses.barricadeHealth
        this.personnel = new Personnel(
            level,
            rng,
            level.startingMiners,
            level.startingMilitary + this.bonuses.startMilitary,
            this.bonuses.conversionSpeed,
        )
        this.quarters = new LivingQuarters(level, this.personnel, rng, this.bonuses.soldierDamage)
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
        for (const { effect, message } of options.startEffects ?? []) {
            applyEffect(this, effect)
            if (message) this.messages.push(message)
        }
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

    // Breakthroughs into the living quarters the player can afford before losing.
    get maxBreakthroughs(): number {
        return DIFFICULTIES[this.difficulty].maxBreakthroughs + this.bonuses.breakthroughs
    }

    // Whether the rank sends a boss (Средоточие) on this wave of the level.
    bossOnWave(wave: number): boolean {
        const bosses = DIFFICULTIES[this.difficulty].bosses
        return (
            this.depth >= bosses.minDepth &&
            ((bosses.finalWave && wave === this.level.totalWaves) ||
                (bosses.every !== null && wave % bosses.every === 0))
        )
    }

    get refundRate(): number {
        return DIFFICULTIES[this.difficulty].refundRate
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
        const dialogSpeed = DIFFICULTIES[this.difficulty].dialogSpeed
        if (!(this.story.active && dialogSpeed === 0)) this.story.tick(realFrames)
        // A dialog can only slow the battle down, never speed it up.
        const factor =
            this.story.active && dialogSpeed < 1 ? Math.min(dialogSpeed, this.speed) : this.speed
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
        if (this.waveInProgress && this.enemies.length === 0 && !this.quarters.underAttack) {
            this.completeWave()
        }
        for (const text of this.objectives.update(this))
            this.messages.push(`Задача выполнена: ${text}`)
        this.checkDefeat()
    }

    // ----- Commands -----

    toggleOverride(kind: 'lethal' | 'fortified'): boolean {
        this.overrides.used = true
        this.overrides[kind] = !this.overrides[kind]
        return this.overrides[kind]
    }

    grantResources(amount: number): CommandResult {
        this.overrides.used = true
        if (this.ended) return fail('Уровень завершён')
        if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(this.resources + amount))
            return fail('Некорректное количество ресурсов')
        this.resources += amount
        return ok
    }

    eliminateEnemies(): CommandResult {
        this.overrides.used = true
        if (this.ended) return fail('Уровень завершён')
        for (const enemy of [...this.enemies, ...this.quarters.enemies]) {
            enemy.die({ suppressOffspring: true })
        }
        return ok
    }

    clearWave(): CommandResult {
        this.overrides.used = true
        if (this.ended) return fail('Уровень завершён')
        if (!this.waveInProgress) return fail('Волна не идёт')
        return this.eliminateEnemies()
    }

    forceVictory(): CommandResult {
        this.overrides.used = true
        if (this.ended) return fail('Уровень завершён')
        this.eliminateEnemies()
        // Settle normal kill accounting before ending further simulation updates.
        this.updateEnemies(0)
        this.updateQuarters(0)
        this.finish('victory', '')
        return ok
    }

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
        this.waveKills.clear()
        const bosses = DIFFICULTIES[this.difficulty].bosses
        const wave = generateWave(this.currentWave, this.level.waveDifficulty, this.rng, {
            excludedAbilities: this.excludedAbilities,
            boss: {
                onThisWave: this.bossOnWave(this.currentWave),
                abilities: bosses.abilities,
                banned: bosses.banned,
            },
        })
        const blockers = this.barricades.filter((barricade) => barricade.active)
        const routes = assignRoutes(this.level, this.currentWave, wave, blockers, this.rng)
        wave.forEach((enemy, index) => enemy.setPath(routes[index]!.points))
        for (const route of this.level.routes) {
            if (route.opensOnWave === this.currentWave && route.opensOnWave > 1 && !route.reserve)
                this.messages.push(`Открыт новый путь: «${route.label}»`)
        }
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

    // `point` is where the player clicked; the barricade snaps onto the enemy track.
    buildBarricade(point: Point, type: BarricadeType): CommandResult {
        const placement = this.barricadePlacement(point)
        if (!placement) return fail('Баррикаду можно ставить только на путь врагов')
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
        // For a destroyed barricade the upgrade action (button, U key) means repair.
        if (barricade?.destroyed) return this.repair(barricade.id)
        if (barricade) return this.upgradeBarricade(barricade)
        return fail('Ничего не выбрано')
    }

    // Rebuild a destroyed barricade in place for a share of its price.
    repair(id: string | null = this.selectedId): CommandResult {
        const barricade = this.barricades.find((candidate) => candidate.id === id)
        if (!barricade?.destroyed) return fail('Ремонтировать нечего')
        if (barricade.building) return fail('Ремонт уже идёт')
        const cost = barricadeRepairCost(barricade.type)
        if (this.resources < cost) return fail('Недостаточно ресурсов для ремонта!')
        this.resources -= cost
        barricade.startRepair()
        return ok
    }

    demolish(id: string | null = this.selectedId): CommandResult {
        const slot = this.slots.find((candidate) => candidate.id === id)
        if (slot) {
            const type = slot.tower?.type ?? slot.construction?.type
            if (!type) return fail('Нечего демонтировать')
            this.resources += Math.floor(TOWER_CATALOG[type].cost * this.refundRate)
            slot.demolish()
        } else {
            const barricade = this.barricades.find((candidate) => candidate.id === id)
            if (!barricade) return fail('Нечего демонтировать')
            this.resources += barricadeRefund(barricade, this.refundRate)
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
        this.resourceRate = this.personnel.miners * 0.5 * this.bonuses.mining
        const gain = (this.resourceRate / FPS) * dt
        this.resources += gain
        this.stats.gathered += gain
    }

    private updateTowers(dt: number, quartersUnderAttack: boolean): void {
        const military = this.personnel.military
        const buildDt = dt * this.bonuses.buildSpeed
        const towers = this.slots.flatMap((slot) => (slot.tower ? [slot.tower] : []))
        for (const enemy of this.enemies) {
            enemy.towerDamageMultipliers = this.towerDamageMultipliers
            enemy.exposed = this.overrides.lethal
            if (enemy.alive && enemy.spawned) enemy.prepareCombat(towers, this.rng)
        }
        for (const slot of this.slots) {
            if (slot.updateConstruction(military, buildDt)) this.notifyObjectives('buildTower')
            const tower = slot.tower
            if (!tower) continue
            // Register even a tower whose construction finished in this very step.
            this.towerTypes.set(tower.id, tower.type)
            this.towerDamageMultipliers.set(
                tower.id,
                tower.type === this.remembered ? 1 - DIFFICULTIES[this.difficulty].swarmMemory : 1,
            )
            tower.updateUpgrade(military, buildDt)
            tower.damageMultiplier = this.damageMultiplier
            tower.setRangeMultiplier(this.bonuses.towerRange)
            // Towers hold fire while the living quarters are under attack.
            if (!quartersUnderAttack) tower.update(dt, this.enemies, this.rng)
            else tower.holdFire(dt)
        }
    }

    private updateBarricades(dt: number): void {
        for (const barricade of this.barricades) {
            const buildDt = dt * this.bonuses.buildSpeed
            if (barricade.building && barricade.updateBuild(this.personnel.military, buildDt)) {
                this.notifyObjectives('buildBarricade')
            }
            barricade.setHealthMultiplier(this.barricadeMultiplier)
            barricade.updateUpgrade(this.personnel.military, buildDt)
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
    }

    private updateEnemies(dt: number): void {
        const towers = this.slots.flatMap((slot) => (slot.tower ? [slot.tower] : []))
        const spawned: Enemy[] = []
        const survivors: Enemy[] = []

        for (const enemy of this.enemies) {
            if (enemy.alive && !enemy.spawned) {
                enemy.spawnDelay -= dt
                if (enemy.spawnDelay > 0) {
                    survivors.push(enemy)
                    continue
                }
                enemy.spawned = true
            }

            if (enemy.alive) {
                this.toughen(enemy)
                enemy.speed = enemy.baseSpeed * DIFFICULTIES[this.difficulty].speed
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
                // Enemies enter the living quarters only at the end of the track.
                if (enemy.alive && enemy.reached) {
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
                const type = enemy.lastHitBy ? this.towerTypes.get(enemy.lastHitBy) : undefined
                if (type) this.waveKills.set(type, (this.waveKills.get(type) ?? 0) + 1)
                if (enemy.splitPending) enemy.onSplit(this.rng)
                if (enemy.spawnedEnemies.length > 0) spawned.push(...enemy.spawnedEnemies)
                else this.resources += enemy.reward
            }
        }

        this.enemies = [...survivors, ...spawned]
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
                if (!this.overrides.fortified) barricade.takeDamage(enemy.mass * dt * 0.1)
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

    // Scale health once per enemy, including split and spawned offspring.
    private toughen(enemy: Enemy): void {
        if (this.toughened.has(enemy)) return
        this.toughened.add(enemy)
        const multiplier = DIFFICULTIES[this.difficulty].health
        enemy.maxHealth = Math.round(enemy.maxHealth * multiplier)
        enemy.currentHealth = Math.round(enemy.currentHealth * multiplier)
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
        const ranked = [...this.waveKills].sort((a, b) => b[1] - a[1])
        const top = ranked[0]
        const remembered =
            DIFFICULTIES[this.difficulty].swarmMemory > 0 &&
            top &&
            top[1] >= SWARM_MEMORY_RULES.minimumKills &&
            top[1] > (ranked[1]?.[1] ?? 0)
                ? top[0]
                : null
        if (remembered !== this.remembered && remembered) {
            this.messages.push(
                SWARM_MEMORY_RULES.message
                    .replace('{tower}', TOWER_CATALOG[remembered].name)
                    .replace(
                        '{percent}',
                        String(Math.round(DIFFICULTIES[this.difficulty].swarmMemory * 100)),
                    ),
            )
        }
        if (this.remembered && !remembered) this.messages.push(SWARM_MEMORY_RULES.clearedMessage)
        this.remembered = remembered
        if (this.currentWave >= this.level.totalWaves) {
            this.victoryCountdown = VICTORY_DELAY
        } else {
            this.messages.push(`Волна ${this.currentWave} отражена!`)
        }
    }

    private checkDefeat(): void {
        if (this.personnel.total <= 0 && this.personnel.inTransit <= 0) {
            this.finish('defeat', 'Весь персонал погиб')
        } else if (this.stats.reached >= this.maxBreakthroughs) {
            this.finish('defeat', 'Слишком много врагов прорвалось в жилой отсек')
        }
    }

    private finish(outcome: 'victory' | 'defeat', reason: string): void {
        if (this.ended) return
        if (outcome === 'victory') this.notifyObjectives('survive')
        this.status = outcome
        this.result = { outcome, reason }
        this.story.close()
    }

    private notifyObjectives(event: ObjectiveEvent): void {
        for (const text of this.objectives.notify(event))
            this.messages.push(`Задача выполнена: ${text}`)
    }
}

// Refund a working barricade at the run’s rate; nothing for a destroyed one.
export function barricadeRefund(barricade: Barricade, refundRate = REFUND_RATE): number {
    return barricade.destroyed ? 0 : Math.floor(BARRICADE_CATALOG[barricade.type].cost * refundRate)
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
