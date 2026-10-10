import type { FrameScheduler } from '@/application/ports/FrameScheduler'

const FRAME_MS = 1000 / 60
// Cap catch-up after a background tab or breakpoint so the game does not jump.
const MAX_FRAMES_PER_TICK = 2

export class RafScheduler implements FrameScheduler {
    private frameId = 0
    private last = 0

    start(onTick: (frames: number) => void): void {
        this.stop()
        this.last = performance.now()
        const loop = (now: number) => {
            const frames = Math.min((now - this.last) / FRAME_MS, MAX_FRAMES_PER_TICK)
            this.last = now
            onTick(frames)
            this.frameId = requestAnimationFrame(loop)
        }
        this.frameId = requestAnimationFrame(loop)
    }

    stop(): void {
        cancelAnimationFrame(this.frameId)
        this.frameId = 0
    }
}
