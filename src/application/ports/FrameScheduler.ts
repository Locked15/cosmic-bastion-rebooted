// Drives the simulation in real time. `onTick` receives elapsed time in 60 fps frames.
export interface FrameScheduler {
    start(onTick: (frames: number) => void): void
    stop(): void
}
