<script setup lang="ts">
    import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

    export type DrawFn = (ctx: CanvasRenderingContext2D, width: number, height: number) => void

    const { draw } = defineProps<{ draw: DrawFn }>()

    const emit = defineEmits<{
        pointerMove: [x: number, y: number]
        pointerDown: [x: number, y: number]
    }>()

    const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
    let frameId = 0
    let resizeObserver: ResizeObserver | null = null

    // Keep the backing store in sync with CSS size and device pixel ratio.
    function resize() {
        const element = canvas.value
        if (!element) return
        const dpr = window.devicePixelRatio || 1
        element.width = Math.round(element.clientWidth * dpr)
        element.height = Math.round(element.clientHeight * dpr)
    }

    function frame() {
        const element = canvas.value
        const ctx = element?.getContext('2d')
        if (element && ctx) {
            const dpr = window.devicePixelRatio || 1
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            draw(ctx, element.clientWidth, element.clientHeight)
        }
        frameId = requestAnimationFrame(frame)
    }

    function toLocal(event: PointerEvent): [number, number] {
        const rect = canvas.value!.getBoundingClientRect()
        return [event.clientX - rect.left, event.clientY - rect.top]
    }

    onMounted(() => {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(canvas.value!)
        resize()
        frameId = requestAnimationFrame(frame)
    })

    onBeforeUnmount(() => {
        cancelAnimationFrame(frameId)
        resizeObserver?.disconnect()
    })
</script>

<template>
    <canvas
        ref="canvas"
        class="game-canvas"
        data-testid="game-canvas"
        @pointermove="emit('pointerMove', ...toLocal($event))"
        @pointerdown="emit('pointerDown', ...toLocal($event))"
    />
</template>

<style scoped lang="scss">
    .game-canvas {
        display: block;
        width: 100%;
        height: 100%;
        background-color: $color-surface;
    }
</style>
