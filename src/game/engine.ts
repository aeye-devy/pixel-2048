export type Grid = number[][]
export type Direction = 'left' | 'right' | 'up' | 'down'

export interface GameState {
  grid: Grid
  score: number
  won: boolean
  over: boolean
}

const GRID_SIZE = 4
const WIN_VALUE = 2048
const SPAWN_FOUR_CHANCE = 0.1

export function createGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, (): number[] =>
    Array.from({ length: GRID_SIZE }, () => 0),
  )
}

function emptyPositions(grid: Grid): [number, number][] {
  const positions: [number, number][] = []
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if ((grid[r]?.[c] ?? -1) === 0) positions.push([r, c])
    }
  }
  return positions
}

export function spawnTile(grid: Grid): Grid {
  const positions = emptyPositions(grid)
  if (positions.length === 0) return grid
  const idx = Math.floor(Math.random() * positions.length)
  const pos = positions[idx]
  if (!pos) return grid
  const [r, c] = pos
  const value = Math.random() < SPAWN_FOUR_CHANCE ? 4 : 2
  const next = grid.map((row) => [...row])
  const row = next[r]
  if (row) row[c] = value
  return next
}

function slideRowLeft(row: number[]): { row: number[]; delta: number } {
  const tiles = row.filter((v) => v !== 0)
  const result: number[] = []
  let delta = 0
  let i = 0
  while (i < tiles.length) {
    const curr = tiles[i] ?? 0
    const next = tiles[i + 1]
    if (next !== undefined && curr === next) {
      const merged = curr * 2
      result.push(merged)
      delta += merged
      i += 2
    } else {
      result.push(curr)
      i++
    }
  }
  while (result.length < GRID_SIZE) result.push(0)
  return { row: result, delta }
}

function transpose(grid: Grid): Grid {
  return Array.from({ length: GRID_SIZE }, (_, c): number[] =>
    Array.from({ length: GRID_SIZE }, (_, r) => grid[r]?.[c] ?? 0),
  )
}

function flipRows(grid: Grid): Grid {
  return grid.map((row) => [...row].reverse())
}

function applyLeft(grid: Grid): { grid: Grid; delta: number } {
  let delta = 0
  const next = grid.map((row) => {
    const result = slideRowLeft(row)
    delta += result.delta
    return result.row
  })
  return { grid: next, delta }
}

function gridEqual(a: Grid, b: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if ((a[r]?.[c] ?? 0) !== (b[r]?.[c] ?? 0)) return false
    }
  }
  return true
}

function hasWon(grid: Grid): boolean {
  return grid.some((row) => row.some((v) => v >= WIN_VALUE))
}

export function isGameOver(grid: Grid): boolean {
  if (emptyPositions(grid).length > 0) return false
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = grid[r]?.[c] ?? 0
      if (c + 1 < GRID_SIZE && (grid[r]?.[c + 1] ?? -1) === v) return false
      if (r + 1 < GRID_SIZE && (grid[r + 1]?.[c] ?? -1) === v) return false
    }
  }
  return true
}

export function move(state: GameState, direction: Direction): GameState {
  if (state.over) return state
  let workGrid = state.grid.map((row) => [...row])
  let delta = 0
  if (direction === 'left') {
    const result = applyLeft(workGrid)
    workGrid = result.grid
    delta = result.delta
  } else if (direction === 'right') {
    const result = applyLeft(flipRows(workGrid))
    workGrid = flipRows(result.grid)
    delta = result.delta
  } else if (direction === 'up') {
    const result = applyLeft(transpose(workGrid))
    workGrid = transpose(result.grid)
    delta = result.delta
  } else {
    const result = applyLeft(flipRows(transpose(workGrid)))
    workGrid = transpose(flipRows(result.grid))
    delta = result.delta
  }
  if (gridEqual(workGrid, state.grid)) return state
  const newScore = state.score + delta
  const won = state.won || hasWon(workGrid)
  const spawned = spawnTile(workGrid)
  const over = isGameOver(spawned)
  return { grid: spawned, score: newScore, won, over }
}

export function createInitialState(): GameState {
  const grid = spawnTile(spawnTile(createGrid()))
  return { grid, score: 0, won: false, over: false }
}

// Removes 2 random tiles and spawns 1 new one, resetting the game-over state.
// Used as the reward for watching an ad after game over.
export function continueAfterGameOver(state: GameState): GameState {
  if (!state.over) return state
  let grid = state.grid.map((row) => [...row])
  const occupied: [number, number][] = []
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if ((grid[r]?.[c] ?? 0) !== 0) occupied.push([r, c])
    }
  }
  // Fisher-Yates shuffle to pick 2 random tiles to remove
  for (let i = occupied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = occupied[i]
    const b = occupied[j]
    if (a && b) {
      occupied[i] = b
      occupied[j] = a
    }
  }
  for (let i = 0; i < Math.min(2, occupied.length); i++) {
    const pos = occupied[i]
    if (!pos) continue
    const [r, c] = pos
    const row = grid[r]
    if (row) row[c] = 0
  }
  const newGrid = spawnTile(grid)
  return { grid: newGrid, score: state.score, won: state.won, over: false }
}

// --- Animation motion types (used by renderer) ---

export interface TileMotion {
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
  value: number // value at destination (merged value if applicable)
  absorbed: boolean // true if this tile was consumed by a merge
}

export interface MoveDetail {
  state: GameState
  motions: TileMotion[]
  spawnedAt: [number, number] | null
}

function posKey(row: number, col: number): string {
  return String(row) + ',' + String(col)
}

function computeMotionsForLane(
  tiles: { val: number; origRow: number; origCol: number }[],
  toCoords: (idx: number) => [number, number],
): TileMotion[] {
  const nonEmpty = tiles.filter((t) => t.val !== 0)
  const motions: TileMotion[] = []
  let toIdx = 0
  let i = 0
  while (i < nonEmpty.length) {
    const curr = nonEmpty[i]
    if (curr === undefined) break
    const next = nonEmpty[i + 1]
    if (next !== undefined) {
      if (curr.val === next.val) {
        const [toRow, toCol] = toCoords(toIdx)
        motions.push({ fromRow: curr.origRow, fromCol: curr.origCol, toRow, toCol, value: curr.val * 2, absorbed: false })
        motions.push({ fromRow: next.origRow, fromCol: next.origCol, toRow, toCol, value: curr.val * 2, absorbed: true })
        i += 2
        toIdx++
        continue
      }
    }
    const [toRow, toCol] = toCoords(toIdx)
    if (curr.origRow !== toRow || curr.origCol !== toCol) {
      motions.push({ fromRow: curr.origRow, fromCol: curr.origCol, toRow, toCol, value: curr.val, absorbed: false })
    }
    i++
    toIdx++
  }
  return motions
}

function computeMotions(grid: Grid, direction: Direction): TileMotion[] {
  const N = GRID_SIZE
  const motions: TileMotion[] = []
  if (direction === 'left') {
    for (let r = 0; r < N; r++) {
      const row = grid[r] ?? []
      const tiles = row.map((val, c) => ({ val, origRow: r, origCol: c }))
      motions.push(...computeMotionsForLane(tiles, (idx) => [r, idx]))
    }
  } else if (direction === 'right') {
    for (let r = 0; r < N; r++) {
      const row = (grid[r] ?? []).slice().reverse()
      const tiles = row.map((val, idx) => ({ val, origRow: r, origCol: N - 1 - idx }))
      motions.push(...computeMotionsForLane(tiles, (idx) => [r, N - 1 - idx]))
    }
  } else if (direction === 'up') {
    for (let c = 0; c < N; c++) {
      const tiles = Array.from({ length: N }, (_, r) => ({ val: grid[r]?.[c] ?? 0, origRow: r, origCol: c }))
      motions.push(...computeMotionsForLane(tiles, (idx) => [idx, c]))
    }
  } else {
    // down
    for (let c = 0; c < N; c++) {
      const tiles = Array.from({ length: N }, (_, idx) => {
        const r = N - 1 - idx
        return { val: grid[r]?.[c] ?? 0, origRow: r, origCol: c }
      })
      motions.push(...computeMotionsForLane(tiles, (idx) => [N - 1 - idx, c]))
    }
  }
  return motions
}

function buildPostSlideGrid(grid: Grid, motions: TileMotion[]): Grid {
  const N = GRID_SIZE
  const movedFrom = new Set(motions.map((m) => posKey(m.fromRow, m.fromCol)))
  const destValues = new Map<string, number>()
  for (const m of motions) {
    if (!m.absorbed) destValues.set(posKey(m.toRow, m.toCol), m.value)
  }
  return Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) => {
      const key = posKey(r, c)
      if (destValues.has(key)) return destValues.get(key) ?? 0
      if (movedFrom.has(key)) return 0
      return grid[r]?.[c] ?? 0
    }),
  )
}

function findSpawnedPos(postSlideGrid: Grid, finalGrid: Grid): [number, number] | null {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if ((postSlideGrid[r]?.[c] ?? 0) === 0 && (finalGrid[r]?.[c] ?? 0) !== 0) {
        return [r, c]
      }
    }
  }
  return null
}

export function countMerges(motions: TileMotion[]): number {
  return motions.filter((m) => m.absorbed).length
}

export function moveDetailed(state: GameState, direction: Direction): MoveDetail {
  if (state.over) return { state, motions: [], spawnedAt: null }
  const motions = computeMotions(state.grid, direction)
  const newState = move(state, direction)
  if (newState === state) return { state: newState, motions: [], spawnedAt: null }
  const postSlide = buildPostSlideGrid(state.grid, motions)
  const spawnedAt = findSpawnedPos(postSlide, newState.grid)
  return { state: newState, motions, spawnedAt }
}
