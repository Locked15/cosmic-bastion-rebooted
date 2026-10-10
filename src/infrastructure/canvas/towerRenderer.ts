import { LaserTower } from '@/domain'
import type { Tower, TowerSlot, Projectile } from '@/domain'

export function drawTowerSlot(ctx: CanvasRenderingContext2D, slot: TowerSlot): void {
    ctx.save()
    ctx.translate(slot.x, slot.y)
    const tower = slot.tower
    if (!tower) {
        drawBroken(ctx)
        if (slot.cooldown > 0) {
            drawProgress(ctx, 1 - slot.cooldown / 300, '#ff8800')
            ctx.fillStyle = '#ff8800'
            ctx.font = '10px monospace'
            ctx.textAlign = 'center'
            ctx.fillText(`${Math.ceil(slot.cooldown / 60)} с`, 0, -22)
        }
        if (slot.construction) {
            drawProgress(ctx, slot.construction.progress / slot.construction.time, '#00ff00')
        }
    } else if (tower.repairing) {
        drawBroken(ctx)
        drawProgress(ctx, tower.repairProgress / tower.repairTime, '#00ff00')
    } else if (tower.broken) {
        drawBroken(ctx)
    } else {
        drawActive(ctx, tower)
        if (tower.upgrading) {
            drawProgress(ctx, tower.upgradeProgress / tower.upgradeTime, '#ffff00')
        }
    }
    ctx.restore()
    if (tower?.blindTarget) {
        const { x, y } = tower.blindTarget
        ctx.save()
        ctx.strokeStyle = '#ff8800'
        ctx.beginPath()
        ctx.arc(x, y, 12, 0, Math.PI * 2)
        ctx.moveTo(x - 18, y)
        ctx.lineTo(x + 18, y)
        ctx.moveTo(x, y - 18)
        ctx.lineTo(x, y + 18)
        ctx.stroke()
        ctx.restore()
    }
    for (const projectile of tower?.projectiles ?? []) {
        if (projectile.active) drawProjectile(ctx, projectile)
    }
}

function drawProgress(ctx: CanvasRenderingContext2D, progress: number, color: string): void {
    ctx.fillStyle = color
    ctx.fillRect(-15, 20, 30 * progress, 4)
    ctx.strokeStyle = '#ffffff'
    ctx.strokeRect(-15, 20, 30, 4)
}

function drawBroken(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = '#444444'
    ctx.fillStyle = '#222222'
    ctx.lineWidth = 2

    ctx.beginPath()
    ctx.arc(0, 0, 15, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.strokeStyle = '#ff0000'
    ctx.beginPath()
    ctx.moveTo(-8, -8)
    ctx.lineTo(8, 8)
    ctx.moveTo(8, -8)
    ctx.lineTo(-8, 8)
    ctx.stroke()
}

function drawBase(ctx: CanvasRenderingContext2D, tower: Tower): void {
    ctx.strokeStyle = tower.disabled ? '#666666' : '#ffffff'
    ctx.fillStyle = tower.disabled ? '#333333' : '#555555'
    ctx.lineWidth = 2

    ctx.beginPath()
    ctx.arc(0, 0, 15, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    if (tower.level > 0) {
        ctx.fillStyle = '#00ff00'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`LVL${tower.level}`, 0, 30)
    }
}

function drawActive(ctx: CanvasRenderingContext2D, tower: Tower): void {
    drawBase(ctx, tower)
    switch (tower.type) {
        case 'cannon': {
            ctx.save()
            ctx.rotate(tower.angle)
            ctx.fillStyle = tower.disabled ? '#555555' : '#888888'
            ctx.fillRect(0, -4, 20, 8)
            ctx.strokeStyle = tower.disabled ? '#666666' : '#ffffff'
            ctx.strokeRect(0, -4, 20, 8)
            ctx.restore()

            break
        }
        case 'rocket': {
            ctx.save()
            ctx.rotate(tower.angle)
            ctx.fillStyle = tower.disabled ? '#555555' : '#888888'
            ctx.fillRect(0, -6, 18, 12)
            ctx.fillRect(5, -3, 12, 6)
            ctx.strokeStyle = tower.disabled ? '#666666' : '#ffffff'
            ctx.strokeRect(0, -6, 18, 12)
            ctx.restore()

            break
        }
        case 'machinegun': {
            ctx.save()
            ctx.rotate(tower.angle)
            ctx.fillStyle = tower.disabled ? '#555555' : '#888888'
            ctx.fillRect(0, -3, 22, 2)
            ctx.fillRect(0, 1, 22, 2)
            ctx.strokeStyle = tower.disabled ? '#666666' : '#ffffff'
            ctx.lineWidth = 1
            ctx.strokeRect(0, -3, 22, 2)
            ctx.strokeRect(0, 1, 22, 2)
            ctx.restore()

            break
        }
        case 'laser': {
            if (!(tower instanceof LaserTower)) return

            ctx.save()
            ctx.rotate(tower.angle)

            ctx.fillStyle = tower.disabled ? '#555555' : '#0088ff'
            ctx.fillRect(0, -5, 15, 10)
            ctx.strokeStyle = tower.disabled ? '#666666' : '#00ccff'
            ctx.strokeRect(0, -5, 15, 10)

            ctx.restore()

            if (tower.beamEnd && !tower.disabled) {
                ctx.save()
                ctx.strokeStyle = tower.piercing ? '#ff0000' : '#00ffff'
                ctx.lineWidth = tower.piercing ? 4 : 2
                ctx.globalAlpha = 0.7

                ctx.beginPath()
                ctx.moveTo(0, 0)
                ctx.lineTo(tower.beamEnd.x - tower.x, tower.beamEnd.y - tower.y)
                ctx.stroke()

                for (const hit of tower.beamHits) {
                    ctx.beginPath()
                    ctx.arc(hit.x - tower.x, hit.y - tower.y, 8, 0, Math.PI * 2)
                    ctx.stroke()
                }
                ctx.strokeStyle = '#ffffff'
                ctx.lineWidth = 1
                ctx.globalAlpha = 0.3
                ctx.stroke()

                ctx.restore()
            }

            break
        }
        case 'shock': {
            ctx.strokeStyle = tower.disabled ? '#666666' : '#ffff00'
            ctx.lineWidth = 2

            for (let i = 0; i < 3; i++) {
                ctx.beginPath()
                ctx.arc(0, -8 + i * 8, 8, 0, Math.PI * 2)
                ctx.stroke()
            }

            if (tower.showShockEffect > 0 && !tower.disabled) {
                ctx.strokeStyle = '#ffff00'
                ctx.lineWidth = 2
                ctx.globalAlpha = tower.showShockEffect / 30

                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2
                    const length = 20 + Math.random() * 10
                    ctx.beginPath()
                    ctx.moveTo(0, 0)
                    ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length)
                    ctx.stroke()
                }
                ctx.globalAlpha = 1
            }

            break
        }
    }
}

export function drawTowerRange(ctx: CanvasRenderingContext2D, tower: Tower): void {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
}

function drawProjectile(ctx: CanvasRenderingContext2D, projectile: Projectile): void {
    if (projectile.type === 'rocket') {
        ctx.save()

        const angle = Math.atan2(
            projectile.target.y - projectile.y,
            projectile.target.x - projectile.x,
        )
        ctx.translate(projectile.x, projectile.y)
        ctx.rotate(angle)

        ctx.fillStyle = '#ff6600'
        ctx.fillRect(-6, -3, 12, 6)
        ctx.fillStyle = '#ff0000'
        ctx.beginPath()
        ctx.moveTo(-6, 0)
        ctx.lineTo(-10, -4)
        ctx.lineTo(-10, 4)
        ctx.closePath()
        ctx.fill()

        ctx.restore()
    } else {
        ctx.save()
        ctx.fillStyle = projectile.type === 'cannon' ? '#ffffff' : '#ffff00'
        ctx.beginPath()
        ctx.arc(projectile.x, projectile.y, projectile.type === 'cannon' ? 4 : 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
    }
}
