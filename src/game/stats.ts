const STATS_KEY = 'pixel2048-stats'

export interface GameStats {
  gamesPlayed: number
  highestTile: number
  totalScore: number
  wins: number
  currentStreak: number
  bestStreak: number
}

const DEFAULT_STATS: GameStats = {
  gamesPlayed: 0,
  highestTile: 0,
  totalScore: 0,
  wins: 0,
  currentStreak: 0,
  bestStreak: 0,
}

export function loadStats(): GameStats {
  const stored = localStorage.getItem(STATS_KEY)
  if (stored === null) return { ...DEFAULT_STATS }
  try {
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_STATS }
    const obj = parsed as Record<string, unknown>
    return {
      gamesPlayed: typeof obj['gamesPlayed'] === 'number' ? obj['gamesPlayed'] : 0,
      highestTile: typeof obj['highestTile'] === 'number' ? obj['highestTile'] : 0,
      totalScore: typeof obj['totalScore'] === 'number' ? obj['totalScore'] : 0,
      wins: typeof obj['wins'] === 'number' ? obj['wins'] : 0,
      currentStreak: typeof obj['currentStreak'] === 'number' ? obj['currentStreak'] : 0,
      bestStreak: typeof obj['bestStreak'] === 'number' ? obj['bestStreak'] : 0,
    }
  } catch {
    return { ...DEFAULT_STATS }
  }
}

export function saveStats(stats: GameStats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats))
}

function getHighestTile(grid: number[][]): number {
  let max = 0
  for (const row of grid) {
    for (const val of row) {
      if (val > max) max = val
    }
  }
  return max
}

const STREAK_THRESHOLD = 512

export function recordGameEnd(
  stats: GameStats,
  grid: number[][],
  score: number,
  won: boolean,
): GameStats {
  const highestTile = getHighestTile(grid)
  const meetsStreak = highestTile >= STREAK_THRESHOLD
  const currentStreak = meetsStreak ? stats.currentStreak + 1 : 0
  const bestStreak = Math.max(stats.bestStreak, currentStreak)
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    highestTile: Math.max(stats.highestTile, highestTile),
    totalScore: stats.totalScore + score,
    wins: stats.wins + (won ? 1 : 0),
    currentStreak,
    bestStreak,
  }
}

export function getWinRate(stats: GameStats): number {
  if (stats.gamesPlayed === 0) return 0
  return Math.round((stats.wins / stats.gamesPlayed) * 100)
}
