import { describe, it, expect, vi } from 'vitest'
import {
  createGrid,
  createInitialState,
  isGameOver,
  move,
  moveDetailed,
  spawnTile,
  type GameState,
  type Grid,
} from './engine.js'

function makeGrid(rows: number[][]): Grid {
  return rows.map((r) => [...r])
}

function countNonZero(grid: Grid): number {
  return grid.flat().filter((v) => v !== 0).length
}

describe('createGrid', () => {
  it('4x4 빈 격자를 반환한다', () => {
    const grid = createGrid()
    expect(grid).toHaveLength(4)
    grid.forEach((row) => {
      expect(row).toHaveLength(4)
      row.forEach((v) => { expect(v).toBe(0) })
    })
  })
})

describe('spawnTile', () => {
  it('빈 격자에 타일 하나를 추가한다', () => {
    const grid = createGrid()
    const next = spawnTile(grid)
    expect(countNonZero(next)).toBe(1)
  })

  it('스폰된 타일 값은 2 또는 4이다', () => {
    const grid = createGrid()
    const next = spawnTile(grid)
    const value = next.flat().find((v) => v !== 0)
    expect([2, 4]).toContain(value)
  })

  it('이미 채워진 격자에서는 변화가 없다', () => {
    const full = makeGrid([
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2048, 4],
      [2, 4, 8, 16],
    ])
    const next = spawnTile(full)
    expect(next).toEqual(full)
  })

  it('90% 확률로 2, 10% 확률로 4를 스폰한다', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // 빈 셀 선택 (any)
      .mockReturnValueOnce(0.05) // 4 스폰 (< 0.1)
    const grid = createGrid()
    const next = spawnTile(grid)
    expect(next.flat().find((v) => v !== 0)).toBe(4)
    vi.restoreAllMocks()
  })
})

describe('createInitialState', () => {
  it('2개의 타일이 있는 초기 상태를 반환한다', () => {
    const state = createInitialState()
    expect(countNonZero(state.grid)).toBe(2)
    expect(state.score).toBe(0)
    expect(state.won).toBe(false)
    expect(state.over).toBe(false)
  })
})

describe('move - 왼쪽 이동', () => {
  it('타일이 왼쪽으로 이동한다', () => {
    const state: GameState = {
      grid: makeGrid([
        [0, 0, 0, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'left')
    expect(next.grid[0]?.[0]).toBe(2)
  })

  it('같은 값의 타일이 합쳐진다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'left')
    expect(next.grid[0]?.[0]).toBe(4)
    expect(next.score).toBe(4)
  })

  it('[2,2,2,2] 왼쪽 이동 시 [4,4,0,0]으로 합쳐진다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 2, 2, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'left')
    expect(next.grid[0]?.slice(0, 2)).toEqual([4, 4])
    expect(next.score).toBe(8)
  })

  it('[2,2,2,0] 왼쪽 이동 시 첫 두 타일만 합쳐진다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 2, 2, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'left')
    expect(next.grid[0]?.[0]).toBe(4)
    expect(next.grid[0]?.[1]).toBe(2)
    expect(next.score).toBe(4)
  })

  it('이동이 없으면 상태가 변하지 않는다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 4, 8, 16],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'left')
    expect(next).toBe(state) // 참조 동일 (변화 없음)
  })
})

describe('move - 오른쪽 이동', () => {
  it('타일이 오른쪽으로 이동한다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'right')
    expect(next.grid[0]?.[3]).toBe(2)
  })

  it('[2,2,0,0] 오른쪽 이동 시 합쳐져 4가 된다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'right')
    expect(next.grid[0]?.[3]).toBe(4)
    expect(next.score).toBe(4)
  })
})

describe('move - 위쪽 이동', () => {
  it('타일이 위쪽으로 이동한다', () => {
    const state: GameState = {
      grid: makeGrid([
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [2, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'up')
    expect(next.grid[0]?.[0]).toBe(2)
  })

  it('열에서 같은 값이 합쳐진다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 0, 0, 0],
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'up')
    expect(next.grid[0]?.[0]).toBe(4)
    expect(next.score).toBe(4)
  })
})

describe('move - 아래쪽 이동', () => {
  it('타일이 아래쪽으로 이동한다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'down')
    expect(next.grid[3]?.[0]).toBe(2)
  })

  it('열에서 같은 값이 합쳐진다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 0, 0, 0],
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'down')
    expect(next.grid[3]?.[0]).toBe(4)
    expect(next.score).toBe(4)
  })
})

describe('이동 후 타일 스폰', () => {
  it('유효한 이동 후 새 타일이 하나 추가된다', () => {
    const state: GameState = {
      grid: makeGrid([
        [0, 0, 0, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'left')
    expect(countNonZero(next.grid)).toBe(2)
  })
})

describe('승리 조건', () => {
  it('2048 타일 도달 시 won이 true가 된다', () => {
    const state: GameState = {
      grid: makeGrid([
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'left')
    expect(next.won).toBe(true)
    expect(next.score).toBe(2048)
  })

  it('이미 이겼으면 won 상태가 유지된다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2048, 0, 0, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 2048,
      won: true,
      over: false,
    }
    const next = move(state, 'left')
    expect(next.won).toBe(true)
  })
})

describe('게임 오버 감지', () => {
  it('빈 셀이 있으면 게임 오버가 아니다', () => {
    const grid = makeGrid([
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2048, 4],
      [2, 4, 8, 0],
    ])
    expect(isGameOver(grid)).toBe(false)
  })

  it('인접한 같은 값이 있으면 게임 오버가 아니다', () => {
    const grid = makeGrid([
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2048, 4],
      [2, 4, 8, 8],
    ])
    expect(isGameOver(grid)).toBe(false)
  })

  it('이동 가능한 수가 없으면 게임 오버이다', () => {
    const grid = makeGrid([
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2048, 4],
      [2, 4, 8, 16],
    ])
    expect(isGameOver(grid)).toBe(true)
  })

  it('게임 오버 상태에서 이동해도 상태가 변하지 않는다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 4, 8, 16],
        [32, 64, 128, 256],
        [512, 1024, 2048, 4],
        [2, 4, 8, 16],
      ]),
      score: 100,
      won: false,
      over: true,
    }
    const next = move(state, 'left')
    expect(next).toBe(state)
  })
})

describe('점수 누적', () => {
  it('여러 타일 합산 시 점수가 올바르게 누적된다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 2, 4, 4],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const next = move(state, 'left')
    // 2+2=4 (4점), 4+4=8 (8점) → 총 12점
    expect(next.score).toBe(12)
  })
})

describe('moveDetailed - 모션 추적', () => {
  it('이동 없을 때 빈 모션을 반환한다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 4, 8, 16],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const detail = moveDetailed(state, 'left')
    expect(detail.motions).toHaveLength(0)
    expect(detail.spawnedAt).toBeNull()
    expect(detail.state).toBe(state)
  })

  it('슬라이드 이동 시 올바른 fromCol, toCol을 반환한다', () => {
    const state: GameState = {
      grid: makeGrid([
        [0, 0, 0, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const detail = moveDetailed(state, 'left')
    const motion = detail.motions.find((m) => m.fromRow === 0)
    expect(motion).toBeDefined()
    expect(motion?.fromCol).toBe(3)
    expect(motion?.toCol).toBe(0)
    expect(motion?.absorbed).toBe(false)
  })

  it('병합 시 두 개의 모션을 반환한다 (absorbed 포함)', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const detail = moveDetailed(state, 'left')
    const row0Motions = detail.motions.filter((m) => m.fromRow === 0)
    expect(row0Motions).toHaveLength(2)
    const survivor = row0Motions.find((m) => !m.absorbed)
    const absorbed = row0Motions.find((m) => m.absorbed)
    expect(survivor?.value).toBe(4)
    expect(absorbed?.fromCol).toBe(1)
    expect(absorbed?.toCol).toBe(0)
  })

  it('score, won, over 값이 move()와 동일하다', () => {
    const state: GameState = {
      grid: makeGrid([
        [2, 0, 0, 4],
        [0, 2, 0, 0],
        [0, 0, 4, 0],
        [0, 0, 0, 2],
      ]),
      score: 10,
      won: false,
      over: false,
    }
    // 두 호출이 각자 내부적으로 스폰을 수행하므로 그리드는 다를 수 있음
    // score/won/over 등 결정론적 부분만 비교
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const detail = moveDetailed(state, 'right')
    const direct = move(state, 'right')
    vi.restoreAllMocks()
    expect(detail.state.score).toBe(direct.score)
    expect(detail.state.won).toBe(direct.won)
    expect(detail.state.over).toBe(direct.over)
  })

  it('위쪽 이동 시 올바른 fromRow, toRow를 반환한다', () => {
    const state: GameState = {
      grid: makeGrid([
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [4, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const detail = moveDetailed(state, 'up')
    const motion = detail.motions.find((m) => m.fromCol === 0)
    expect(motion?.fromRow).toBe(3)
    expect(motion?.toRow).toBe(0)
  })

  it('스폰 위치를 감지한다', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // 이동 후 빈 셀 중 첫 번째 선택
      .mockReturnValueOnce(0.5) // value = 2
    const state: GameState = {
      grid: makeGrid([
        [0, 0, 0, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      score: 0,
      won: false,
      over: false,
    }
    const detail = moveDetailed(state, 'left')
    expect(detail.spawnedAt).not.toBeNull()
    vi.restoreAllMocks()
  })
})
