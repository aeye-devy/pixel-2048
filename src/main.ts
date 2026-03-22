import { createGameLoop } from './game/loop.js'
import { createInitialState, moveDetailed } from './game/engine.js'
import type { Direction } from './game/engine.js'
import { createRenderer } from './game/renderer.js'

const INPUT_LOCK_MS = 180 // block input during slide animation

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('Canvas 2D context not available')

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
window.addEventListener('resize', resize)
resize()

let gameState = createInitialState()
const renderer = createRenderer()
renderer.init(gameState)

let inputLocked = false

function handleDirection(dir: Direction): void {
  if (inputLocked || gameState.over) return
  const detail = moveDetailed(gameState, dir)
  if (detail.state === gameState) return
  gameState = detail.state
  renderer.applyMove(detail.motions, detail.spawnedAt, detail.state)
  inputLocked = true
  setTimeout(() => {
    inputLocked = false
  }, INPUT_LOCK_MS)
}

function newGame(): void {
  gameState = createInitialState()
  renderer.init(gameState)
}

const KEY_MAP: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
}

window.addEventListener('keydown', (e: KeyboardEvent) => {
  const dir = KEY_MAP[e.key]
  if (dir !== undefined) {
    e.preventDefault()
    handleDirection(dir)
    return
  }
  if (e.key === 'r' || e.key === 'R') {
    newGame()
  }
})

const loop = createGameLoop(
  ctx,
  (dt) => {
    renderer.update(dt)
  },
  (renderCtx) => {
    renderer.render(renderCtx, canvas.width, canvas.height, gameState.score, gameState.over, gameState.won)
  },
)

loop.start()
