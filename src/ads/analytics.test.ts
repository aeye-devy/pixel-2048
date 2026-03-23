import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trackEvent, trackPageView } from './analytics.js'

describe('analytics', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    Object.defineProperty(navigator, 'doNotTrack', { value: '0', configurable: true })
  })
  afterEach(() => {
    consoleSpy.mockRestore()
  })
  it('endpoint 미설정 시 console.log로 이벤트 출력', () => {
    trackEvent('game_start')
    expect(consoleSpy).toHaveBeenCalledWith('[Analytics]', 'game_start', '')
  })
  it('trackPageView 호출 시 page_view 이벤트 출력', () => {
    trackPageView()
    expect(consoleSpy).toHaveBeenCalledWith('[Analytics]', 'page_view', '')
  })
  it('game_over 이벤트에 score 데이터 포함', () => {
    trackEvent('game_over', { score: 1234 })
    expect(consoleSpy).toHaveBeenCalledWith('[Analytics]', 'game_over', { score: 1234 })
  })
  it('DNT 활성화 시 이벤트 전송하지 않음', () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true })
    trackEvent('game_start')
    expect(consoleSpy).not.toHaveBeenCalled()
  })
})
