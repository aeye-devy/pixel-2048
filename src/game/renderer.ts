import type { GameState, TileMotion } from './engine.js'

const GRID_SIZE_N = 4
const SLIDE_DUR = 0.15 // seconds
const APPEAR_DUR = 0.1
const POP_DUR = 0.15

const BG_COLOR = '#1a1a2e'
const GRID_BG_COLOR = '#16213e'
const EMPTY_TILE_COLOR = '#2d3154'

const TILE_PALETTE: Record<number, { bg: string; fg: string }> = {
  0: { bg: EMPTY_TILE_COLOR, fg: EMPTY_TILE_COLOR },
  2: { bg: '#cdc1b4', fg: '#776e65' },
  4: { bg: '#eee4da', fg: '#776e65' },
  8: { bg: '#f2b179', fg: '#f9f6f2' },
  16: { bg: '#f59563', fg: '#f9f6f2' },
  32: { bg: '#f67c5f', fg: '#f9f6f2' },
  64: { bg: '#f65e3b', fg: '#f9f6f2' },
  128: { bg: '#edcf72', fg: '#f9f6f2' },
  256: { bg: '#edcc61', fg: '#f9f6f2' },
  512: { bg: '#edc850', fg: '#f9f6f2' },
  1024: { bg: '#edc53f', fg: '#f9f6f2' },
  2048: { bg: '#edc22e', fg: '#f9f6f2' },
}
const FALLBACK_COLORS = { bg: '#3c4264', fg: '#f9f6f2' }

function getTileColors(value: number): { bg: string; fg: string } {
  return TILE_PALETTE[value] ?? FALLBACK_COLORS
}

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

export interface Renderer {
  init(state: GameState): void
  applyMove(motions: TileMotion[], spawnedAt: [number, number] | null, newState: GameState): void
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D, width: number, height: number, score: number, isOver: boolean, isWon: boolean): void
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

export function createRenderer(): Renderer {
  let tiles: AnimTile[] = []
  let nextId = 0
  const newId = () => nextId++

  function init(state: GameState): void {
    tiles = []
    nextId = 0
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

  function getScale(tile: AnimTile): number {
    const p = tile.phase
    if (p.kind === 'appear') return easeOut(p.t)
    if (p.kind === 'pop') return 1 + 0.2 * Math.sin(Math.PI * p.t)
    return 1
  }

  function getGridLayout(width: number, height: number) {
    const headerH = 80
    const pad = 16
    const availW = width - 2 * pad
    const availH = height - headerH - 2 * pad
    const gridSize = Math.floor(Math.min(availW, availH))
    const gridX = Math.floor((width - gridSize) / 2)
    const gridY = headerH + pad
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

  function drawTile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    value: number,
    scale: number,
  ): void {
    const colors = getTileColors(value)
    const cx = x + size / 2
    const cy = y + size / 2
    const s = Math.round(size * scale)
    const tx = Math.round(cx - s / 2)
    const ty = Math.round(cy - s / 2)
    ctx.fillStyle = colors.bg
    ctx.fillRect(tx, ty, s, s)
    const bw = Math.max(2, Math.round(s * 0.04))
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.fillRect(tx, ty, s, bw)
    ctx.fillRect(tx, ty, bw, s)
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(tx, ty + s - bw, s, bw)
    ctx.fillRect(tx + s - bw, ty, bw, s)
    if (value === 0) return
    const label = String(value)
    const digits = label.length
    const fontSize = Math.round(digits <= 2 ? s * 0.48 : digits === 3 ? s * 0.38 : s * 0.29)
    ctx.font = 'bold ' + String(fontSize) + "px 'Courier New', monospace"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillText(label, Math.round(cx) + 2, Math.round(cy) + 2)
    ctx.fillStyle = colors.fg
    ctx.fillText(label, Math.round(cx), Math.round(cy))
  }

  function drawHeader(ctx: CanvasRenderingContext2D, width: number, score: number): void {
    const headerH = 80
    ctx.fillStyle = '#0d1b2a'
    ctx.fillRect(0, 0, width, headerH)
    ctx.fillStyle = '#f9f6f2'
    ctx.font = 'bold 36px "Courier New", monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('2048', 20, headerH / 2)
    const boxW = 108
    const boxH = 48
    const boxX = width - boxW - 20
    const boxY = (headerH - boxH) / 2
    ctx.fillStyle = '#2d3154'
    ctx.fillRect(Math.round(boxX), Math.round(boxY), boxW, boxH)
    ctx.fillStyle = '#bbada0'
    ctx.font = 'bold 11px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('SCORE', Math.round(boxX + boxW / 2), Math.round(boxY + 7))
    ctx.fillStyle = '#f9f6f2'
    const scoreFontSize = score >= 100000 ? 15 : score >= 10000 ? 18 : 22
    ctx.font = 'bold ' + String(scoreFontSize) + 'px "Courier New", monospace'
    ctx.textBaseline = 'bottom'
    ctx.fillText(String(score), Math.round(boxX + boxW / 2), Math.round(boxY + boxH - 7))
  }

  function render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    score: number,
    isOver: boolean,
    isWon: boolean,
  ): void {
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, width, height)
    drawHeader(ctx, width, score)
    const { gridX, gridY, gridSize, gap, tileSize } = getGridLayout(width, height)
    ctx.fillStyle = GRID_BG_COLOR
    ctx.fillRect(gridX, gridY, gridSize, gridSize)
    for (let r = 0; r < GRID_SIZE_N; r++) {
      for (let c = 0; c < GRID_SIZE_N; c++) {
        const px = toPixelX(c, gridX, gap, tileSize)
        const py = toPixelY(r, gridY, gap, tileSize)
        ctx.fillStyle = EMPTY_TILE_COLOR
        ctx.fillRect(px, py, tileSize, tileSize)
      }
    }
    const sorted = [...tiles].sort((a, b) => {
      const aZ = a.phase.kind === 'absorbed' ? 0 : 1
      const bZ = b.phase.kind === 'absorbed' ? 0 : 1
      return aZ - bZ
    })
    for (const tile of sorted) {
      const pos = getVisualPos(tile)
      const scale = getScale(tile)
      const px = toPixelX(pos.col, gridX, gap, tileSize)
      const py = toPixelY(pos.row, gridY, gap, tileSize)
      drawTile(ctx, px, py, tileSize, tile.value, scale)
    }
    if (isOver || isWon) {
      ctx.fillStyle = isWon ? 'rgba(237,194,46,0.7)' : 'rgba(20,20,40,0.75)'
      ctx.fillRect(gridX, gridY, gridSize, gridSize)
      ctx.fillStyle = isWon ? '#1a1a2e' : '#f9f6f2'
      const overlayFontSize = Math.round(gridSize * 0.1)
      ctx.font = 'bold ' + String(overlayFontSize) + 'px "Courier New", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        isWon ? 'YOU WIN!' : 'GAME OVER',
        Math.round(gridX + gridSize / 2),
        Math.round(gridY + gridSize / 2),
      )
    }
  }

  return { init, applyMove, update, render }
}
