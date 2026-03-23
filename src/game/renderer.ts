import type { GameState, TileMotion } from './engine.js'
import type { GameStats } from './stats.js'
import type { DailyData, DailyResult } from './daily.js'
import { drawTile as paintTile, drawEmptyTile } from '../render/tilePainter.js'
import { TILE_STYLES, FALLBACK_STYLE } from '../render/tileStyle.js'
import { drawText } from '../render/bitmapFont.js'

const GRID_SIZE_N = 4
const SLIDE_DUR = 0.15 // seconds
const APPEAR_DUR = 0.1
const POP_DUR = 0.15
const SCORE_DELTA_DUR = 0.5
const COMBO_DUR = 0.8
const HEADER_H = 90

const BG_COLOR = '#1a1a2e'
const GRID_BG_COLOR = '#16213e'
const HEADER_BG = '#0d1b2a'
const SCORE_BOX_BG = '#2d3154'
const BTN_BG = '#3a3f6b'
const AD_BTN_BG = '#5a4a10' // gold-tinted for ad-powered buttons

type Phase =
  | { kind: 'idle' }
  | { kind: 'slide'; fromRow: number; fromCol: number; t: number; willPop: boolean }
  | { kind: 'appear'; t: number }
  | { kind: 'pop'; t: number }
  | { kind: 'absorbed'; destRow: number; destCol: number; t: number }

interface AnimTile {
  id: number
  value: number
  row: number
  col: number
  phase: Phase
}

interface ScoreDelta {
  value: number
  row: number
  col: number
  t: number
  tileValue: number
}

interface ComboAnim {
  count: number
  t: number
}

interface HitArea {
  x: number
  y: number
  w: number
  h: number
  action: ButtonAction
}

export type ButtonAction = 'new-game' | 'continue' | 'undo' | 'watch-ad-continue' | 'mute' | 'stats' | 'close-stats' | 'share' | 'daily' | 'daily-play' | 'close-daily'

export interface RenderOptions {
  score: number
  bestScore: number
  isOver: boolean
  isWon: boolean
  undoAvailable: boolean
  continueWithAdAvailable: boolean
  isAdPlaying: boolean
  isMuted: boolean
  showStats: boolean
  stats: GameStats
  isDailyMode: boolean
  showDailyOverlay: boolean
  dailyData: DailyData | null
  dailyResult: DailyResult | null
}

export interface Renderer {
  init(state: GameState): void
  applyMove(motions: TileMotion[], spawnedAt: [number, number] | null, newState: GameState): void
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D, width: number, height: number, opts: RenderOptions): void
  getButtonAt(px: number, py: number): ButtonAction | null
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

export function createRenderer(): Renderer {
  let tiles: AnimTile[] = []
  let nextId = 0
  let time = 0
  let hitAreas: HitArea[] = []
  let scoreDeltaList: ScoreDelta[] = []
  let comboAnim: ComboAnim | null = null
  const newId = () => nextId++

  function init(state: GameState): void {
    tiles = []
    nextId = 0
    time = 0
    scoreDeltaList = []
    comboAnim = null
    for (let r = 0; r < GRID_SIZE_N; r++) {
      for (let c = 0; c < GRID_SIZE_N; c++) {
        const val = state.grid[r]?.[c] ?? 0
        if (val !== 0) {
          tiles.push({ id: newId(), value: val, row: r, col: c, phase: { kind: 'idle' } })
        }
      }
    }
  }

  function applyMove(motions: TileMotion[], spawnedAt: [number, number] | null, newState: GameState): void {
    if (motions.length === 0 && spawnedAt === null) return
    const motionMap = new Map<string, TileMotion>()
    for (const m of motions) {
      motionMap.set(String(m.fromRow) + ',' + String(m.fromCol), m)
    }
    const next: AnimTile[] = []
    for (const tile of tiles) {
      const motion = motionMap.get(String(tile.row) + ',' + String(tile.col))
      if (motion === undefined) {
        next.push({ ...tile, phase: { kind: 'idle' } })
        continue
      }
      if (motion.absorbed) {
        next.push({
          ...tile,
          phase: { kind: 'absorbed', destRow: motion.toRow, destCol: motion.toCol, t: 0 },
        })
      } else {
        const moved = motion.fromRow !== motion.toRow || motion.fromCol !== motion.toCol
        const merged = motion.value !== tile.value
        if (merged) {
          scoreDeltaList.push({ value: motion.value, row: motion.toRow, col: motion.toCol, t: 0, tileValue: motion.value })
        }
        if (moved) {
          next.push({
            ...tile,
            value: motion.value,
            row: motion.toRow,
            col: motion.toCol,
            phase: { kind: 'slide', fromRow: tile.row, fromCol: tile.col, t: 0, willPop: merged },
          })
        } else {
          next.push({
            ...tile,
            value: motion.value,
            phase: merged ? { kind: 'pop', t: 0 } : { kind: 'idle' },
          })
        }
      }
    }
    if (spawnedAt !== null) {
      const [r, c] = spawnedAt
      const val = newState.grid[r]?.[c] ?? 2
      next.push({ id: newId(), value: val, row: r, col: c, phase: { kind: 'appear', t: 0 } })
    }
    tiles = next
    const mergeCount = motions.filter((m) => m.absorbed).length
    if (mergeCount >= 2) {
      comboAnim = { count: mergeCount, t: 0 }
    }
  }

  function update(dt: number): void {
    time += dt
    for (const tile of tiles) {
      const p = tile.phase
      if (p.kind === 'slide') {
        p.t = Math.min(p.t + dt / SLIDE_DUR, 1)
        if (p.t >= 1) tile.phase = p.willPop ? { kind: 'pop', t: 0 } : { kind: 'idle' }
      } else if (p.kind === 'appear') {
        p.t = Math.min(p.t + dt / APPEAR_DUR, 1)
        if (p.t >= 1) tile.phase = { kind: 'idle' }
      } else if (p.kind === 'pop') {
        p.t = Math.min(p.t + dt / POP_DUR, 1)
        if (p.t >= 1) tile.phase = { kind: 'idle' }
      } else if (p.kind === 'absorbed') {
        p.t = Math.min(p.t + dt / SLIDE_DUR, 1)
      }
    }
    tiles = tiles.filter((t) => !(t.phase.kind === 'absorbed' && t.phase.t >= 1))
    for (const sd of scoreDeltaList) {
      sd.t = Math.min(sd.t + dt / SCORE_DELTA_DUR, 1)
    }
    scoreDeltaList = scoreDeltaList.filter((sd) => sd.t < 1)
    if (comboAnim !== null) {
      comboAnim.t = Math.min(comboAnim.t + dt / COMBO_DUR, 1)
      if (comboAnim.t >= 1) comboAnim = null
    }
  }

  function getVisualPos(tile: AnimTile): { row: number; col: number } {
    const p = tile.phase
    if (p.kind === 'slide') {
      const t = easeOut(p.t)
      return { row: p.fromRow + (tile.row - p.fromRow) * t, col: p.fromCol + (tile.col - p.fromCol) * t }
    }
    if (p.kind === 'absorbed') {
      const t = easeOut(p.t)
      return { row: tile.row + (p.destRow - tile.row) * t, col: tile.col + (p.destCol - tile.col) * t }
    }
    return { row: tile.row, col: tile.col }
  }

  function getAnimScale(tile: AnimTile): number {
    const p = tile.phase
    if (p.kind === 'appear') return easeOut(p.t)
    if (p.kind === 'pop') return 1 + 0.2 * Math.sin(Math.PI * p.t)
    return 1
  }

  function getMergeFlash(phase: Phase): number {
    if (phase.kind === 'pop' && phase.t < 0.3) return (1 - phase.t / 0.3) * 0.7
    return 0
  }

  function getGridLayout(width: number, height: number) {
    const pad = 16
    const availW = width - 2 * pad
    const availH = height - HEADER_H - 2 * pad
    const gridSize = Math.floor(Math.min(availW, availH))
    const gridX = Math.floor((width - gridSize) / 2)
    const gridY = HEADER_H + pad
    const gap = Math.max(8, Math.floor(gridSize * 0.025))
    const tileSize = Math.floor((gridSize - gap * (GRID_SIZE_N + 1)) / GRID_SIZE_N)
    return { gridX, gridY, gridSize, gap, tileSize }
  }

  function toPixelX(col: number, gridX: number, gap: number, tileSize: number): number {
    return gridX + gap + col * (tileSize + gap)
  }

  function toPixelY(row: number, gridY: number, gap: number, tileSize: number): number {
    return gridY + gap + row * (tileSize + gap)
  }

  // Renders a tile with pixel art visuals, applying scale transform for animations.
  function renderAnimTile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    value: number,
    animScale: number,
    mergeFlashAlpha: number,
  ): void {
    const cx = x + size / 2
    const cy = y + size / 2
    const s = Math.round(size * animScale)
    const tx = Math.round(cx - s / 2)
    const ty = Math.round(cy - s / 2)
    paintTile(ctx, value, tx, ty, s, time, mergeFlashAlpha)
  }

  function drawPixelButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    fontSize: number,
    bgColor = BTN_BG,
  ): void {
    const rx = Math.round(x)
    const ry = Math.round(y)
    ctx.fillStyle = bgColor
    ctx.fillRect(rx, ry, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(rx, ry, w, 2)
    ctx.fillRect(rx, ry, 2, h)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(rx, ry + h - 2, w, 2)
    ctx.fillRect(rx + w - 2, ry, 2, h)
    ctx.fillStyle = '#f9f6f2'
    ctx.font = 'bold ' + String(fontSize) + "px 'Courier New', monospace"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, rx + Math.round(w / 2), ry + Math.round(h / 2))
  }

  function drawScoreBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: number,
  ): void {
    const rx = Math.round(x)
    const ry = Math.round(y)
    ctx.fillStyle = SCORE_BOX_BG
    ctx.fillRect(rx, ry, w, h)
    ctx.fillStyle = '#bbada0'
    ctx.font = 'bold 10px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(label, rx + Math.round(w / 2), ry + 6)
    ctx.fillStyle = '#f9f6f2'
    const fs = value >= 100000 ? 13 : value >= 10000 ? 15 : 18
    ctx.font = 'bold ' + String(fs) + 'px "Courier New", monospace'
    ctx.textBaseline = 'bottom'
    ctx.fillText(String(value), rx + Math.round(w / 2), ry + h - 6)
  }

  function drawMuteButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    muted: boolean,
  ): void {
    const rx = Math.round(x)
    const ry = Math.round(y)
    // Background
    ctx.fillStyle = muted ? '#5a2a2a' : '#2d3154'
    ctx.fillRect(rx, ry, size, size)
    // Pixel art speaker icon using small rectangles
    const p = Math.max(2, Math.floor(size / 8)) // pixel unit
    const cx = rx + Math.floor(size / 2)
    const cy = ry + Math.floor(size / 2)
    ctx.fillStyle = '#f9f6f2'
    // Speaker body (left rectangle)
    ctx.fillRect(cx - 3 * p, cy - p, 2 * p, 2 * p)
    // Speaker cone (triangle approximation with rectangles)
    ctx.fillRect(cx - p, cy - 2 * p, p, 4 * p)
    // Sound waves (right side)
    if (!muted) {
      ctx.fillRect(cx + p, cy - p, p, 2 * p)
      ctx.fillRect(cx + 2 * p, cy - 2 * p, p, 4 * p)
    } else {
      // X mark for muted
      ctx.fillStyle = '#ff6666'
      ctx.fillRect(cx + p, cy - 2 * p, p, p)
      ctx.fillRect(cx + 2 * p, cy - p, p, p)
      ctx.fillRect(cx + 2 * p, cy + p, p, p)
      ctx.fillRect(cx + p, cy + 2 * p, p, p)
    }
    hitAreas.push({ x: rx, y: ry, w: size, h: size, action: 'mute' })
  }

  function drawHeader(
    ctx: CanvasRenderingContext2D,
    width: number,
    score: number,
    bestScore: number,
    isMuted: boolean,
    isDailyMode: boolean,
  ): void {
    ctx.fillStyle = HEADER_BG
    ctx.fillRect(0, 0, width, HEADER_H)
    ctx.fillStyle = '#f9f6f2'
    ctx.font = 'bold 30px "Courier New", monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('2048', 16, HEADER_H / 2)
    // Mute button next to title
    const muteSize = 32
    const muteX = 16 + 78 // after "2048" text
    const muteY = Math.round((HEADER_H - muteSize) / 2)
    drawMuteButton(ctx, muteX, muteY, muteSize, isMuted)
    const itemW = Math.min(84, Math.floor(width * 0.21))
    const boxH = 52
    const btnH = 38
    const edgeMargin = 12
    const itemGap = 8
    const boxY = Math.round((HEADER_H - boxH) / 2)
    const btnY = Math.round((HEADER_H - btnH) / 2)
    // Right side: NEW GAME | DAILY | STATS | BEST | SCORE
    const btnX = width - edgeMargin - itemW
    drawPixelButton(ctx, btnX, btnY, itemW, btnH, 'NEW GAME', 10)
    hitAreas.push({ x: btnX, y: btnY, w: itemW, h: btnH, action: 'new-game' })
    const dailyX = btnX - itemGap - itemW
    const dailyBg = isDailyMode ? '#2a5a3a' : '#5a4a10'
    drawPixelButton(ctx, dailyX, btnY, itemW, btnH, 'DAILY', 10, dailyBg)
    hitAreas.push({ x: dailyX, y: btnY, w: itemW, h: btnH, action: 'daily' })
    const statsX = dailyX - itemGap - itemW
    drawPixelButton(ctx, statsX, btnY, itemW, btnH, 'STATS', 10)
    hitAreas.push({ x: statsX, y: btnY, w: itemW, h: btnH, action: 'stats' })
    const bestX = statsX - itemGap - itemW
    drawScoreBox(ctx, bestX, boxY, itemW, boxH, 'BEST', bestScore)
    const scoreX = bestX - itemGap - itemW
    drawScoreBox(ctx, scoreX, boxY, itemW, boxH, 'SCORE', score)
  }

  function drawOverlay(
    ctx: CanvasRenderingContext2D,
    gridX: number,
    gridY: number,
    gridSize: number,
    score: number,
    isOver: boolean,
    continueWithAdAvailable: boolean,
  ): void {
    const cx = Math.round(gridX + gridSize / 2)
    ctx.fillStyle = isOver ? 'rgba(20,20,40,0.82)' : 'rgba(237,194,46,0.82)'
    ctx.fillRect(gridX, gridY, gridSize, gridSize)
    ctx.fillStyle = isOver ? '#f9f6f2' : '#1a1a2e'
    const titleFontSize = Math.round(gridSize * 0.1)
    ctx.font = 'bold ' + String(titleFontSize) + 'px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(isOver ? 'GAME OVER' : 'YOU WIN!', cx, Math.round(gridY + gridSize * 0.32))
    const scoreFontSize = Math.round(gridSize * 0.065)
    ctx.font = String(scoreFontSize) + 'px "Courier New", monospace'
    ctx.fillText('Score: ' + String(score), cx, Math.round(gridY + gridSize * 0.46))
    const btnW = Math.round(gridSize * 0.42)
    const btnH = Math.round(Math.max(32, gridSize * 0.1))
    const btnFontSize = Math.round(Math.max(10, gridSize * 0.055))
    const btnY = Math.round(gridY + gridSize * 0.56)
    if (!isOver) {
      // Win overlay: CONTINUE (no ad) + NEW GAME
      const spacing = Math.round(gridSize * 0.04)
      const startX = cx - Math.round((btnW * 2 + spacing) / 2)
      drawPixelButton(ctx, startX, btnY, btnW, btnH, 'CONTINUE', btnFontSize)
      hitAreas.push({ x: startX, y: btnY, w: btnW, h: btnH, action: 'continue' })
      const ngX = startX + btnW + spacing
      drawPixelButton(ctx, ngX, btnY, btnW, btnH, 'NEW GAME', btnFontSize)
      hitAreas.push({ x: ngX, y: btnY, w: btnW, h: btnH, action: 'new-game' })
    } else if (continueWithAdAvailable) {
      // Game over with ad-continue available: WATCH AD (gold) + NEW GAME
      const spacing = Math.round(gridSize * 0.04)
      const startX = cx - Math.round((btnW * 2 + spacing) / 2)
      drawPixelButton(ctx, startX, btnY, btnW, btnH, '▶ CONTINUE', btnFontSize, AD_BTN_BG)
      hitAreas.push({ x: startX, y: btnY, w: btnW, h: btnH, action: 'watch-ad-continue' })
      const ngX = startX + btnW + spacing
      drawPixelButton(ctx, ngX, btnY, btnW, btnH, 'NEW GAME', btnFontSize)
      hitAreas.push({ x: ngX, y: btnY, w: btnW, h: btnH, action: 'new-game' })
    } else {
      // Game over, no continues left: just NEW GAME
      const btnX = cx - Math.round(btnW / 2)
      drawPixelButton(ctx, btnX, btnY, btnW, btnH, 'NEW GAME', btnFontSize)
      hitAreas.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: 'new-game' })
    }
    // SHARE button below main buttons
    const shareBtnW = Math.round(gridSize * 0.32)
    const shareBtnH = btnH
    const shareBtnX = cx - Math.round(shareBtnW / 2)
    const shareBtnY = btnY + btnH + Math.round(gridSize * 0.04)
    drawPixelButton(ctx, shareBtnX, shareBtnY, shareBtnW, shareBtnH, 'SHARE', btnFontSize, '#2a5a3a')
    hitAreas.push({ x: shareBtnX, y: shareBtnY, w: shareBtnW, h: shareBtnH, action: 'share' })
  }

  function drawUndoButton(
    ctx: CanvasRenderingContext2D,
    gridX: number,
    gridY: number,
    gridSize: number,
  ): void {
    const btnW = Math.min(130, Math.round(gridSize * 0.38))
    const btnH = Math.round(Math.max(34, gridSize * 0.09))
    const btnX = gridX + Math.round((gridSize - btnW) / 2)
    const btnY = gridY + gridSize + 14
    const btnFontSize = Math.round(Math.max(10, gridSize * 0.05))
    drawPixelButton(ctx, btnX, btnY, btnW, btnH, '▶ UNDO', btnFontSize, AD_BTN_BG)
    hitAreas.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: 'undo' })
  }

  function drawAdOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    ctx.fillStyle = 'rgba(0,0,0,0.88)'
    ctx.fillRect(0, 0, width, height)
    const boxW = Math.min(300, width - 40)
    const boxH = 110
    const bx = Math.round((width - boxW) / 2)
    const by = Math.round((height - boxH) / 2)
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(bx, by, boxW, boxH)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(bx, by, boxW, 2)
    ctx.fillRect(bx, by, 2, boxH)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(bx, by + boxH - 2, boxW, 2)
    ctx.fillRect(bx + boxW - 2, by, 2, boxH)
    ctx.fillStyle = '#f9f6f2'
    ctx.font = 'bold 17px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Ad Playing...', Math.round(bx + boxW / 2), Math.round(by + boxH / 2 - 14))
    ctx.font = '12px "Courier New", monospace'
    ctx.fillStyle = '#bbada0'
    ctx.fillText('Please wait a moment', Math.round(bx + boxW / 2), Math.round(by + boxH / 2 + 16))
  }

  function drawStatsOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    stats: GameStats,
  ): void {
    // Full screen dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.88)'
    ctx.fillRect(0, 0, width, height)
    const boxW = Math.min(320, width - 40)
    const boxH = 338
    const bx = Math.round((width - boxW) / 2)
    const by = Math.round((height - boxH) / 2)
    // Box background with pixel border
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(bx, by, boxW, boxH)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(bx, by, boxW, 2)
    ctx.fillRect(bx, by, 2, boxH)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(bx, by + boxH - 2, boxW, 2)
    ctx.fillRect(bx + boxW - 2, by, 2, boxH)
    // Title
    const cx = Math.round(bx + boxW / 2)
    ctx.fillStyle = '#edc22e'
    ctx.font = 'bold 20px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('STATISTICS', cx, by + 30)
    // Stats rows
    const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0
    const rows: [string, string][] = [
      ['Games Played', String(stats.gamesPlayed)],
      ['Highest Tile', String(stats.highestTile)],
      ['Total Score', String(stats.totalScore)],
      ['Wins (2048)', String(stats.wins)],
      ['Win Rate', String(winRate) + '%'],
      ['Current Streak', String(stats.currentStreak)],
      ['Best Streak', String(stats.bestStreak)],
      ['Best Combo', stats.bestCombo >= 2 ? String(stats.bestCombo) + 'x' : '-'],
    ]
    const rowH = 28
    const startY = by + 60
    const padX = 20
    for (let i = 0; i < rows.length; i++) {
      const entry = rows[i]
      if (!entry) continue
      const [label, value] = entry
      const ry = startY + i * rowH
      // Alternating subtle row background
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fillRect(bx + 4, ry - 10, boxW - 8, rowH)
      }
      ctx.fillStyle = '#bbada0'
      ctx.font = '13px "Courier New", monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, bx + padX, ry + 4)
      ctx.fillStyle = '#f9f6f2'
      ctx.font = 'bold 14px "Courier New", monospace'
      ctx.textAlign = 'right'
      ctx.fillText(value, bx + boxW - padX, ry + 4)
    }
    // Close button
    const closeBtnW = Math.round(boxW * 0.5)
    const closeBtnH = 34
    const closeBtnX = cx - Math.round(closeBtnW / 2)
    const closeBtnY = by + boxH - 48
    drawPixelButton(ctx, closeBtnX, closeBtnY, closeBtnW, closeBtnH, 'CLOSE', 12)
    hitAreas.push({ x: closeBtnX, y: closeBtnY, w: closeBtnW, h: closeBtnH, action: 'close-stats' })
  }

  function renderCombo(
    ctx: CanvasRenderingContext2D,
    gridX: number,
    gridY: number,
    gridSize: number,
  ): void {
    if (comboAnim === null) return
    const { count, t } = comboAnim
    // Scale: 0.5 → 1.2 (first 30%), hold 1.2 (30%-50%), then fade out
    let scale: number
    let alpha: number
    if (t < 0.3) {
      scale = 0.5 + (0.7 * t) / 0.3
      alpha = 1
    } else if (t < 0.5) {
      scale = 1.2
      alpha = 1
    } else {
      scale = 1.2 - 0.2 * ((t - 0.5) / 0.5)
      alpha = 1 - (t - 0.5) / 0.5
    }
    if (alpha <= 0) return
    const cx = Math.round(gridX + gridSize / 2)
    const cy = Math.round(gridY + gridSize * 0.15)
    const text = String(count) + 'x COMBO!'
    const baseFontSize = Math.round(gridSize * 0.1)
    const fontSize = Math.round(baseFontSize * scale)
    ctx.save()
    ctx.globalAlpha = alpha
    // Pixel art outline (draw text offset in each direction with dark color)
    const outlineOffset = Math.max(2, Math.round(fontSize * 0.06))
    ctx.font = 'bold ' + String(fontSize) + 'px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#1a1a2e'
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      ctx.fillText(text, cx + dx * outlineOffset, cy + dy * outlineOffset)
    }
    // Gold fill with glow
    ctx.shadowColor = '#FFD700'
    ctx.shadowBlur = fontSize * 0.3
    ctx.fillStyle = '#FFD700'
    ctx.fillText(text, cx, cy)
    ctx.shadowBlur = 0
    ctx.restore()
  }

  function renderScoreDeltas(
    ctx: CanvasRenderingContext2D,
    gridX: number,
    gridY: number,
    gap: number,
    tileSize: number,
  ): void {
    const floatDist = Math.round(tileSize * 0.4)
    const scale = tileSize / 16
    const pixSize = Math.max(1, Math.round(scale))
    for (const sd of scoreDeltaList) {
      const progress = easeOut(sd.t)
      const alpha = 1 - progress
      if (alpha <= 0) continue
      const cx = toPixelX(sd.col, gridX, gap, tileSize) + tileSize / 2
      const cy = toPixelY(sd.row, gridY, gap, tileSize) + tileSize / 2 - floatDist * progress
      const text = '+' + String(sd.value)
      const style = TILE_STYLES[sd.tileValue] ?? FALLBACK_STYLE
      const glowColor = style.glowColor ?? style.bg
      ctx.globalAlpha = alpha * 0.7
      drawText(ctx, text, cx, cy + pixSize, glowColor, pixSize)
      ctx.globalAlpha = alpha
      drawText(ctx, text, cx, cy, '#ffffff', pixSize)
      ctx.globalAlpha = 1
    }
  }

  function drawDailyOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dailyData: DailyData,
    dailyResult: DailyResult | null,
  ): void {
    ctx.fillStyle = 'rgba(0,0,0,0.88)'
    ctx.fillRect(0, 0, width, height)
    const boxW = Math.min(320, width - 40)
    const boxH = dailyResult !== null ? 320 : 280
    const bx = Math.round((width - boxW) / 2)
    const by = Math.round((height - boxH) / 2)
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(bx, by, boxW, boxH)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(bx, by, boxW, 2)
    ctx.fillRect(bx, by, 2, boxH)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(bx, by + boxH - 2, boxW, 2)
    ctx.fillRect(bx + boxW - 2, by, 2, boxH)
    const cx = Math.round(bx + boxW / 2)
    ctx.fillStyle = '#edc22e'
    ctx.font = 'bold 20px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('DAILY CHALLENGE', cx, by + 30)
    const padX = 20
    const rowH = 28
    let startY = by + 64
    if (dailyResult !== null) {
      ctx.fillStyle = '#40ff60'
      ctx.font = 'bold 16px "Courier New", monospace'
      ctx.fillText('COMPLETED!', cx, startY)
      startY += 32
      const resultRows: [string, string][] = [
        ['Your Score', String(dailyResult.score)],
        ['Highest Tile', String(dailyResult.highestTile)],
        ['Best Daily', String(dailyData.bestDailyScore)],
      ]
      for (let i = 0; i < resultRows.length; i++) {
        const entry = resultRows[i]
        if (!entry) continue
        const [label, value] = entry
        const ry = startY + i * rowH
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)'
          ctx.fillRect(bx + 4, ry - 10, boxW - 8, rowH)
        }
        ctx.fillStyle = '#bbada0'
        ctx.font = '13px "Courier New", monospace'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, bx + padX, ry + 4)
        ctx.fillStyle = '#f9f6f2'
        ctx.font = 'bold 14px "Courier New", monospace'
        ctx.textAlign = 'right'
        ctx.fillText(value, bx + boxW - padX, ry + 4)
      }
      startY += resultRows.length * rowH + 8
    }
    const streakRows: [string, string][] = [
      ['Current Streak', String(dailyData.currentStreak) + ' day' + (dailyData.currentStreak !== 1 ? 's' : '')],
      ['Best Streak', String(dailyData.bestStreak) + ' day' + (dailyData.bestStreak !== 1 ? 's' : '')],
    ]
    for (let i = 0; i < streakRows.length; i++) {
      const entry = streakRows[i]
      if (!entry) continue
      const [label, value] = entry
      const ry = startY + i * rowH
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fillRect(bx + 4, ry - 10, boxW - 8, rowH)
      }
      ctx.fillStyle = '#bbada0'
      ctx.font = '13px "Courier New", monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, bx + padX, ry + 4)
      ctx.fillStyle = '#f9f6f2'
      ctx.font = 'bold 14px "Courier New", monospace'
      ctx.textAlign = 'right'
      ctx.fillText(value, bx + boxW - padX, ry + 4)
    }
    const btnY = by + boxH - 52
    const btnW = Math.round(boxW * 0.4)
    const btnH = 34
    if (dailyResult === null) {
      const playBtnX = cx - Math.round(btnW / 2)
      drawPixelButton(ctx, playBtnX, btnY, btnW, btnH, 'PLAY', 12, '#2a5a3a')
      hitAreas.push({ x: playBtnX, y: btnY, w: btnW, h: btnH, action: 'daily-play' })
    } else {
      const closeBtnX = cx - Math.round(btnW / 2)
      drawPixelButton(ctx, closeBtnX, btnY, btnW, btnH, 'CLOSE', 12)
      hitAreas.push({ x: closeBtnX, y: btnY, w: btnW, h: btnH, action: 'close-daily' })
    }
  }

  function drawDailyBanner(
    ctx: CanvasRenderingContext2D,
    gridX: number,
    gridY: number,
    gridSize: number,
  ): void {
    const bannerH = 24
    const bannerW = Math.round(gridSize * 0.4)
    const bx = gridX + Math.round((gridSize - bannerW) / 2)
    const by = gridY + 4
    ctx.fillStyle = 'rgba(90,74,16,0.85)'
    ctx.fillRect(bx, by, bannerW, bannerH)
    ctx.fillStyle = '#FFD700'
    ctx.font = 'bold 12px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('DAILY CHALLENGE', bx + Math.round(bannerW / 2), by + Math.round(bannerH / 2))
  }

  function render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    opts: RenderOptions,
  ): void {
    const { score, bestScore, isOver, isWon, undoAvailable, continueWithAdAvailable, isAdPlaying, isMuted, showStats, stats, isDailyMode, showDailyOverlay, dailyData, dailyResult } =
      opts
    hitAreas = []
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, width, height)
    drawHeader(ctx, width, score, bestScore, isMuted, isDailyMode)
    const { gridX, gridY, gridSize, gap, tileSize } = getGridLayout(width, height)
    ctx.fillStyle = GRID_BG_COLOR
    ctx.fillRect(gridX, gridY, gridSize, gridSize)
    // Draw empty tile slots
    for (let r = 0; r < GRID_SIZE_N; r++) {
      for (let c = 0; c < GRID_SIZE_N; c++) {
        const px = toPixelX(c, gridX, gap, tileSize)
        const py = toPixelY(r, gridY, gap, tileSize)
        drawEmptyTile(ctx, px, py, tileSize)
      }
    }
    // Draw animated tiles, absorbed tiles rendered first (behind survivors)
    const sorted = [...tiles].sort((a, b) => {
      const aZ = a.phase.kind === 'absorbed' ? 0 : 1
      const bZ = b.phase.kind === 'absorbed' ? 0 : 1
      return aZ - bZ
    })
    for (const tile of sorted) {
      const pos = getVisualPos(tile)
      const animScale = getAnimScale(tile)
      const mergeFlashAlpha = getMergeFlash(tile.phase)
      const px = toPixelX(pos.col, gridX, gap, tileSize)
      const py = toPixelY(pos.row, gridY, gap, tileSize)
      renderAnimTile(ctx, px, py, tileSize, tile.value, animScale, mergeFlashAlpha)
    }
    renderScoreDeltas(ctx, gridX, gridY, gap, tileSize)
    renderCombo(ctx, gridX, gridY, gridSize)
    if (isDailyMode) {
      drawDailyBanner(ctx, gridX, gridY, gridSize)
    }
    if (undoAvailable && !isOver && !isWon) {
      drawUndoButton(ctx, gridX, gridY, gridSize)
    }
    if (isOver || isWon) {
      drawOverlay(ctx, gridX, gridY, gridSize, score, isOver, isDailyMode ? false : continueWithAdAvailable)
    }
    if (isAdPlaying) {
      drawAdOverlay(ctx, width, height)
    }
    if (showStats) {
      drawStatsOverlay(ctx, width, height, stats)
    }
    if (showDailyOverlay && dailyData !== null) {
      drawDailyOverlay(ctx, width, height, dailyData, dailyResult)
    }
  }

  function getButtonAt(px: number, py: number): ButtonAction | null {
    for (const area of hitAreas) {
      if (px >= area.x && px <= area.x + area.w && py >= area.y && py <= area.y + area.h) {
        return area.action
      }
    }
    return null
  }

  return { init, applyMove, update, render, getButtonAt }
}
