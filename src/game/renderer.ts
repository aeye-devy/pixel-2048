import type { GameState, TileMotion } from './engine.js'
import { drawTile as paintTile, drawEmptyTile } from '../render/tilePainter.js'

const GRID_SIZE_N = 4
const SLIDE_DUR = 0.15 // seconds
const APPEAR_DUR = 0.1
const POP_DUR = 0.15
const HEADER_H = 90

const BG_COLOR = '#1a1a2e'
const GRID_BG_COLOR = '#16213e'
const HEADER_BG = '#0d1b2a'
const SCORE_BOX_BG = '#2d3154'
const BTN_BG = '#3a3f6b'

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

interface HitArea {
  x: number
  y: number
  w: number
  h: number
  action: 'new-game' | 'continue'
}

export type ButtonAction = 'new-game' | 'continue'

export interface Renderer {
  init(state: GameState): void
  applyMove(motions: TileMotion[], spawnedAt: [number, number] | null, newState: GameState): void
  update(dt: number): void
  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    score: number,
    bestScore: number,
    isOver: boolean,
    isWon: boolean,
  ): void
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
  const newId = () => nextId++

  function init(state: GameState): void {
    tiles = []
    nextId = 0
    time = 0
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
  ): void {
    const rx = Math.round(x)
    const ry = Math.round(y)
    ctx.fillStyle = BTN_BG
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

  function drawHeader(
    ctx: CanvasRenderingContext2D,
    width: number,
    score: number,
    bestScore: number,
  ): void {
    ctx.fillStyle = HEADER_BG
    ctx.fillRect(0, 0, width, HEADER_H)
    ctx.fillStyle = '#f9f6f2'
    ctx.font = 'bold 30px "Courier New", monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('2048', 16, HEADER_H / 2)
    const itemW = Math.min(84, Math.floor(width * 0.21))
    const boxH = 52
    const btnH = 38
    const edgeMargin = 12
    const itemGap = 8
    const boxY = Math.round((HEADER_H - boxH) / 2)
    const btnY = Math.round((HEADER_H - btnH) / 2)
    const btnX = width - edgeMargin - itemW
    drawPixelButton(ctx, btnX, btnY, itemW, btnH, 'NEW GAME', 10)
    hitAreas.push({ x: btnX, y: btnY, w: itemW, h: btnH, action: 'new-game' })
    const bestX = btnX - itemGap - itemW
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
  ): void {
    const cx = Math.round(gridX + gridSize / 2)
    ctx.fillStyle = isOver ? 'rgba(20,20,40,0.82)' : 'rgba(237,194,46,0.82)'
    ctx.fillRect(gridX, gridY, gridSize, gridSize)
    ctx.fillStyle = isOver ? '#f9f6f2' : '#1a1a2e'
    const titleFontSize = Math.round(gridSize * 0.1)
    ctx.font = 'bold ' + String(titleFontSize) + 'px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(isOver ? 'GAME OVER' : 'YOU WIN!', cx, Math.round(gridY + gridSize * 0.36))
    const scoreFontSize = Math.round(gridSize * 0.065)
    ctx.font = String(scoreFontSize) + 'px "Courier New", monospace'
    ctx.fillText('Score: ' + String(score), cx, Math.round(gridY + gridSize * 0.52))
    const btnW = Math.round(gridSize * 0.42)
    const btnH = Math.round(Math.max(32, gridSize * 0.1))
    const btnFontSize = Math.round(Math.max(10, gridSize * 0.055))
    const btnY = Math.round(gridY + gridSize * 0.64)
    if (!isOver) {
      const spacing = Math.round(gridSize * 0.04)
      const startX = cx - Math.round((btnW * 2 + spacing) / 2)
      drawPixelButton(ctx, startX, btnY, btnW, btnH, 'CONTINUE', btnFontSize)
      hitAreas.push({ x: startX, y: btnY, w: btnW, h: btnH, action: 'continue' })
      const ngX = startX + btnW + spacing
      drawPixelButton(ctx, ngX, btnY, btnW, btnH, 'NEW GAME', btnFontSize)
      hitAreas.push({ x: ngX, y: btnY, w: btnW, h: btnH, action: 'new-game' })
    } else {
      const btnX = cx - Math.round(btnW / 2)
      drawPixelButton(ctx, btnX, btnY, btnW, btnH, 'NEW GAME', btnFontSize)
      hitAreas.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: 'new-game' })
    }
  }

  function render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    score: number,
    bestScore: number,
    isOver: boolean,
    isWon: boolean,
  ): void {
    hitAreas = []
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, width, height)
    drawHeader(ctx, width, score, bestScore)
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
    if (isOver || isWon) {
      drawOverlay(ctx, gridX, gridY, gridSize, score, isOver)
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
