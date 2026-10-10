import type { Point, Rect } from '@/domain'

// Uniform scale that fits a world rectangle into the canvas, centered.
export interface Viewport {
    scale: number
    offsetX: number
    offsetY: number
}

export function fitViewport(world: Rect, canvasWidth: number, canvasHeight: number): Viewport {
    const scale = Math.min(canvasWidth / world.width, canvasHeight / world.height)
    return {
        scale,
        offsetX: (canvasWidth - world.width * scale) / 2 - world.x * scale,
        offsetY: (canvasHeight - world.height * scale) / 2 - world.y * scale,
    }
}

export function screenToWorld(viewport: Viewport, x: number, y: number): Point {
    return {
        x: (x - viewport.offsetX) / viewport.scale,
        y: (y - viewport.offsetY) / viewport.scale,
    }
}
