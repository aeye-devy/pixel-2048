export type GameEvent =
  | 'game_start'
  | 'game_over'
  | 'win_2048'
  | 'ad_prompt_shown'
  | 'ad_watched'
  | 'ad_skipped'
  | 'ad_failed'
  | 'page_view'

type EventPayload = Record<string, unknown>

const ENDPOINT = import.meta.env.VITE_ANALYTICS_URL as string | undefined
const SESSION_START = Date.now()
let sessionReported = false

function isDntEnabled(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.doNotTrack === '1' || (navigator as Record<string, unknown>).globalPrivacyControl === true
}

function send(event: GameEvent, data?: EventPayload): void {
  if (isDntEnabled()) return
  const payload = {
    event,
    ts: Date.now(),
    sessionMs: Date.now() - SESSION_START,
    url: typeof location !== 'undefined' ? location.href : '',
    ...data,
  }
  if (!ENDPOINT) {
    console.log('[Analytics]', event, data ?? '')
    return
  }
  const body = JSON.stringify(payload)
  if (typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(ENDPOINT, body)
  } else {
    fetch(ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => {})
  }
}

export function trackEvent(event: GameEvent, data?: EventPayload): void {
  send(event, data)
}

export function trackPageView(): void {
  send('page_view')
}

export function trackSessionDuration(): void {
  if (sessionReported) return
  sessionReported = true
  send('page_view', { type: 'session_end', durationMs: Date.now() - SESSION_START })
}

/** @deprecated Use trackEvent instead. Kept for backward compatibility with ad code. */
export function fireAdEvent(event: GameEvent, data?: EventPayload): void {
  trackEvent(event, data)
}

// Report session duration on page unload
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      trackSessionDuration()
    }
  })
}
