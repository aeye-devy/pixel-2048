import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createBgmEngine } from './bgmEngine.js'

function createMockAudioContext() {
  const oscillators: { type: string; started: boolean; stopped: boolean }[] = []
  const mockDestination = {}
  const ctx = {
    state: 'running' as string,
    currentTime: 0,
    sampleRate: 44100,
    destination: mockDestination,
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
    createGain: vi.fn(() => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
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
  return { ctx, oscillators }
}

let mockCtx: ReturnType<typeof createMockAudioContext>

beforeEach(() => {
  mockCtx = createMockAudioContext()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BgmEngine', () => {
  it('start 호출 후 isPlaying이 true를 반환함', () => {
    const bgm = createBgmEngine()
    bgm.start(
      mockCtx.ctx as unknown as AudioContext,
      mockCtx.ctx.destination as unknown as AudioNode,
    )
    expect(bgm.isPlaying()).toBe(true)
  })
  it('stop 호출 후 isPlaying이 false를 반환함', () => {
    const bgm = createBgmEngine()
    bgm.start(
      mockCtx.ctx as unknown as AudioContext,
      mockCtx.ctx.destination as unknown as AudioNode,
    )
    bgm.stop()
    expect(bgm.isPlaying()).toBe(false)
  })
  it('scheduler가 tick 후 오실레이터를 생성함', () => {
    const bgm = createBgmEngine()
    bgm.start(
      mockCtx.ctx as unknown as AudioContext,
      mockCtx.ctx.destination as unknown as AudioNode,
    )
    vi.advanceTimersByTime(50)
    expect(mockCtx.oscillators.length).toBeGreaterThan(0)
  })
  it('이미 재생 중일 때 start를 다시 호출해도 중복 시작되지 않음', () => {
    const bgm = createBgmEngine()
    const ctx = mockCtx.ctx as unknown as AudioContext
    const dest = mockCtx.ctx.destination as unknown as AudioNode
    bgm.start(ctx, dest)
    vi.advanceTimersByTime(50)
    const countAfterFirst = mockCtx.oscillators.length
    bgm.start(ctx, dest) // should be a no-op
    expect(bgm.isPlaying()).toBe(true)
    // No additional oscillators created from the duplicate start call
    expect(mockCtx.oscillators.length).toBe(countAfterFirst)
  })
  it('stop 후 scheduler가 더 이상 오실레이터를 생성하지 않음', () => {
    const bgm = createBgmEngine()
    bgm.start(
      mockCtx.ctx as unknown as AudioContext,
      mockCtx.ctx.destination as unknown as AudioNode,
    )
    vi.advanceTimersByTime(50)
    bgm.stop()
    const countAfterStop = mockCtx.oscillators.length
    vi.advanceTimersByTime(100)
    expect(mockCtx.oscillators.length).toBe(countAfterStop)
  })
  it('setTension이 0-1 범위로 클램핑됨', () => {
    const bgm = createBgmEngine()
    // Should not throw for out-of-range values
    expect(() => bgm.setTension(-0.5)).not.toThrow()
    expect(() => bgm.setTension(1.5)).not.toThrow()
    expect(() => bgm.setTension(0.5)).not.toThrow()
  })
  it('stop 후 다시 start 할 수 있음', () => {
    const bgm = createBgmEngine()
    const ctx = mockCtx.ctx as unknown as AudioContext
    const dest = mockCtx.ctx.destination as unknown as AudioNode
    bgm.start(ctx, dest)
    bgm.stop()
    expect(bgm.isPlaying()).toBe(false)
    bgm.start(ctx, dest)
    expect(bgm.isPlaying()).toBe(true)
    vi.advanceTimersByTime(50)
    expect(mockCtx.oscillators.length).toBeGreaterThan(0)
  })
  it('setVolume 호출 시 에러가 발생하지 않음', () => {
    const bgm = createBgmEngine()
    bgm.start(
      mockCtx.ctx as unknown as AudioContext,
      mockCtx.ctx.destination as unknown as AudioNode,
    )
    expect(() => bgm.setVolume(0.3)).not.toThrow()
    expect(() => bgm.setVolume(0)).not.toThrow()
    expect(() => bgm.setVolume(1)).not.toThrow()
  })
  it('높은 tension에서 퍼커션(노이즈) 채널이 추가됨', () => {
    const bgm = createBgmEngine()
    bgm.setTension(0.8)
    bgm.start(
      mockCtx.ctx as unknown as AudioContext,
      mockCtx.ctx.destination as unknown as AudioNode,
    )
    vi.advanceTimersByTime(50)
    // At high tension, noise buffers should be created for percussion
    expect(mockCtx.ctx.createBufferSource).toHaveBeenCalled()
  })
})
