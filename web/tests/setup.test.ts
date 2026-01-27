import { describe, it, expect } from 'vitest'

describe('測試基礎設施', () => {
  it('應該能執行基本測試', () => {
    expect(1 + 1).toBe(2)
  })

  it('應該有環境變數設定', () => {
    expect(process.env.DATABASE_URL).toBeDefined()
    expect(process.env.FIREBASE_ADMIN_PROJECT_ID).toBe('test-project')
  })

  it('應該能使用 TypeScript', () => {
    const sum = (a: number, b: number): number => a + b
    expect(sum(2, 3)).toBe(5)
  })

  it('應該能測試 Promise', async () => {
    const promise = Promise.resolve('test')
    await expect(promise).resolves.toBe('test')
  })
})
