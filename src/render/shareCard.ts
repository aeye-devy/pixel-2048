import { drawTile } from './tilePainter.js'
import type { Grid } from '../game/engine.js'

const CARD_W = 400
const CARD_H = 600
const BG_COLOR = '#1a1a2e'
const HEADER_BG = '#0d1b2a'
const PLAY_URL = 'hustle-dev.github.io/pixel-2048'

function getHighestTile(grid: Grid): number {
  let max = 0
  for (const row of grid) {
    for (const val of row) {
      if (val > max) max = val
    }
  }
  return max
}

export function generateShareCard(
  grid: Grid,
  score: number,
  isWon: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.imageSmoothingEnabled = false
  // Background
  ctx.fillStyle = BG_COLOR
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  // Header bar
  ctx.fillStyle = HEADER_BG
  ctx.fillRect(0, 0, CARD_W, 80)
  // Pixel border highlight on header
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(0, 78, CARD_W, 2)
  // Title
  ctx.fillStyle = '#f9f6f2'
  ctx.font = 'bold 36px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('PIXEL 2048', CARD_W / 2, 42)
  // Status line
  const statusText = isWon ? 'YOU WIN!' : 'GAME OVER'
  const statusColor = isWon ? '#edc22e' : '#bbada0'
  ctx.fillStyle = statusColor
  ctx.font = 'bold 22px "Courier New", monospace'
  ctx.fillText(statusText, CARD_W / 2, 115)
  // Score
  ctx.fillStyle = '#bbada0'
  ctx.font = '14px "Courier New", monospace'
  ctx.fillText('SCORE', CARD_W / 2, 155)
  ctx.fillStyle = '#f9f6f2'
  const scoreFontSize = score >= 100000 ? 36 : 44
  ctx.font = 'bold ' + String(scoreFontSize) + 'px "Courier New", monospace'
  ctx.fillText(String(score), CARD_W / 2, 195)
  // Highest tile
  const highest = getHighestTile(grid)
  if (highest > 0) {
    const tileSize = 120
    const tileX = Math.round((CARD_W - tileSize) / 2)
    const tileY = 250
    drawTile(ctx, highest, tileX, tileY, tileSize, 0, 0)
    ctx.fillStyle = '#bbada0'
    ctx.font = '14px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('HIGHEST TILE', CARD_W / 2, tileY + tileSize + 28)
  }
  // Divider
  ctx.fillStyle = '#2d3154'
  ctx.fillRect(50, 440, CARD_W - 100, 2)
  // Play URL
  ctx.fillStyle = '#f9f6f2'
  ctx.font = 'bold 15px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.fillText('Play at', CARD_W / 2, 478)
  ctx.fillStyle = '#80a0ff'
  ctx.font = '13px "Courier New", monospace'
  ctx.fillText(PLAY_URL, CARD_W / 2, 502)
  // Fanxy branding
  ctx.fillStyle = '#555577'
  ctx.font = '12px "Courier New", monospace'
  ctx.fillText('Made by FANXY', CARD_W / 2, 560)
  return canvas
}

export async function shareScore(
  grid: Grid,
  score: number,
  isWon: boolean,
): Promise<'shared' | 'downloaded' | 'failed'> {
  const card = generateShareCard(grid, score, isWon)
  return new Promise((resolve) => {
    card.toBlob(
      (blob) => {
        if (!blob) {
          resolve('failed')
          return
        }
        const file = new File([blob], 'pixel-2048-score.png', { type: 'image/png' })
        if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
          navigator
            .share({ files: [file], title: 'Pixel 2048', text: 'I scored ' + String(score) + ' in Pixel 2048!' })
            .then(() => resolve('shared'))
            .catch(() => resolve('failed'))
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'pixel-2048-score.png'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          resolve('downloaded')
        }
      },
      'image/png',
    )
  })
}
