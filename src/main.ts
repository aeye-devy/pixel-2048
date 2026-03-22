import { createGameLoop } from './game/loop.js'
import { createInitialState, moveDetailed } from './game/engine.js'
import type { Direction } from './game/engine.js'
import { createRenderer } from './game/renderer.js'

const INPUT_LOCK_MS = 180 // block input during slide animation
const SWIPE_THRESHOLD = 30 // minimum pixels to register a swipe
const BEST_SCORE_KEY = 'pixel2048-best'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('Canvas 2D context not available')

function loadBestScore(): number {
  const stored = localStorage.getItem(BEST_SCORE_KEY)
  return stored !== null ? parseInt(stored, 10) : 0
}

function saveBestScore(score: number): void {
  localStorage.setItem(BEST_SCORE_KEY, String(score))
}

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
window.addEventListener('resize', resize)
resize()

let gameState = createInitialState()
let bestScore = loadBestScore()
let continueMode = false
const renderer = createRenderer()
renderer.init(gameState)

let inputLocked = false

function handleDirection(dir: Direction): void {
  if (inputLocked || gameState.over) return
  const detail = moveDetailed(gameState, dir)
  if (detail.state === gameState) return
  gameState = detail.state
  if (gameState.score > bestScore) {
    bestScore = gameState.score
    saveBestScore(bestScore)
  }
  renderer.applyMove(detail.motions, detail.spawnedAt, detail.state)
  inputLocked = true
  setTimeout(() => {
    inputLocked = false
  }, INPUT_LOCK_MS)
}

function newGame(): void {
  gameState = createInitialState()
  continueMode = false
  renderer.init(gameState)
}

function continueGame(): void {
  continueMode = true
}

function handleCanvasTap(clientX: number, clientY: number): void {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const px = (clientX - rect.left) * scaleX
  const py = (clientY - rect.top) * scaleY
  const action = renderer.getButtonAt(px, py)
  if (action === 'new-game') newGame()
  else if (action === 'continue') continueGame()
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

canvas.addEventListener('click', (e: MouseEvent) => {
  handleCanvasTap(e.clientX, e.clientY)
})

let touchStartX = 0
let touchStartY = 0

canvas.addEventListener(
  'touchstart',
  (e: TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    if (!touch) return
    touchStartX = touch.clientX
    touchStartY = touch.clientY
  },
  { passive: false },
)

canvas.addEventListener(
  'touchend',
  (e: TouchEvent) => {
    e.preventDefault()
    const touch = e.changedTouches[0]
    if (!touch) return
    const dx = touch.clientX - touchStartX
    const dy = touch.clientY - touchStartY
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    if (Math.max(absX, absY) < SWIPE_THRESHOLD) {
      handleCanvasTap(touch.clientX, touch.clientY)
      return
    }
    if (absX > absY) {
      handleDirection(dx > 0 ? 'right' : 'left')
    } else {
      handleDirection(dy > 0 ? 'down' : 'up')
    }
  },
  { passive: false },
)

const loop = createGameLoop(
  ctx,
  (dt) => {
    renderer.update(dt)
  },
  (renderCtx) => {
    const showWin = gameState.won && !continueMode
    renderer.render(
      renderCtx,
      canvas.width,
      canvas.height,
      gameState.score,
      bestScore,
      gameState.over,
      showWin,
    )
  },
)

loop.start()
