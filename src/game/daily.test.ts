import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadDailyData,
  saveDailyData,
  hasPlayedToday,
  getTodayResult,
  recordDailyResult,
  createDailyState,
  createDailyRng,
  todayDateStr,
} from './daily.js'
import type { DailyData, DailyResult } from './daily.js'
import { mulberry32, dateToSeed, createInitialState } from './engine.js'

const mockStorage = new Map<string, string>()

beforeEach(() => {
  mockStorage.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => { mockStorage.set(key, value) },
    removeItem: (key: string) => { mockStorage.delete(key) },
  })
})

describe('mulberry32 seeded PRNG', () => {
  it('같은 시드에서 동일한 시퀀스를 생성한다', () => {
    const rng1 = mulberry32(12345)
    const rng2 = mulberry32(12345)
    const seq1 = Array.from({ length: 10 }, () => rng1())
    const seq2 = Array.from({ length: 10 }, () => rng2())
    expect(seq1).toEqual(seq2)
  })
  it('다른 시드에서 다른 시퀀스를 생성한다', () => {
    const rng1 = mulberry32(12345)
    const rng2 = mulberry32(54321)
    const seq1 = Array.from({ length: 5 }, () => rng1())
    const seq2 = Array.from({ length: 5 }, () => rng2())
    expect(seq1).not.toEqual(seq2)
  })
  it('0과 1 사이의 값을 생성한다', () => {
    const rng = mulberry32(42)
    for (let i = 0; i < 100; i++) {
      const val = rng()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })
})

describe('dateToSeed', () => {
  it('같은 날짜 문자열에서 같은 시드를 반환한다', () => {
    expect(dateToSeed('2026-03-23')).toBe(dateToSeed('2026-03-23'))
  })
  it('다른 날짜 문자열에서 다른 시드를 반환한다', () => {
    expect(dateToSeed('2026-03-23')).not.toBe(dateToSeed('2026-03-24'))
  })
})

describe('createDailyState', () => {
  it('같은 날짜에서 동일한 초기 보드를 생성한다', () => {
    const { state: s1 } = createDailyState('2026-03-23')
    const { state: s2 } = createDailyState('2026-03-23')
    expect(s1.grid).toEqual(s2.grid)
    expect(s1.score).toBe(0)
    expect(s1.won).toBe(false)
    expect(s1.over).toBe(false)
  })
  it('다른 날짜에서 다른 초기 보드를 생성한다', () => {
    const { state: s1 } = createDailyState('2026-03-23')
    const { state: s2 } = createDailyState('2026-03-24')
    expect(s1.grid).not.toEqual(s2.grid)
  })
  it('초기 보드에 정확히 2개의 타일이 있다', () => {
    const { state } = createDailyState('2026-01-01')
    const nonZero = state.grid.flat().filter((v) => v !== 0)
    expect(nonZero).toHaveLength(2)
  })
})

describe('createDailyRng', () => {
  it('RNG로 seeded 이동 후에도 결정론적이다', () => {
    const rng1 = createDailyRng('2026-03-23')
    const rng2 = createDailyRng('2026-03-23')
    const s1 = createInitialState(rng1)
    const s2 = createInitialState(rng2)
    expect(s1.grid).toEqual(s2.grid)
    // Consume same number of RNG values — should still match
    const val1 = rng1()
    const val2 = rng2()
    expect(val1).toBe(val2)
  })
})

describe('loadDailyData', () => {
  it('localStorage에 데이터가 없을 때 기본값을 반환한다', () => {
    const data = loadDailyData()
    expect(data.results).toEqual({})
    expect(data.currentStreak).toBe(0)
    expect(data.bestStreak).toBe(0)
    expect(data.bestDailyScore).toBe(0)
  })
  it('저장된 데이터가 있을 때 파싱하여 반환한다', () => {
    const saved: DailyData = {
      results: { '2026-03-22': { date: '2026-03-22', score: 5000, won: false, highestTile: 512 } },
      currentStreak: 3,
      bestStreak: 5,
      bestDailyScore: 8000,
    }
    mockStorage.set('pixel2048-daily', JSON.stringify(saved))
    const data = loadDailyData()
    expect(data).toEqual(saved)
  })
  it('손상된 JSON이 저장되어 있을 때 기본값을 반환한다', () => {
    mockStorage.set('pixel2048-daily', 'not-json')
    const data = loadDailyData()
    expect(data.currentStreak).toBe(0)
    expect(data.results).toEqual({})
  })
  it('일부 필드가 누락된 데이터에서 누락 필드를 0으로 채운다', () => {
    mockStorage.set('pixel2048-daily', JSON.stringify({ currentStreak: 2 }))
    const data = loadDailyData()
    expect(data.currentStreak).toBe(2)
    expect(data.bestStreak).toBe(0)
    expect(data.bestDailyScore).toBe(0)
  })
})

describe('saveDailyData', () => {
  it('dailyData를 JSON으로 직렬화하여 localStorage에 저장한다', () => {
    const data: DailyData = {
      results: {},
      currentStreak: 1,
      bestStreak: 3,
      bestDailyScore: 5000,
    }
    saveDailyData(data)
    const raw = mockStorage.get('pixel2048-daily')
    expect(raw).toBeDefined()
    expect(JSON.parse(raw ?? '')).toEqual(data)
  })
})

describe('hasPlayedToday', () => {
  it('오늘 플레이하지 않았으면 false를 반환한다', () => {
    const data: DailyData = { results: {}, currentStreak: 0, bestStreak: 0, bestDailyScore: 0 }
    expect(hasPlayedToday(data)).toBe(false)
  })
  it('오늘 플레이했으면 true를 반환한다', () => {
    const today = todayDateStr()
    const data: DailyData = {
      results: { [today]: { date: today, score: 100, won: false, highestTile: 64 } },
      currentStreak: 1,
      bestStreak: 1,
      bestDailyScore: 100,
    }
    expect(hasPlayedToday(data)).toBe(true)
  })
})

describe('getTodayResult', () => {
  it('오늘 결과가 없으면 null을 반환한다', () => {
    const data: DailyData = { results: {}, currentStreak: 0, bestStreak: 0, bestDailyScore: 0 }
    expect(getTodayResult(data)).toBeNull()
  })
  it('오늘 결과가 있으면 해당 결과를 반환한다', () => {
    const today = todayDateStr()
    const result: DailyResult = { date: today, score: 3000, won: false, highestTile: 256 }
    const data: DailyData = {
      results: { [today]: result },
      currentStreak: 1,
      bestStreak: 1,
      bestDailyScore: 3000,
    }
    expect(getTodayResult(data)).toEqual(result)
  })
})

describe('recordDailyResult', () => {
  const emptyData: DailyData = { results: {}, currentStreak: 0, bestStreak: 0, bestDailyScore: 0 }
  const grid256 = [
    [256, 64, 32, 16],
    [8, 4, 2, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]
  it('첫 플레이 시 스트릭이 1이 된다', () => {
    const result = recordDailyResult(emptyData, grid256, 3000, false)
    expect(result.currentStreak).toBe(1)
    expect(result.bestStreak).toBe(1)
    expect(result.bestDailyScore).toBe(3000)
  })
  it('오늘 날짜 결과가 저장된다', () => {
    const result = recordDailyResult(emptyData, grid256, 3000, false)
    const today = todayDateStr()
    expect(result.results[today]).toBeDefined()
    expect(result.results[today]?.score).toBe(3000)
    expect(result.results[today]?.highestTile).toBe(256)
  })
  it('연속 플레이 시 스트릭이 증가한다', () => {
    // 어제 플레이한 기록이 있을 때
    const today = todayDateStr()
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const yesterday = `${String(y)}-${m}-${day}`
    const dataWithYesterday: DailyData = {
      results: { [yesterday]: { date: yesterday, score: 2000, won: false, highestTile: 128 } },
      currentStreak: 3,
      bestStreak: 5,
      bestDailyScore: 4000,
    }
    const result = recordDailyResult(dataWithYesterday, grid256, 3000, false)
    expect(result.currentStreak).toBe(4)
    expect(result.bestStreak).toBe(5)
  })
  it('하루 건너뛰면 스트릭이 1로 리셋된다', () => {
    const data: DailyData = {
      results: { '2020-01-01': { date: '2020-01-01', score: 1000, won: false, highestTile: 64 } },
      currentStreak: 5,
      bestStreak: 10,
      bestDailyScore: 5000,
    }
    const result = recordDailyResult(data, grid256, 2000, false)
    expect(result.currentStreak).toBe(1)
    expect(result.bestStreak).toBe(10) // bestStreak는 유지
  })
  it('bestDailyScore보다 높으면 갱신한다', () => {
    const data: DailyData = { results: {}, currentStreak: 0, bestStreak: 0, bestDailyScore: 2000 }
    const result = recordDailyResult(data, grid256, 5000, false)
    expect(result.bestDailyScore).toBe(5000)
  })
  it('bestDailyScore보다 낮으면 유지한다', () => {
    const data: DailyData = { results: {}, currentStreak: 0, bestStreak: 0, bestDailyScore: 8000 }
    const result = recordDailyResult(data, grid256, 3000, false)
    expect(result.bestDailyScore).toBe(8000)
  })
  it('30일 이상 된 기록은 정리한다', () => {
    const results: Record<string, DailyResult> = {}
    for (let i = 0; i < 35; i++) {
      const d = new Date(2026, 0, 1 + i)
      const dateStr = d.toISOString().slice(0, 10)
      results[dateStr] = { date: dateStr, score: 100, won: false, highestTile: 32 }
    }
    const data: DailyData = { results, currentStreak: 0, bestStreak: 0, bestDailyScore: 100 }
    const result = recordDailyResult(data, grid256, 2000, false)
    // 30 old entries + 1 today = at most 30 kept after cleanup
    const keys = Object.keys(result.results)
    expect(keys.length).toBeLessThanOrEqual(30)
  })
})

describe('todayDateStr', () => {
  it('YYYY-MM-DD 형식의 문자열을 반환한다', () => {
    const today = todayDateStr()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
