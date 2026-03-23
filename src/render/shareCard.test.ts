import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateShareCard, shareScore } from './shareCard.js'

function createMockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    fillRect: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D
}

function createMockCanvas(ctx: CanvasRenderingContext2D) {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn(),
  }
}

let mockCtx: CanvasRenderingContext2D
let mockCanvas: ReturnType<typeof createMockCanvas>

beforeEach(() => {
  mockCtx = createMockCtx()
  mockCanvas = createMockCanvas(mockCtx)
  vi.stubGlobal('document', {
    createElement: vi.fn(() => mockCanvas),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  })
})

const sampleGrid = [
  [512, 64, 32, 16],
  [8, 4, 2, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
]

describe('generateShareCard', () => {
  it('400x600 크기의 캔버스를 반환한다', () => {
    const canvas = generateShareCard(sampleGrid, 12345, false)
    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(600)
  })
  it('캔버스 2D 컨텍스트를 요청한다', () => {
    generateShareCard(sampleGrid, 12345, false)
    expect(mockCanvas.getContext).toHaveBeenCalledWith('2d')
  })
  it('배경을 그린다', () => {
    generateShareCard(sampleGrid, 12345, false)
    expect(mockCtx.fillRect).toHaveBeenCalled()
  })
  it('게임 오버 시 GAME OVER 텍스트를 표시한다', () => {
    generateShareCard(sampleGrid, 12345, false)
    expect(mockCtx.fillText).toHaveBeenCalledWith('GAME OVER', expect.any(Number), expect.any(Number))
  })
  it('승리 시 YOU WIN! 텍스트를 표시한다', () => {
    generateShareCard(sampleGrid, 12345, true)
    expect(mockCtx.fillText).toHaveBeenCalledWith('YOU WIN!', expect.any(Number), expect.any(Number))
  })
  it('점수를 표시한다', () => {
    generateShareCard(sampleGrid, 99999, false)
    expect(mockCtx.fillText).toHaveBeenCalledWith('99999', expect.any(Number), expect.any(Number))
  })
  it('HIGHEST TILE 라벨을 표시한다', () => {
    generateShareCard(sampleGrid, 100, false)
    expect(mockCtx.fillText).toHaveBeenCalledWith('HIGHEST TILE', expect.any(Number), expect.any(Number))
  })
  it('타일이 모두 0인 그리드에서 HIGHEST TILE을 표시하지 않는다', () => {
    const emptyGrid = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    generateShareCard(emptyGrid, 0, false)
    const calls = (mockCtx.fillText as ReturnType<typeof vi.fn>).mock.calls
    const hasHighestTile = calls.some((c: unknown[]) => c[0] === 'HIGHEST TILE')
    expect(hasHighestTile).toBe(false)
  })
  it('PIXEL 2048 타이틀을 표시한다', () => {
    generateShareCard(sampleGrid, 100, false)
    expect(mockCtx.fillText).toHaveBeenCalledWith('PIXEL 2048', expect.any(Number), expect.any(Number))
  })
  it('Play at 텍스트를 표시한다', () => {
    generateShareCard(sampleGrid, 100, false)
    expect(mockCtx.fillText).toHaveBeenCalledWith('Play at', expect.any(Number), expect.any(Number))
  })
  it('Fanxy 브랜딩을 표시한다', () => {
    generateShareCard(sampleGrid, 100, false)
    expect(mockCtx.fillText).toHaveBeenCalledWith('Made by FANXY', expect.any(Number), expect.any(Number))
  })
  it('큰 점수일 때 작은 폰트를 사용한다', () => {
    generateShareCard(sampleGrid, 123456, false)
    const calls = (mockCtx.fillText as ReturnType<typeof vi.fn>).mock.calls
    const scoreCall = calls.find((c: unknown[]) => c[0] === '123456')
    expect(scoreCall).toBeDefined()
  })
})

describe('shareScore', () => {
  it('toBlob 실패 시 failed를 반환한다', async () => {
    mockCanvas.toBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
      cb(null)
    })
    const result = await shareScore(sampleGrid, 1000, false)
    expect(result).toBe('failed')
  })
  it('Web Share API가 없을 때 download fallback으로 downloaded를 반환한다', async () => {
    const fakeBlob = new Blob(['test'], { type: 'image/png' })
    mockCanvas.toBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
      cb(fakeBlob)
    })
    const mockAnchor = { href: '', download: '', click: vi.fn() }
    vi.stubGlobal('document', {
      createElement: vi.fn((tag: string) => {
        if (tag === 'a') return mockAnchor
        return mockCanvas
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    })
    vi.stubGlobal('navigator', { share: undefined, canShare: undefined })
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
    const result = await shareScore(sampleGrid, 1000, false)
    expect(result).toBe('downloaded')
    expect(mockAnchor.download).toBe('pixel-2048-score.png')
    expect(mockAnchor.click).toHaveBeenCalled()
  })
  it('Web Share API 성공 시 shared를 반환한다', async () => {
    const fakeBlob = new Blob(['test'], { type: 'image/png' })
    mockCanvas.toBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
      cb(fakeBlob)
    })
    vi.stubGlobal('navigator', {
      share: vi.fn(() => Promise.resolve()),
      canShare: vi.fn(() => true),
    })
    const result = await shareScore(sampleGrid, 2000, true)
    expect(result).toBe('shared')
  })
  it('Web Share API 거부 시 failed를 반환한다', async () => {
    const fakeBlob = new Blob(['test'], { type: 'image/png' })
    mockCanvas.toBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
      cb(fakeBlob)
    })
    vi.stubGlobal('navigator', {
      share: vi.fn(() => Promise.reject(new Error('User cancelled'))),
      canShare: vi.fn(() => true),
    })
    const result = await shareScore(sampleGrid, 2000, false)
    expect(result).toBe('failed')
  })
})
