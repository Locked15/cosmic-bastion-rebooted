export interface Point {
    x: number
    y: number
}
export interface Rect extends Point {
    width: number
    height: number
}
export function distance(a: Point, b: Point): number {
    return Math.hypot(b.x - a.x, b.y - a.y)
}
export function pointInRect(p: Point, r: Rect): boolean {
    return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
}
export function rectsOverlap(a: Rect, b: Rect): boolean {
    return (
        a.x <= b.x + b.width &&
        a.x + a.width >= b.x &&
        a.y <= b.y + b.height &&
        a.y + a.height >= b.y
    )
}
export function lineIntersectsRect(a: Point, b: Point, r: Rect): boolean {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const edges = [
        [-dx, a.x - r.x],
        [dx, r.x + r.width - a.x],
        [-dy, a.y - r.y],
        [dy, r.y + r.height - a.y],
    ] as const
    let t0 = 0
    let t1 = 1
    for (const [p, q] of edges) {
        if (p === 0) {
            if (q < 0) return false
        } else {
            const t = q / p
            if (p < 0) t0 = Math.max(t0, t)
            else t1 = Math.min(t1, t)
            if (t0 > t1) return false
        }
    }
    return true
}
