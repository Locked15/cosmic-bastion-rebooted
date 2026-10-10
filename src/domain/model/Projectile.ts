import type { Enemy } from './Enemy'
export type ProjectileType = 'bullet' | 'cannon' | 'rocket'
export class Projectile {
    x: number
    y: number
    damage: number
    speed: number
    slowEffect: boolean
    target: Enemy
    type: ProjectileType
    active: boolean = false

    constructor(
        x: number,
        y: number,
        target: Enemy,
        damage: number,
        public id: string,
        type: ProjectileType = 'bullet',
        slowEffect: boolean = false,
        public sourceId?: string,
    ) {
        this.x = x
        this.y = y
        this.target = target
        this.damage = damage
        this.type = type
        this.slowEffect = slowEffect
        this.speed = type === 'bullet' ? 8 : 6
        this.active = true
    }

    update(deltaTime: number): void {
        if (!this.target || !this.target.alive) {
            this.active = false
            return
        }

        const dx = this.target.x - this.x
        const dy = this.target.y - this.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        const moveDistance = this.speed * deltaTime
        if (dist <= moveDistance || dist === 0) {
            this.hit()
        } else {
            this.x += (dx / dist) * moveDistance
            this.y += (dy / dist) * moveDistance
        }
    }

    hit(): void {
        if (this.target && this.target.takeDamage) {
            this.target.takeDamage(this.damage, this.sourceId)
        }

        if (this.slowEffect && this.target && this.target.alive) {
            this.target.slowMultiplier = 0.5
            this.target.slowTimer = 120
        }

        this.active = false
    }
}
export class ExplosiveProjectile extends Projectile {
    explosionRadius: number
    knockback: boolean
    allEnemies: Enemy[]

    constructor(
        x: number,
        y: number,
        target: Enemy,
        damage: number,
        explosionRadius: number,
        knockback: boolean,
        allEnemies: Enemy[],
        id: string,
        sourceId?: string,
    ) {
        super(x, y, target, damage, id, 'rocket', false, sourceId)
        this.explosionRadius = explosionRadius
        this.knockback = knockback
        this.allEnemies = allEnemies
        this.speed = 5
    }

    hit(): void {
        if (this.allEnemies) {
            this.allEnemies.forEach((enemy) => {
                if (!enemy.alive) return

                const dx = enemy.x - this.x
                const dy = enemy.y - this.y
                const dist = Math.sqrt(dx * dx + dy * dy)

                if (dist <= this.explosionRadius) {
                    const damageMult = 1 - (dist / this.explosionRadius) * 0.5
                    if (enemy.takeDamage) {
                        enemy.takeDamage(this.damage * damageMult, this.sourceId)
                    }

                    if (this.knockback && dist > 0) {
                        const knockbackDist = 20
                        enemy.x += (dx / dist) * knockbackDist
                        enemy.y += (dy / dist) * knockbackDist
                    }
                }
            })
        }

        this.active = false
    }
}
