export type AdResult = 'rewarded' | 'failed' | 'skipped'

export interface AdProvider {
  showRewardedAd(): Promise<AdResult>
}

const MOCK_AD_DURATION_MS = 3000
const AD_TIMEOUT_MS = 5000

export function createMockAdProvider(): AdProvider {
  return {
    showRewardedAd(): Promise<AdResult> {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve('failed'), AD_TIMEOUT_MS)
        setTimeout(() => {
          clearTimeout(timeout)
          resolve('rewarded')
        }, MOCK_AD_DURATION_MS)
      })
    },
  }
}
