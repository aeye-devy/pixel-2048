import { createGameLoop } from './game/loop.ts'

const BG_COLOR = '#1a1a2e'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('Canvas 2D context not available')

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
window.addEventListener('resize', resize)
resize()

const loop = createGameLoop(
  ctx,
  (_dt) => {
    // no game logic yet — shell only
  },
  (renderCtx) => {
    renderCtx.fillStyle = BG_COLOR
    renderCtx.fillRect(0, 0, canvas.width, canvas.height)
  },
)

loop.start()
