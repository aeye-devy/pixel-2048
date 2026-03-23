import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSoundEngine } from './soundEngine.js'

// Minimal AudioContext mock
function createMockAudioContext() {
  const oscillators: { type: string; started: boolean; stopped: boolean }[] = []
  const gainNodes: { gain: { value: number } }[] = []
  const mockDestination = {}
  const ctx = {
    state: 'running' as string,
    currentTime: 0,
    sampleRate: 44100,
    destination: mockDestination,
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(() => { osc.started = true }),
        stop: vi.fn(() => { osc.stopped = true }),
        started: false,
        stopped: false,
      }
      oscillators.push(osc)
      return osc
    }),
    createGain: vi.fn(() => {
      const node = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }
      gainNodes.push(node)
      return node
    }),
    createBuffer: vi.fn((_channels: number, length: number, sampleRate: number) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
      length,
      sampleRate,
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
  }
  return { ctx, oscillators, gainNodes }
}

let mockCtx: ReturnType<typeof createMockAudioContext>
let storage: Record<string, string>

function createMockLocalStorage() {
  storage = {}
  return {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { storage[key] = value }),
    removeItem: vi.fn((key: string) => { delete storage[key] }),
    clear: vi.fn(() => { storage = {} }),
    get length() { return Object.keys(storage).length },
    key: vi.fn(() => null),
  }
}

beforeEach(() => {
  mockCtx = createMockAudioContext()
  vi.stubGlobal('AudioContext', vi.fn(() => mockCtx.ctx))
  vi.stubGlobal('localStorage', createMockLocalStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SoundEngine', () => {
  it('음소거 상태가 아닐 때 사운드를 재생하면 오실레이터가 생성됨', () => {
    const engine = createSoundEngine()
    engine.unlock()
    engine.play('slide')
    expect(mockCtx.oscillators.length).toBeGreaterThan(0)
  })
  it('음소거 상태에서 사운드를 재생하면 오실레이터가 생성되지 않음', () => {
    const engine = createSoundEngine()
    engine.unlock()
    engine.toggleMute()
    engine.play('slide')
    expect(mockCtx.oscillators.length).toBe(0)
  })
  it('toggleMute가 새로운 음소거 상태를 반환함', () => {
    const engine = createSoundEngine()
    expect(engine.isMuted()).toBe(false)
    const result = engine.toggleMute()
    expect(result).toBe(true)
    expect(engine.isMuted()).toBe(true)
    const result2 = engine.toggleMute()
    expect(result2).toBe(false)
    expect(engine.isMuted()).toBe(false)
  })
  it('음소거 상태가 localStorage에 저장됨', () => {
    const engine = createSoundEngine()
    engine.toggleMute()
    expect(localStorage.getItem('pixel2048-muted')).toBe('1')
    engine.toggleMute()
    expect(localStorage.getItem('pixel2048-muted')).toBe('0')
  })
  it('localStorage에 저장된 음소거 상태로 초기화됨', () => {
    localStorage.setItem('pixel2048-muted', '1')
    const engine = createSoundEngine()
    expect(engine.isMuted()).toBe(true)
  })
  it('unlock 호출 시 suspended 상태의 AudioContext를 resume함', () => {
    mockCtx.ctx.state = 'suspended'
    const engine = createSoundEngine()
    engine.unlock()
    expect(mockCtx.ctx.resume).toHaveBeenCalled()
  })
  it('merge 사운드 재생 시 mergeValue에 따라 오실레이터가 생성됨', () => {
    const engine = createSoundEngine()
    engine.unlock()
    engine.play('merge', 128)
    expect(mockCtx.oscillators.length).toBeGreaterThan(0)
  })
  it('모든 사운드 타입이 에러 없이 재생됨', () => {
    const engine = createSoundEngine()
    engine.unlock()
    const sounds = ['slide', 'merge', 'spawn', 'gameOver', 'win', 'buttonTap'] as const
    for (const name of sounds) {
      expect(() => engine.play(name, 64)).not.toThrow()
    }
  })
  it('AudioContext가 suspended 상태이면 사운드를 재생하지 않음', () => {
    mockCtx.ctx.state = 'suspended'
    const engine = createSoundEngine()
    engine.play('slide')
    expect(mockCtx.oscillators.length).toBe(0)
  })
})
