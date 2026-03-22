import { drawText } from './bitmapFont.js'
import { TILE_STYLES, FALLBACK_STYLE, EMPTY_TILE_BG } from './tileStyle.js'

// Fixed sparkle pixel positions in logical tile coordinates (0-15 range).
const SPARKLE_PX: ReadonlyArray<readonly [number, number]> = [
  [2, 2],
  [13, 3],
  [10, 12],
] as const

// Draws an empty (zero-value) tile cell.
export function drawEmptyTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  ctx.fillStyle = EMPTY_TILE_BG
  ctx.fillRect(x, y, size, size)
}

// Draws a tile with its value, color, animated effect, and optional merge flash.
// size:       display size in pixels (tile is size×size)
// time:       accumulated time in seconds (drives animations)
// mergeAlpha: 1.0 = just merged (white flash), fades to 0
export function drawTile(
  ctx: CanvasRenderingContext2D,
  value: number,
  x: number,
  y: number,
  size: number,
  time: number,
  mergeAlpha: number,
): void {
  const scale = size / 16
  const px = (logical: number): number => Math.round(logical * scale)
  const s = Math.max(1, px(1))
  const style = TILE_STYLES[value] ?? FALLBACK_STYLE

  ctx.fillStyle = style.bg
  ctx.fillRect(x, y, size, size)

  const eff = style.effect
  if (eff === 'glow') {
    drawBorder(ctx, x, y, size, s, style.glowColor ?? '#ffffff')
  } else if (eff === 'sparkle') {
    drawBorder(ctx, x, y, size, s, style.glowColor ?? '#ffffff')
    if (Math.sin(time * Math.PI * 6) > 0) {
      ctx.fillStyle = '#ffffff'
      for (const [lx, ly] of SPARKLE_PX) {
        ctx.fillRect(x + px(lx), y + px(ly), s, s)
      }
    }
  } else if (eff === 'shimmer') {
    drawBorder(ctx, x, y, size, s, style.glowColor ?? '#ffffff')
    const bandY = Math.floor(((Math.sin(time * 2) + 1) / 2) * 12) + 2
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.fillRect(x + s, y + px(bandY), size - 2 * s, s * 2)
  } else if (eff === 'pulse') {
    const alpha = (Math.sin(time * Math.PI * 2) + 1) / 2
    ctx.globalAlpha = 0.4 + alpha * 0.6
    drawBorder(ctx, x, y, size, s, style.glowColor ?? '#ffe080')
    ctx.globalAlpha = 1
  } else if (eff === 'prismatic') {
    const colors = style.prismaticColors ?? ['#ff4060', '#ffa020', '#40ff60', '#6080ff']
    const t = (time * 0.8) % colors.length
    const idx = Math.floor(t)
    const frac = t - idx
    const nextIdx = (idx + 1) % colors.length
    ctx.globalAlpha = frac
    ctx.fillStyle = colors[nextIdx] ?? style.bg
    ctx.fillRect(x, y, size, size)
    ctx.globalAlpha = 1
  }

  drawText(ctx, String(value), x + size / 2, y + size / 2, style.fg, s)

  if (mergeAlpha > 0) {
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = Math.min(1, mergeAlpha)
    ctx.fillRect(x, y, size, size)
    ctx.globalAlpha = 1
  }
}

function drawBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  thick: number,
  color: string,
): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, size, thick)
  ctx.fillRect(x, y + size - thick, size, thick)
  ctx.fillRect(x, y + thick, thick, size - 2 * thick)
  ctx.fillRect(x + size - thick, y + thick, thick, size - 2 * thick)
}
