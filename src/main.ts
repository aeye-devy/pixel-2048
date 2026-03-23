import { createGameLoop } from './game/loop.js'
import { createInitialState, moveDetailed, continueAfterGameOver } from './game/engine.js'
import type { Direction, GameState, Grid } from './game/engine.js'
import { createRenderer } from './game/renderer.js'
import { createMockAdProvider } from './ads/adProvider.js'
import { fireAdEvent, trackEvent, trackPageView } from './ads/analytics.js'
import { createSoundEngine } from './audio/soundEngine.js'
import { loadStats, saveStats, recordGameEnd } from './game/stats.js'

const INPUT_LOCK_MS = 180 // block input during slide animation
const SWIPE_THRESHOLD = 30 // minimum pixels to register a swipe
const BEST_SCORE_KEY = 'pixel2048-best'
const MAX_UNDOS_PER_GAME = 1
const MAX_CONTINUES_PER_GAME = 1
const GRID_CELLS = 16

function boardTension(grid: Grid): number {
  let empty = 0
  for (const row of grid) {
    for (const cell of row) {
      if (cell === 0) empty++
    }
  }
  return 1 - empty / GRID_CELLS
}

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
let previousState: GameState | null = null
let undosUsed = 0
let continuesUsed = 0
let adPlaying = false
let showStats = false
let gameStats = loadStats()
let gameEndRecorded = false
const renderer = createRenderer()
const adProvider = createMockAdProvider()
const sound = createSoundEngine()
renderer.init(gameState)
sound.startBgm()

let inputLocked = false

function handleDirection(dir: Direction): void {
  if (inputLocked || gameState.over || adPlaying || showStats) return
  const detail = moveDetailed(gameState, dir)
  if (detail.state === gameState) return
  const prevWon = gameState.won
  previousState = gameState
  gameState = detail.state
  if (gameState.score > bestScore) {
    bestScore = gameState.score
    saveBestScore(bestScore)
  }
  renderer.applyMove(detail.motions, detail.spawnedAt, detail.state)
  // Audio: find highest merge value from motions
  const mergeMotion = detail.motions.find((m) => !m.absorbed && m.value > 0 &&
    detail.motions.some((a) => a.absorbed && a.toRow === m.toRow && a.toCol === m.toCol))
  if (mergeMotion) {
    sound.play('merge', mergeMotion.value)
  } else if (detail.motions.length > 0) {
    sound.play('slide')
  }
  if (detail.spawnedAt !== null) {
    setTimeout(() => { sound.play('spawn') }, 100)
  }
  if (gameState.won && !prevWon) {
    trackEvent('win_2048', { score: gameState.score })
    setTimeout(() => { sound.play('win') }, 200)
  }
  if (gameState.over && !gameEndRecorded) {
    trackEvent('game_over', { score: gameState.score })
    setTimeout(() => { sound.play('gameOver') }, 200)
    sound.stopBgm()
    gameStats = recordGameEnd(gameStats, gameState.grid, gameState.score, gameState.won)
    saveStats(gameStats)
    gameEndRecorded = true
  }
  sound.setBgmTension(boardTension(gameState.grid))
  inputLocked = true
  setTimeout(() => {
    inputLocked = false
  }, INPUT_LOCK_MS)
}

function newGame(): void {
  gameState = createInitialState()
  continueMode = false
  previousState = null
  undosUsed = 0
  continuesUsed = 0
  adPlaying = false
  gameEndRecorded = false
  showStats = false
  renderer.init(gameState)
  sound.setBgmTension(0)
  sound.startBgm()
  trackEvent('game_start')
}

function continueGame(): void {
  continueMode = true
}

async function handleWatchAdUndo(): Promise<void> {
  if (undosUsed >= MAX_UNDOS_PER_GAME || previousState === null || adPlaying) return
  fireAdEvent('ad_prompt_shown', { placement: 'undo' })
  adPlaying = true
  const result = await adProvider.showRewardedAd()
  adPlaying = false
  if (result === 'rewarded') {
    fireAdEvent('ad_watched', { placement: 'undo' })
    gameState = previousState
    previousState = null
    undosUsed++
    renderer.init(gameState)
  } else if (result === 'skipped') {
    fireAdEvent('ad_skipped', { placement: 'undo' })
  } else {
    fireAdEvent('ad_failed', { placement: 'undo' })
  }
}

async function handleWatchAdContinue(): Promise<void> {
  if (continuesUsed >= MAX_CONTINUES_PER_GAME || !gameState.over || adPlaying) return
  fireAdEvent('ad_prompt_shown', { placement: 'continue' })
  adPlaying = true
  const result = await adProvider.showRewardedAd()
  adPlaying = false
  if (result === 'rewarded') {
    fireAdEvent('ad_watched', { placement: 'continue' })
    gameState = continueAfterGameOver(gameState)
    continuesUsed++
    renderer.init(gameState)
    sound.setBgmTension(boardTension(gameState.grid))
    sound.startBgm()
  } else if (result === 'skipped') {
    fireAdEvent('ad_skipped', { placement: 'continue' })
  } else {
    fireAdEvent('ad_failed', { placement: 'continue' })
  }
}

function handleCanvasTap(clientX: number, clientY: number): void {
  sound.unlock() // resume AudioContext on user gesture (mobile requirement)
  if (adPlaying) return
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const px = (clientX - rect.left) * scaleX
  const py = (clientY - rect.top) * scaleY
  const action = renderer.getButtonAt(px, py)
  if (action === 'mute') {
    sound.toggleMute()
    sound.play('buttonTap')
    return
  }
  if (action === 'close-stats') {
    showStats = false
    sound.play('buttonTap')
    return
  }
  if (showStats) return // block all other actions while stats overlay is open
  if (action !== null) sound.play('buttonTap')
  if (action === 'new-game') newGame()
  else if (action === 'continue') continueGame()
  else if (action === 'undo') void handleWatchAdUndo()
  else if (action === 'watch-ad-continue') void handleWatchAdContinue()
  else if (action === 'stats') { showStats = true }
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
  sound.unlock()
  const dir = KEY_MAP[e.key]
  if (dir !== undefined) {
    e.preventDefault()
    handleDirection(dir)
    return
  }
  if (e.key === 'Escape' && showStats) {
    showStats = false
    return
  }
  if (e.key === 'r' || e.key === 'R') {
    newGame()
  }
  if (e.key === 'm' || e.key === 'M') {
    sound.toggleMute()
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
    const undoAvailable = previousState !== null && undosUsed < MAX_UNDOS_PER_GAME
    renderer.render(renderCtx, canvas.width, canvas.height, {
      score: gameState.score,
      bestScore,
      isOver: gameState.over,
      isWon: gameState.won && !continueMode,
      undoAvailable,
      continueWithAdAvailable: gameState.over && continuesUsed < MAX_CONTINUES_PER_GAME,
      isAdPlaying: adPlaying,
      isMuted: sound.isMuted(),
      showStats,
      stats: gameStats,
    })
  },
)

trackPageView()
trackEvent('game_start')
loop.start()
