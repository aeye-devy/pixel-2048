export type TileEffect = 'none' | 'glow' | 'sparkle' | 'shimmer' | 'pulse' | 'prismatic'

export interface TileStyle {
  bg: string
  fg: string
  effect: TileEffect
  glowColor?: string
  prismaticColors?: readonly string[]
}

// Color progression: warm (low) → cool (mid) → special (high)
// Each tile value maps to exact hex colors + optional animated effect.
export const TILE_STYLES: Readonly<Record<number, TileStyle>> = {
  2: { bg: '#f5e6cc', fg: '#776655', effect: 'none' },
  4: { bg: '#f2c4a0', fg: '#776644', effect: 'none' },
  8: { bg: '#e8944a', fg: '#ffffff', effect: 'none' },
  16: { bg: '#e06040', fg: '#ffffff', effect: 'none' },
  32: { bg: '#c03030', fg: '#ffffff', effect: 'none' },
  64: { bg: '#8a2040', fg: '#ffffff', effect: 'none' },
  128: { bg: '#6a30a0', fg: '#ffffff', effect: 'glow', glowColor: '#c080ff' },
  256: { bg: '#3050c0', fg: '#ffffff', effect: 'sparkle', glowColor: '#80a0ff' },
  512: { bg: '#20a0a0', fg: '#ffffff', effect: 'shimmer', glowColor: '#80ffff' },
  1024: { bg: '#d4a020', fg: '#ffffff', effect: 'pulse', glowColor: '#ffe080' },
  2048: {
    bg: '#2a2a3a',
    fg: '#ffffff',
    effect: 'prismatic',
    prismaticColors: ['#ff4060', '#ffa020', '#40ff60', '#6080ff'],
  },
}

export const FALLBACK_STYLE: TileStyle = { bg: '#c0a060', fg: '#ffffff', effect: 'none' }
export const EMPTY_TILE_BG = '#2e2e44'
export const BOARD_BG = '#1a1a2e'
export const BOARD_PANEL_BG = '#0f1028'
