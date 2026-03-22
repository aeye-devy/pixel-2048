import { createInitialState, move, type GameState, type Direction } from '../game/engine.js'
import { drawTile, drawEmptyTile } from './tilePainter.js'
import { BOARD_BG, BOARD_PANEL_BG } from './tileStyle.js'

const GRID_SIZE = 4
const TILE_LOGICAL = 16  // tile size in logical pixels
const GAP_LOGICAL = 2    // gap between tiles in logical pixels

interface MergeFlash {
  row: number
  col: number
  alpha: number
}

export interface BoardRenderer {
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void
  handleKey(key: string): void
}

export function createBoardRenderer(): BoardRenderer {
  let state: GameState = createInitialState()
  let time = 0
  const flashes: MergeFlash[] = []

  function tileDisplaySize(canvasW: number, canvasH: number): number {
    const boardLogical = GRID_SIZE * TILE_LOGICAL + (GRID_SIZE + 1) * GAP_LOGICAL
    const maxPx = Math.min(canvasW, canvasH) * 0.82
    return Math.floor((maxPx / boardLogical) * TILE_LOGICAL)
  }

  function update(dt: number): void {
    time += dt
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]
      if (f === undefined) continue
      f.alpha -= dt * 4
      if (f.alpha <= 0) flashes.splice(i, 1)
    }
  }

  function render(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    ctx.imageSmoothingEnabled = false
    const ts = tileDisplaySize(canvasW, canvasH)
    const gapScale = ts / TILE_LOGICAL
    const gap = Math.max(1, Math.round(GAP_LOGICAL * gapScale))
    const boardPx = GRID_SIZE * ts + (GRID_SIZE + 1) * gap
    const bx = Math.floor((canvasW - boardPx) / 2)
    const by = Math.floor((canvasH - boardPx) / 2)

    ctx.fillStyle = BOARD_BG
    ctx.fillRect(0, 0, canvasW, canvasH)

    ctx.fillStyle = BOARD_PANEL_BG
    ctx.fillRect(bx - gap, by - gap, boardPx + gap * 2, boardPx + gap * 2)

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const tx = bx + col * (ts + gap) + gap
        const ty = by + row * (ts + gap) + gap
        const value = state.grid[row]?.[col] ?? 0
        if (value === 0) {
          drawEmptyTile(ctx, tx, ty, ts)
        } else {
          const flash = flashes.find((f) => f.row === row && f.col === col)
          drawTile(ctx, value, tx, ty, ts, time, flash?.alpha ?? 0)
        }
      }
    }

    const fontSize = Math.max(12, Math.floor(ts / 3))
    ctx.fillStyle = '#9090bb'
    ctx.font = `bold ${fontSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`SCORE  ${state.score}`, canvasW / 2, by - gap * 2)
    ctx.textBaseline = 'alphabetic'

    if (state.won) drawOverlay(ctx, canvasW, canvasH, 'YOU WIN!')
    else if (state.over) drawOverlay(ctx, canvasW, canvasH, 'GAME OVER')
  }

  function drawOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    text: string,
  ): void {
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(0, 0, w, h)
    const fontSize = Math.floor(Math.min(w, h) / 8)
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${fontSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2)
    const subSize = Math.floor(fontSize * 0.45)
    ctx.font = `${subSize}px monospace`
    ctx.fillStyle = '#aaaacc'
    ctx.fillText('press any arrow key to restart', w / 2, h / 2 + fontSize * 0.85)
    ctx.textBaseline = 'alphabetic'
  }

  function handleKey(key: string): void {
    const DIR_MAP: Readonly<Record<string, Direction>> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
    }
    const dir = DIR_MAP[key]
    if (dir === undefined) return

    if (state.over || state.won) {
      state = createInitialState()
      flashes.length = 0
      return
    }

    const prev = state
    state = move(state, dir)
    if (state === prev) return

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const prevVal = prev.grid[r]?.[c] ?? 0
        const newVal = state.grid[r]?.[c] ?? 0
        if (prevVal > 0 && newVal === prevVal * 2) {
          flashes.push({ row: r, col: c, alpha: 1 })
        }
      }
    }
  }

  return { update, render, handleKey }
}
