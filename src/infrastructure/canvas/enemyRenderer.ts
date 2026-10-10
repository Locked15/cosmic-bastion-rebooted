import type { Enemy } from '@/domain'

const particleEpoch = Date.now()

export function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
    if (!enemy.alive && enemy.opacity <= 0) return

    ctx.save()

    if (enemy.blockFlashTimer > 0) {
        ctx.globalAlpha = 0.7 + Math.sin(enemy.blockFlashTimer * 2) * 0.3
        ctx.fillStyle = '#00aaff'
    } else if (enemy.flashTimer > 0) {
        ctx.globalAlpha = enemy.opacity
        ctx.fillStyle = '#ffffff'
    } else {
        ctx.globalAlpha = enemy.opacity

        if (enemy.type === 'boss') {
            ctx.fillStyle = '#ff0000'
        } else if (enemy.type === 'miniboss') {
            ctx.fillStyle = '#ff6666'
        } else if (enemy.type === 'ability') {
            ctx.fillStyle = '#cccccc'
        } else {
            ctx.fillStyle = '#888888'
        }
    }

    const size = getDrawSize(enemy)

    ctx.beginPath()
    ctx.arc(enemy.x, enemy.y, size, 0, Math.PI * 2)
    ctx.fill()

    drawParticles(ctx, enemy, size)

    drawAbilityIndicators(ctx, enemy, size)
    if (enemy.stunTimer > 0 || enemy.ambushFlashTimer > 0) {
        ctx.strokeStyle = enemy.stunTimer > 0 ? '#ffff00' : '#cc00ff'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(enemy.x, enemy.y, size + 14, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = ctx.strokeStyle
        ctx.font = '12px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(enemy.stunTimer > 0 ? 'ОГЛУШЁН' : 'ЗАСАДА', enemy.x, enemy.y + size + 24)
    }

    if (enemy.currentHealth < enemy.maxHealth) {
        drawHealthBar(ctx, enemy, size)
    }

    ctx.restore()
}

function getDrawSize(enemy: Enemy): number {
    const sizeMap = {
        small: 10,
        medium: 18,
        large: 32,
    }

    let baseSize = sizeMap[enemy.size]

    if (enemy.type === 'miniboss') baseSize *= 1.4
    if (enemy.type === 'boss') baseSize *= 2.2

    return baseSize
}

function drawParticles(ctx: CanvasRenderingContext2D, enemy: Enemy, size: number): void {
    const particleCount = enemy.type === 'boss' ? 15 : enemy.type === 'miniboss' ? 10 : 7
    const particleSize = size * 0.25
    const orbitRadius = size * 1.5
    const particleOffset = (Date.now() - particleEpoch) * 0.0012

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'

    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + particleOffset
        const px = enemy.x + Math.cos(angle) * orbitRadius
        const py = enemy.y + Math.sin(angle) * orbitRadius

        ctx.beginPath()
        ctx.arc(px, py, particleSize, 0, Math.PI * 2)
        ctx.fill()
    }
}

function drawAbilityIndicators(ctx: CanvasRenderingContext2D, enemy: Enemy, size: number): void {
    if (!enemy.abilities || enemy.abilities.length === 0) return

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1

    if (enemy.type === 'ability' || enemy.type === 'miniboss') {
        ctx.beginPath()
        ctx.arc(enemy.x, enemy.y, size + 4, 0, Math.PI * 2)
        ctx.stroke()
    }

    if (enemy.type === 'boss') {
        ctx.strokeStyle = '#ff0000'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(enemy.x, enemy.y, size + 6, 0, Math.PI * 2)
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(enemy.x, enemy.y, size + 10, 0, Math.PI * 2)
        ctx.stroke()
    }

    const indicatorY = enemy.y - size - 20
    const indicatorSize = 4

    if (enemy.hasAbility('split')) {
        ctx.fillStyle = '#ffff00'
        ctx.beginPath()
        ctx.arc(enemy.x - 10, indicatorY, indicatorSize, 0, Math.PI * 2)
        ctx.fill()
    }

    if (enemy.hasAbility('accelerate')) {
        ctx.fillStyle = '#00ff00'
        ctx.beginPath()
        ctx.arc(enemy.x, indicatorY, indicatorSize, 0, Math.PI * 2)
        ctx.fill()
    }

    if (enemy.hasAbility('teleport')) {
        ctx.fillStyle = '#00ffff'
        ctx.beginPath()
        ctx.arc(enemy.x + 10, indicatorY, indicatorSize, 0, Math.PI * 2)
        ctx.fill()
    }
}

function drawHealthBar(ctx: CanvasRenderingContext2D, enemy: Enemy, size: number): void {
    const barWidth = size * 2.5
    const barHeight = 5
    const barX = enemy.x - barWidth / 2
    const barY = enemy.y - size - 15

    ctx.fillStyle = '#333333'
    ctx.fillRect(barX, barY, barWidth, barHeight)

    const healthPercent = Math.max(0, Math.min(1, enemy.currentHealth / enemy.maxHealth))
    ctx.fillStyle = healthPercent > 0.6 ? '#00ff00' : healthPercent > 0.3 ? '#ffff00' : '#ff0000'
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight)

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.strokeRect(barX, barY, barWidth, barHeight)
}
