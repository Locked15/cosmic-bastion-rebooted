import type { Point } from '../geometry'
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
    fixedTarget: Point | null = null
    impactEnemies: Enemy[] = []

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
        if (!this.fixedTarget && (!this.target || !this.target.alive)) {
            this.active = false
            return
        }

        const point = this.fixedTarget ?? this.target
        const dx = point.x - this.x
        const dy = point.y - this.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        const moveDistance = this.speed * deltaTime
        if (dist <= moveDistance || dist === 0) {
            this.x = point.x
            this.y = point.y
            this.hit()
        } else {
            this.x += (dx / dist) * moveDistance
            this.y += (dy / dist) * moveDistance
        }
    }

    hit(): void {
        const targets = this.fixedTarget
            ? this.impactEnemies
                  .filter(
                      (enemy) =>
                          enemy.alive &&
                          enemy.spawned &&
                          Math.hypot(enemy.x - this.x, enemy.y - this.y) <= 10,
                  )
                  .slice(0, 1)
            : [this.target]
        for (const target of targets) {
            if (target.dodgeProjectile()) continue
            target.takeDamage(this.damage, this.sourceId)
            if (this.slowEffect && target.alive) {
                target.slowMultiplier = 0.5
                target.slowTimer = 120
            }
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
                if (!enemy.alive || !enemy.spawned) return

                const dx = enemy.x - this.x
                const dy = enemy.y - this.y
                const dist = Math.sqrt(dx * dx + dy * dy)

                if (dist <= this.explosionRadius && !enemy.dodgeProjectile()) {
                    const damageMult = 1 - (dist / this.explosionRadius) * 0.5
                    if (enemy.takeDamage) {
                        enemy.takeDamage(this.damage * damageMult, this.sourceId)
                    }

                    if (this.knockback && enemy.alive) enemy.knockBack(20)
                }
            })
        }

        this.active = false
    }
}
