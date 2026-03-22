import { describe, it, expect } from 'vitest'
import { VERSION } from './index.js'

describe('패키지 버전', () => {
  it('버전이 정의되어 있어야 한다', () => {
    expect(VERSION).toBeDefined()
    expect(typeof VERSION).toBe('string')
  })
})
