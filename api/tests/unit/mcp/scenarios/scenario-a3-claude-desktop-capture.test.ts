/**
 * Scenario A.3: Claude Desktop 隨手記
 *
 * 用戶在 Claude Desktop 聊天時隨手記下想法，
 * 透過 capture(mode=thought) 丟進 Zentropy，Gatekeeper 自動分類。
 *
 * 驗證：
 * 1. capture(mode=thought) 走 brain-dump 流程
 * 2. 回應包含 id, status, classified_as, filed_to
 * 3. Gatekeeper 自動分類到正確的 Area/Product
 * 4. 支援 context_hint 提示分類
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Taipei' }),
    },
  },
}))

import { CaptureUseCase } from '@/application/use-cases/mcp/capture'

describe('Scenario A.3: Claude Desktop 隨手記', () => {
  let useCase: CaptureUseCase

  beforeEach(() => {
    vi.clearAllMocks()
    useCase = new CaptureUseCase()
  })

  it('thought 模式應成功捕捉並自動分類', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      content: 'auth 模組應該改成 async，效能會好很多',
      source: 'Claude Desktop',
      mode: 'thought',
      context_hint: 'Work/Zentropy/Architecture',
    })

    expect(result.id).toBeDefined()
    expect(result.status).toBe('processed')
    expect(result.classified_as).toBe('thought')
    expect(result.filed_to).toBeDefined()
  })

  it('不帶 mode 應預設為 thought', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      content: '跟客戶開會，他們要 camelCase API',
      source: 'Claude Desktop',
    })

    expect(result.classified_as).toBe('thought')
    expect(result.status).toBe('processed')
  })

  it('帶 context_hint 應將分類資訊放入 filed_to', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      content: 'Q1 報告下週交',
      source: 'Claude Desktop',
      mode: 'thought',
      context_hint: 'Work/Finance',
    })

    expect(result.filed_to).toBeDefined()
    expect(result.filed_to.area).toBeDefined()
  })

  it('來源必須是合法的 source', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      content: '測試內容',
      source: 'Claude Desktop',
      mode: 'thought',
    })

    // 不應拋錯，Claude Desktop 是合法來源
    expect(result.status).toBe('processed')
  })
})
