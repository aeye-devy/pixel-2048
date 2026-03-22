export type UpdateFn = (dt: number) => void
export type RenderFn = (ctx: CanvasRenderingContext2D) => void

export interface GameLoop {
  start(): void
  stop(): void
}

export function createGameLoop(
  ctx: CanvasRenderingContext2D,
  update: UpdateFn,
  render: RenderFn,
): GameLoop {
  let rafId = 0
  let lastTime = 0
  let running = false
  function tick(timestamp: number) {
    if (!running) return
    const dt = lastTime === 0 ? 0 : (timestamp - lastTime) / 1000
    lastTime = timestamp
    update(dt)
    render(ctx)
    rafId = requestAnimationFrame(tick)
  }
  return {
    start() {
      if (running) return
      running = true
      lastTime = 0
      rafId = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      cancelAnimationFrame(rafId)
    },
  }
}
