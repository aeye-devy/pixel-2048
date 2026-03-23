import { createInitialState, mulberry32, dateToSeed } from './engine.js'
import type { GameState, RngFn } from './engine.js'

const DAILY_KEY = 'pixel2048-daily'
const MAX_STORED_DAYS = 30

export interface DailyResult {
  date: string
  score: number
  won: boolean
  highestTile: number
}

export interface DailyData {
  results: Record<string, DailyResult>
  currentStreak: number
  bestStreak: number
  bestDailyScore: number
}

const DEFAULT_DATA: DailyData = {
  results: {},
  currentStreak: 0,
  bestStreak: 0,
  bestDailyScore: 0,
}

export function todayDateStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${String(y)}-${m}-${day}`
}

export function loadDailyData(): DailyData {
  const stored = localStorage.getItem(DAILY_KEY)
  if (stored === null) return { ...DEFAULT_DATA, results: {} }
  try {
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_DATA, results: {} }
    const obj = parsed as Record<string, unknown>
    const results = typeof obj.results === 'object' && obj.results !== null
      ? (obj.results as Record<string, DailyResult>)
      : {}
    return {
      results,
      currentStreak: typeof obj.currentStreak === 'number' ? obj.currentStreak : 0,
      bestStreak: typeof obj.bestStreak === 'number' ? obj.bestStreak : 0,
      bestDailyScore: typeof obj.bestDailyScore === 'number' ? obj.bestDailyScore : 0,
    }
  } catch {
    return { ...DEFAULT_DATA, results: {} }
  }
}

export function saveDailyData(data: DailyData): void {
  localStorage.setItem(DAILY_KEY, JSON.stringify(data))
}

export function hasPlayedToday(data: DailyData): boolean {
  return data.results[todayDateStr()] !== undefined
}

export function getTodayResult(data: DailyData): DailyResult | null {
  return data.results[todayDateStr()] ?? null
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

function previousDateStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${String(y)}-${m}-${day}`
}

export function recordDailyResult(
  data: DailyData,
  grid: number[][],
  score: number,
  won: boolean,
): DailyData {
  const date = todayDateStr()
  const highestTile = getHighestTile(grid)
  const result: DailyResult = { date, score, won, highestTile }
  const results = { ...data.results, [date]: result }
  const yesterday = previousDateStr(date)
  const playedYesterday = results[yesterday] !== undefined
  const currentStreak = playedYesterday ? data.currentStreak + 1 : 1
  const bestStreak = Math.max(data.bestStreak, currentStreak)
  const bestDailyScore = Math.max(data.bestDailyScore, score)
  return cleanupOldEntries({ results, currentStreak, bestStreak, bestDailyScore })
}

function cleanupOldEntries(data: DailyData): DailyData {
  const dates = Object.keys(data.results).sort()
  if (dates.length <= MAX_STORED_DAYS) return data
  const keepFrom = dates.length - MAX_STORED_DAYS
  const results: Record<string, DailyResult> = {}
  for (let i = keepFrom; i < dates.length; i++) {
    const key = dates[i]
    if (key !== undefined && data.results[key] !== undefined) {
      results[key] = data.results[key]
    }
  }
  return { ...data, results }
}

export function createDailyRng(dateStr: string): RngFn {
  return mulberry32(dateToSeed(dateStr))
}

export function createDailyState(dateStr: string): { state: GameState; rng: RngFn } {
  const rng = createDailyRng(dateStr)
  const state = createInitialState(rng)
  return { state, rng }
}
