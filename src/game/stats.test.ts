import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadStats, saveStats, recordGameEnd, getWinRate, updateBestCombo } from './stats.js'
import type { GameStats } from './stats.js'

const mockStorage = new Map<string, string>()

beforeEach(() => {
  mockStorage.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mockStorage.set(key, value)
    },
    removeItem: (key: string) => {
      mockStorage.delete(key)
    },
  })
})

describe('loadStats', () => {
  it('localStorage에 데이터가 없을 때 기본값을 반환한다', () => {
    const stats = loadStats()
    expect(stats).toEqual({
      gamesPlayed: 0,
      highestTile: 0,
      totalScore: 0,
      wins: 0,
      currentStreak: 0,
      bestStreak: 0,
      bestCombo: 0,
    })
  })
  it('저장된 데이터가 있을 때 파싱하여 반환한다', () => {
    const saved: GameStats = {
      gamesPlayed: 5,
      highestTile: 1024,
      totalScore: 15000,
      wins: 1,
      currentStreak: 3,
      bestStreak: 4,
      bestCombo: 3,
    }
    mockStorage.set('pixel2048-stats', JSON.stringify(saved))
    const stats = loadStats()
    expect(stats).toEqual(saved)
  })
  it('손상된 JSON이 저장되어 있을 때 기본값을 반환한다', () => {
    mockStorage.set('pixel2048-stats', 'not-json')
    const stats = loadStats()
    expect(stats.gamesPlayed).toBe(0)
  })
  it('일부 필드가 누락된 데이터에서 누락 필드를 0으로 채운다', () => {
    mockStorage.set('pixel2048-stats', JSON.stringify({ gamesPlayed: 3 }))
    const stats = loadStats()
    expect(stats.gamesPlayed).toBe(3)
    expect(stats.highestTile).toBe(0)
    expect(stats.wins).toBe(0)
  })
})

describe('saveStats', () => {
  it('stats를 JSON으로 직렬화하여 localStorage에 저장한다', () => {
    const stats: GameStats = {
      gamesPlayed: 2,
      highestTile: 512,
      totalScore: 8000,
      wins: 0,
      currentStreak: 1,
      bestStreak: 1,
      bestCombo: 2,
    }
    saveStats(stats)
    const raw = mockStorage.get('pixel2048-stats')
    expect(raw).toBeDefined()
    expect(JSON.parse(raw!)).toEqual(stats)
  })
})

describe('recordGameEnd', () => {
  const emptyStats: GameStats = {
    gamesPlayed: 0,
    highestTile: 0,
    totalScore: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    bestCombo: 0,
  }
  const grid512 = [
    [512, 64, 32, 16],
    [8, 4, 2, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]
  const grid256 = [
    [256, 64, 32, 16],
    [8, 4, 2, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]
  it('게임 종료 시 gamesPlayed가 1 증가한다', () => {
    const result = recordGameEnd(emptyStats, grid256, 1000, false)
    expect(result.gamesPlayed).toBe(1)
  })
  it('승리 시 wins가 1 증가한다', () => {
    const result = recordGameEnd(emptyStats, grid512, 5000, true)
    expect(result.wins).toBe(1)
  })
  it('패배 시 wins는 그대로이다', () => {
    const result = recordGameEnd(emptyStats, grid256, 1000, false)
    expect(result.wins).toBe(0)
  })
  it('기존 최고 타일보다 높은 타일이 있으면 갱신한다', () => {
    const stats = { ...emptyStats, highestTile: 256 }
    const result = recordGameEnd(stats, grid512, 1000, false)
    expect(result.highestTile).toBe(512)
  })
  it('기존 최고 타일보다 낮으면 유지한다', () => {
    const stats = { ...emptyStats, highestTile: 1024 }
    const result = recordGameEnd(stats, grid512, 1000, false)
    expect(result.highestTile).toBe(1024)
  })
  it('totalScore에 현재 게임 점수를 누적한다', () => {
    const stats = { ...emptyStats, totalScore: 5000 }
    const result = recordGameEnd(stats, grid256, 3000, false)
    expect(result.totalScore).toBe(8000)
  })
  it('512 이상 타일 도달 시 연속 스트릭이 증가한다', () => {
    const stats = { ...emptyStats, currentStreak: 2 }
    const result = recordGameEnd(stats, grid512, 3000, false)
    expect(result.currentStreak).toBe(3)
  })
  it('512 미만으로 끝나면 연속 스트릭이 0으로 리셋된다', () => {
    const stats = { ...emptyStats, currentStreak: 5, bestStreak: 5 }
    const result = recordGameEnd(stats, grid256, 1000, false)
    expect(result.currentStreak).toBe(0)
    expect(result.bestStreak).toBe(5)
  })
  it('현재 스트릭이 최고 스트릭을 넘으면 갱신한다', () => {
    const stats = { ...emptyStats, currentStreak: 4, bestStreak: 4 }
    const result = recordGameEnd(stats, grid512, 3000, false)
    expect(result.currentStreak).toBe(5)
    expect(result.bestStreak).toBe(5)
  })
})

describe('getWinRate', () => {
  it('게임이 0회일 때 0을 반환한다', () => {
    expect(getWinRate({ gamesPlayed: 0, highestTile: 0, totalScore: 0, wins: 0, currentStreak: 0, bestStreak: 0, bestCombo: 0 })).toBe(0)
  })
  it('10게임 중 3승일 때 30을 반환한다', () => {
    expect(getWinRate({ gamesPlayed: 10, highestTile: 2048, totalScore: 50000, wins: 3, currentStreak: 0, bestStreak: 2, bestCombo: 0 })).toBe(30)
  })
})

describe('updateBestCombo', () => {
  const base: GameStats = {
    gamesPlayed: 5,
    highestTile: 512,
    totalScore: 10000,
    wins: 1,
    currentStreak: 2,
    bestStreak: 3,
    bestCombo: 2,
  }
  it('기존 최고 콤보보다 높은 콤보일 때 갱신한다', () => {
    const result = updateBestCombo(base, 4)
    expect(result.bestCombo).toBe(4)
  })
  it('기존 최고 콤보보다 낮거나 같으면 동일 객체를 반환한다', () => {
    const same = updateBestCombo(base, 2)
    expect(same).toBe(base)
    const lower = updateBestCombo(base, 1)
    expect(lower).toBe(base)
  })
  it('다른 stats 필드를 변경하지 않는다', () => {
    const result = updateBestCombo(base, 5)
    expect(result.gamesPlayed).toBe(base.gamesPlayed)
    expect(result.highestTile).toBe(base.highestTile)
    expect(result.totalScore).toBe(base.totalScore)
  })
})
