import { viewRect } from '@/application/session/scene'
import type { Scene } from '@/application/session/scene'
import { fitViewport } from '@/application/session/viewport'
import { drawLevel } from './levelRenderer'
import { drawTowerRange, drawTowerSlot } from './towerRenderer'
import { drawBarricade } from './barricadeRenderer'
import { drawEnemy } from './enemyRenderer'
import { drawLivingQuarters } from './livingQuartersRenderer'
import { drawOverlays } from './overlayRenderer'

export function renderScene(
    ctx: CanvasRenderingContext2D,
    scene: Scene,
    width: number,
    height: number,
): void {
    ctx.save()
    try {
        ctx.fillStyle = '#0a0a0a'
        ctx.fillRect(0, 0, width, height)
        const viewport = fitViewport(viewRect(scene.level, scene.view), width, height)
        ctx.translate(viewport.offsetX, viewport.offsetY)
        ctx.scale(viewport.scale, viewport.scale)
        if (scene.view === 'living') {
            drawLivingQuarters(ctx, scene)
        } else {
            drawLevel(ctx, scene.level)
            for (const barricade of scene.barricades) drawBarricade(ctx, barricade)
            for (const slot of scene.slots) {
                drawTowerSlot(ctx, slot)
                if (slot.tower && scene.selectedId === slot.id) drawTowerRange(ctx, slot.tower)
            }
            for (const enemy of scene.enemies) {
                if (enemy.alive && enemy.spawned) drawEnemy(ctx, enemy)
            }
            drawOverlays(ctx, scene)
        }
    } finally {
        ctx.restore()
    }
}
