import type { Barricade } from '@/domain'

export function drawBarricade(ctx: CanvasRenderingContext2D, barricade: Barricade): void {
    if (barricade.broken && !barricade.building) {
        drawBroken(ctx, barricade)
    } else if (barricade.building) {
        drawBuilding(ctx, barricade)
    } else {
        drawActive(ctx, barricade)
    }
}

function drawBroken(ctx: CanvasRenderingContext2D, barricade: Barricade): void {
    ctx.save()
    ctx.strokeStyle = '#444444'
    ctx.fillStyle = '#222222'
    ctx.lineWidth = 2
    ctx.fillRect(barricade.x, barricade.y, barricade.width, barricade.height)
    ctx.strokeRect(barricade.x, barricade.y, barricade.width, barricade.height)

    ctx.strokeStyle = '#ff0000'
    ctx.beginPath()
    ctx.moveTo(barricade.x, barricade.y)
    ctx.lineTo(barricade.x + barricade.width, barricade.y + barricade.height)
    ctx.moveTo(barricade.x + barricade.width, barricade.y)
    ctx.lineTo(barricade.x, barricade.y + barricade.height)
    ctx.stroke()

    ctx.restore()
}

function drawBuilding(ctx: CanvasRenderingContext2D, barricade: Barricade): void {
    drawBroken(ctx, barricade)

    const progress = barricade.buildProgress / barricade.buildTime
    ctx.fillStyle = '#00ff00'
    ctx.fillRect(barricade.x, barricade.y + barricade.height + 5, barricade.width * progress, 4)
    ctx.strokeStyle = '#ffffff'
    ctx.strokeRect(barricade.x, barricade.y + barricade.height + 5, barricade.width, 4)
}

function drawActive(ctx: CanvasRenderingContext2D, barricade: Barricade): void {
    ctx.save()

    const healthPercent = barricade.currentHealth / barricade.maxHealth
    const color = healthPercent > 0.6 ? '#00ff00' : healthPercent > 0.3 ? '#ffff00' : '#ff0000'

    ctx.fillStyle = color
    ctx.globalAlpha = 0.3
    ctx.fillRect(barricade.x, barricade.y, barricade.width, barricade.height)
    ctx.globalAlpha = 1

    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.strokeRect(barricade.x, barricade.y, barricade.width, barricade.height)

    if (barricade.type === 'shield') {
        ctx.strokeStyle = '#00ccff'
        ctx.lineWidth = 3
        ctx.strokeRect(barricade.x - 2, barricade.y - 2, barricade.width + 4, barricade.height + 4)
    } else if (barricade.type === 'filter') {
        ctx.strokeStyle = '#ffff00'
        ctx.setLineDash([5, 5])
        ctx.strokeRect(barricade.x, barricade.y, barricade.width, barricade.height)
        ctx.setLineDash([])
    }

    ctx.fillStyle = '#333333'
    ctx.fillRect(barricade.x, barricade.y - 8, barricade.width, 4)
    ctx.fillStyle = color
    ctx.fillRect(
        barricade.x,
        barricade.y - 8,
        barricade.width * Math.max(0, Math.min(1, healthPercent)),
        4,
    )

    ctx.restore()
}
