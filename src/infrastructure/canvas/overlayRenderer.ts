import { TOWER_CATALOG, BARRICADE_CATALOG, TOWER_MAX_LEVEL, BARRICADE_MAX_LEVEL } from '@/domain'
import type { Tower, Barricade } from '@/domain'
import type { Scene } from '@/application/session/scene'

function drawTowerUpgradeHint(ctx: CanvasRenderingContext2D, tower: Tower): void {
    const towerData = TOWER_CATALOG[tower.type]
    const nextCost = tower.level < TOWER_MAX_LEVEL ? towerData?.upgradeCosts?.[tower.level] : null

    let text: string
    let borderColor = '#00ffff'

    if (!tower.active) {
        text = 'Башня неактивна'
        borderColor = '#888888'
    } else if (tower.repairing) {
        text = 'Ремонт в процессе'
        borderColor = '#ffaa00'
    } else if (tower.upgrading) {
        text = 'Улучшение...'
        borderColor = '#ffaa00'
    } else if (tower.level >= TOWER_MAX_LEVEL) {
        text = 'Максимальный уровень'
        borderColor = '#888888'
    } else if (nextCost === undefined) {
        text = 'Улучшение недоступно'
        borderColor = '#888888'
    } else {
        text = `U ▸ улучшить (💎 ${nextCost})`
    }

    ctx.save()
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    const padding = 6
    const textWidth = ctx.measureText(text).width
    const boxWidth = textWidth + padding * 2
    const boxHeight = 24
    const x = tower.x
    const y = tower.y - 40

    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)'
    ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight)
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 1
    ctx.strokeRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight)

    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, x, y + 3)
    ctx.restore()
}

function drawBarricadeUpgradeHint(ctx: CanvasRenderingContext2D, barricade: Barricade): void {
    const barricadeData = BARRICADE_CATALOG[barricade.type]
    const maxLevel = BARRICADE_MAX_LEVEL
    const nextCost =
        barricade.level < maxLevel ? barricadeData?.upgradeCosts?.[barricade.level] : null

    let text: string
    let borderColor = '#00ff88'

    if (!barricade.active) {
        text = barricade.building ? 'Строительство...' : 'Баррикада повреждена'
        borderColor = '#ffaa00'
    } else if (barricade.upgrading) {
        text = 'Улучшение...'
        borderColor = '#ffaa00'
    } else if (barricade.level >= maxLevel) {
        text = 'Максимальный уровень'
        borderColor = '#888888'
    } else if (nextCost === undefined) {
        text = 'Улучшение недоступно'
        borderColor = '#888888'
    } else {
        text = `U ▸ усилить (💎 ${nextCost})`
    }

    ctx.save()
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    const padding = 6
    const textWidth = ctx.measureText(text).width
    const boxWidth = textWidth + padding * 2
    const boxHeight = 24
    const x = barricade.x + barricade.width / 2
    const y = barricade.y - 20

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight)
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 1
    ctx.strokeRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight)

    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, x, y + 4)
    ctx.restore()
}

export function drawOverlays(ctx: CanvasRenderingContext2D, scene: Scene): void {
    ctx.save()
    const { pointer } = scene
    if (!pointer.build && pointer.hoverId) {
        const slot = scene.slots.find((slot) => slot.id === pointer.hoverId)
        const barricade = scene.barricades.find((item) => item.id === pointer.hoverId)
        ctx.strokeStyle = '#ffff00'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        if (slot) {
            ctx.beginPath()
            ctx.arc(slot.x, slot.y, 30, 0, Math.PI * 2)
            ctx.stroke()
        } else if (barricade) {
            ctx.strokeRect(
                barricade.x - 2,
                barricade.y - 2,
                barricade.width + 4,
                barricade.height + 4,
            )
        }
        ctx.setLineDash([])
        if (slot?.tower) drawTowerUpgradeHint(ctx, slot.tower)
        else if (barricade) drawBarricadeUpgradeHint(ctx, barricade)
    }
    const slot = scene.slots.find((slot) => slot.id === pointer.slotId)
    if (slot && pointer.build) {
        ctx.strokeStyle = '#00ff00'
        ctx.lineWidth = 3
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        ctx.arc(slot.x, slot.y, 25, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)'
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.fillStyle = '#00ff00'
        ctx.font = 'bold 12px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(pointer.build.name, slot.x, slot.y - 35)
        ctx.fillText(`💎 ${pointer.build.cost}`, slot.x, slot.y - 50)
    }
    if (pointer.footprint) {
        const rect = pointer.footprint
        // Green where a barricade can stand (track or breach), red elsewhere.
        ctx.strokeStyle = pointer.footprintValid ? '#00ff00' : '#ff0000'
        ctx.fillStyle = pointer.footprintValid ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)'
        ctx.lineWidth = 3
        ctx.globalAlpha = 0.8
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
        ctx.globalAlpha = 1
    }
    // The barricade footprint already shows where the build goes.
    if (pointer.build && pointer.world && !pointer.footprint) {
        const { x, y } = pointer.world
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)'
        ctx.lineWidth = 2
        if (pointer.build.category === 'tower') {
            ctx.beginPath()
            ctx.arc(x, y, 20, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
        } else {
            ctx.fillRect(x - 20, y - 20, 40, 40)
            ctx.strokeRect(x - 20, y - 20, 40, 40)
        }
    }
    ctx.restore()
}
