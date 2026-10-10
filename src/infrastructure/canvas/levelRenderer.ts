import type { Level } from '@/domain'

export function drawLevel(ctx: CanvasRenderingContext2D, level: Level): void {
    if (!ctx) return

    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, level.width, level.height)

    drawCorridors(ctx, level)

    ctx.fillStyle = '#0f0f0f'
    ctx.fillRect(0, level.livingQuartersY, level.width, level.height - level.livingQuartersY)

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.setLineDash([10, 5])
    ctx.beginPath()
    ctx.moveTo(0, level.livingQuartersY)
    ctx.lineTo(level.width, level.livingQuartersY)
    ctx.stroke()
    ctx.setLineDash([])

    drawBreaches(ctx, level)

    drawGrid(ctx, level)

    drawTowerSlots(ctx, level)

    drawEnemyPath(ctx, level)
}

function drawCorridors(ctx: CanvasRenderingContext2D, level: Level): void {
    if (!ctx || !level.corridors || !Array.isArray(level.corridors)) return

    ctx.save()

    level.corridors.forEach((corridor) => {
        if (!corridor) return

        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(corridor.x, corridor.y, corridor.width, corridor.height)

        ctx.strokeStyle = '#444444'
        ctx.lineWidth = 2
        ctx.strokeRect(corridor.x, corridor.y, corridor.width, corridor.height)

        ctx.strokeStyle = '#2a2a2a'
        ctx.lineWidth = 1
        for (let i = 0; i < corridor.width; i += 40) {
            ctx.beginPath()
            ctx.moveTo(corridor.x + i, corridor.y)
            ctx.lineTo(corridor.x + i, corridor.y + corridor.height)
            ctx.stroke()
        }
    })

    ctx.restore()
}

function drawBreaches(ctx: CanvasRenderingContext2D, level: Level): void {
    if (!ctx || !level.floorBreaches || !Array.isArray(level.floorBreaches)) return

    ctx.save()
    level.floorBreaches.forEach((breach) => {
        if (!breach) return

        if (breach.closed) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.15)'
            ctx.fillRect(breach.x, breach.y, breach.width, breach.height)
            ctx.strokeStyle = '#00ff00'
        } else {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'
            ctx.fillRect(breach.x, breach.y, breach.width, breach.height)
            ctx.strokeStyle = '#ff0000'
        }

        ctx.lineWidth = 3
        ctx.strokeRect(breach.x, breach.y, breach.width, breach.height)

        if (!breach.closed) {
            ctx.strokeStyle = '#ffff00'
            ctx.setLineDash([8, 8])
            ctx.lineWidth = 2
            ctx.strokeRect(breach.x - 8, breach.y - 8, breach.width + 16, breach.height + 16)
            ctx.setLineDash([])
        }
    })
    ctx.restore()
}

function drawGrid(ctx: CanvasRenderingContext2D, level: Level): void {
    if (!ctx) return

    ctx.strokeStyle = 'rgba(68, 68, 68, 0.3)'
    ctx.lineWidth = 1

    const gridSize = 50

    for (let x = 0; x < level.width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, level.height)
        ctx.stroke()
    }

    for (let y = 0; y < level.height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(level.width, y)
        ctx.stroke()
    }
}

function drawTowerSlots(ctx: CanvasRenderingContext2D, level: Level): void {
    if (!ctx || !level.towerSlots || !Array.isArray(level.towerSlots)) return

    ctx.save()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])

    level.towerSlots.forEach((slot) => {
        if (!slot) return
        ctx.beginPath()
        ctx.arc(slot.x, slot.y, 22, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
    })

    ctx.setLineDash([])
    ctx.restore()
}

function drawEnemyPath(ctx: CanvasRenderingContext2D, level: Level): void {
    if (!ctx || !level.basePath || level.basePath.length < 2) return

    ctx.save()
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'
    ctx.lineWidth = 35
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(level.basePath[0]!.x, level.basePath[0]!.y)
    for (let i = 1; i < level.basePath.length; i++) {
        ctx.lineTo(level.basePath[i]!.x, level.basePath[i]!.y)
    }
    ctx.stroke()

    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)'
    for (let i = 0; i < level.basePath.length - 1; i++) {
        const p1 = level.basePath[i]!
        const p2 = level.basePath[i + 1]!
        const midX = (p1.x + p2.x) / 2
        const midY = (p1.y + p2.y) / 2

        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)

        ctx.save()
        ctx.translate(midX, midY)
        ctx.rotate(angle)

        ctx.beginPath()
        ctx.moveTo(12, 0)
        ctx.lineTo(-6, -10)
        ctx.lineTo(-6, 10)
        ctx.closePath()
        ctx.fill()

        ctx.restore()
    }

    ctx.restore()
}
