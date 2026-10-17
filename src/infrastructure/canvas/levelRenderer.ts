import type { Level, RouteDefinition } from '@/domain'

// Route tints in order of the level's routes (RGB, alpha added per use).
const ROUTE_TINTS = ['255, 40, 40', '255, 150, 30', '190, 90, 255', '40, 190, 255']

// `wave` is the wave whose routes matter: the running one, or the next between waves.
export function drawLevel(ctx: CanvasRenderingContext2D, level: Level, wave = 1): void {
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

    drawGrid(ctx, level)

    drawTowerSlots(ctx, level)

    level.routes.forEach((route, index) => {
        const tint = ROUTE_TINTS[index % ROUTE_TINTS.length]!
        const state = route.reserve ? 'reserve' : route.opensOnWave > wave ? 'closed' : 'open'
        drawRoute(ctx, level, route, tint, state)
    })
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

type RouteState = 'open' | 'closed' | 'reserve'

function drawRoute(
    ctx: CanvasRenderingContext2D,
    level: Level,
    route: RouteDefinition,
    tint: string,
    state: RouteState,
): void {
    const points = route.points
    if (points.length < 2) return
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = `rgba(${tint}, ${state === 'open' ? 0.3 : 0.18})`
    ctx.lineWidth = state === 'open' ? 35 : 14
    ctx.setLineDash(state === 'open' ? [] : [18, 14])
    ctx.beginPath()
    ctx.moveTo(points[0]!.x, points[0]!.y)
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
    ctx.stroke()
    ctx.setLineDash([])

    if (state === 'open') drawArrows(ctx, points, `rgba(${tint}, 0.45)`)
    drawSpawn(ctx, level, route, tint, state)
    ctx.restore()
}

function drawArrows(
    ctx: CanvasRenderingContext2D,
    points: RouteDefinition['points'],
    fill: string,
) {
    ctx.fillStyle = fill
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i]!
        const p2 = points[i + 1]!
        ctx.save()
        ctx.translate((p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
        ctx.rotate(Math.atan2(p2.y - p1.y, p2.x - p1.x))
        ctx.beginPath()
        ctx.moveTo(12, 0)
        ctx.lineTo(-6, -10)
        ctx.lineTo(-6, 10)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
    }
}

// Breach marker where the route enters the map, with its name and state.
function drawSpawn(
    ctx: CanvasRenderingContext2D,
    level: Level,
    route: RouteDefinition,
    tint: string,
    state: RouteState,
): void {
    if (state === 'reserve') return
    const start = route.points[0]!
    const next = route.points[1]!
    const open = state === 'open'
    ctx.strokeStyle = `rgba(${tint}, ${open ? 0.9 : 0.5})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(start.x, start.y, 22, 0, Math.PI * 2)
    ctx.stroke()
    if (open) {
        ctx.beginPath()
        ctx.arc(start.x, start.y, 30, 0, Math.PI * 2)
        ctx.stroke()
    }
    // The label sits on the side away from the route, kept inside the map.
    const label = open ? route.label : `${route.label} · с волны ${route.opensOnWave}`
    const below = next.y >= start.y ? -1 : 1
    ctx.font = 'bold 13px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const width = ctx.measureText(label).width
    const x = Math.min(level.width - width / 2 - 6, Math.max(width / 2 + 6, start.x))
    const y = Math.min(level.height - 14, Math.max(14, start.y + below * 44))
    ctx.fillStyle = `rgba(${tint}, ${open ? 1 : 0.6})`
    ctx.fillText(label, x, y)
}
