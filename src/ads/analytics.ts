export type AdEvent = 'ad_prompt_shown' | 'ad_watched' | 'ad_skipped' | 'ad_failed'

export function fireAdEvent(event: AdEvent, data?: Record<string, unknown>): void {
  console.log('[Analytics]', event, data ?? '')
}
