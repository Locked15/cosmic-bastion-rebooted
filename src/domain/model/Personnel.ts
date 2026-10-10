import type { Random } from '../random'
export type PersonType = 'miner' | 'military'
export type PersonState = 'idle' | 'scatter' | 'panic' | 'regroup' | 'hold'
export class Person {
    type: PersonType
    x: number = 0
    y: number = 0
    targetX: number = 0
    targetY: number = 0
    baseSpeed: number = 0
    speed: number = 0
    alive: boolean = true
    idleTimer: number = 0
    freezeIdle: boolean = false
    state: PersonState
    clusterId: number | null = null
    isShooting: boolean = false
    shootTimer: number = 0
    shootAngle: number = 0

    constructor(
        type: PersonType,
        x: number,
        y: number,
        public id: string,
    ) {
        this.type = type
        this.x = x
        this.y = y
        this.targetX = x
        this.targetY = y
        this.baseSpeed = this.type === 'military' ? 1.5 : 1.1
        this.speed = this.baseSpeed
        this.state = 'idle'
        this.shootAngle = 0
    }

    update(
        deltaTime: number,
        livingQuartersY: number,
        width: number,
        height: number,
        rng: Random,
    ): void {
        if (!this.alive) return
        this.shootTimer = Math.max(0, this.shootTimer - deltaTime)
        const dx = this.targetX - this.x
        const dy = this.targetY - this.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > 5) {
            this.x += (dx / dist) * this.speed * deltaTime
            this.y += (dy / dist) * this.speed * deltaTime
        } else {
            if (!this.freezeIdle) {
                this.idleTimer += deltaTime
                if (this.idleTimer > 120) {
                    if (this.type === 'miner') {
                        this.targetX = 50 + rng.next() * (width - 100)
                        this.targetY =
                            livingQuartersY + 50 + rng.next() * (height - livingQuartersY - 100)
                    } else {
                        this.targetX = 50 + rng.next() * 200
                        this.targetY = livingQuartersY + 30
                    }
                    this.idleTimer = 0
                }
            } else {
                this.idleTimer = 0
            }
        }

        this.x = Math.max(20, Math.min(width - 20, this.x))
        this.y = Math.max(livingQuartersY + 20, Math.min(height - 20, this.y))
    }
}
export class Conversion {
    id: string
    fromType: PersonType
    toType: PersonType
    count: number = 0
    progress: number = 0
    time: number = 0
    completed: boolean = false

    constructor(fromType: PersonType, toType: PersonType, count: number, id: string) {
        this.id = id
        this.fromType = fromType
        this.toType = toType
        this.count = count
        this.time = fromType === 'miner' ? 120 : 180
        this.completed = false
    }

    update(deltaTime: number): boolean {
        if (this.completed) return false

        this.progress += deltaTime

        if (this.progress >= this.time) {
            this.completed = true
            return true
        }

        return false
    }

    getProgress(): number {
        return (this.progress / this.time) * 100
    }
}
