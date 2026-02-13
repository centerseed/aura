/**
 * Scenario A.3: Claude Desktop 隨手記
 *
 * 用戶在 Claude Desktop 聊天時隨手記下想法，
 * 透過 capture(mode=thought) 丟進 Zentropy，Gatekeeper 自動分類。
 *
 * 驗證：
 * 1. capture(mode=thought) 走 brain-dump pipeline（透過 apiClient.captureThought）
 * 2. 回應包含 id, status, classified_as, filed_to
 * 3. Gatekeeper 自動分類到正確的 Area/Product
 * 4. 支援 context_hint 提示分類
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @/lib/db so CaptureUseCase import resolves
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Taipei' }),
    },
  },
}))

import { handleCapture } from '@/mcp/tools/capture'
import type { BackendApiClient } from '@/mcp/backend-client/api-client'
import type { AuthContext } from '@/mcp/types'

describe('Scenario A.3: Claude Desktop 隨手記', () => {
  let mockApiClient: BackendApiClient
  const authContext: AuthContext = {
    userId: 'user-1',
    clientId: 'client-1',
    scopes: ['write:inbox'],
    tokenExpiry: Date.now() + 3600000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApiClient = {
      captureThought: vi.fn(),
    } as unknown as BackendApiClient
  })

  it('thought 模式應委派到 brain-dump pipeline 持久化', async () => {
    (mockApiClient.captureThought as any).mockResolvedValue({
      id: 'bd-abc-123',
      status: 'completed',
      title: 'auth 模組應該改成 async',
    })

    const result = await handleCapture(
      mockApiClient,
      authContext,
      {
        content: 'auth 模組應該改成 async，效能會好很多',
        source: 'Claude Desktop',
        mode: 'thought',
        context_hint: 'Work/Zentropy/Architecture',
      },
      false,
    )

    // Verify brain-dump pipeline was called
    expect(mockApiClient.captureThought).toHaveBeenCalledWith('user-1', {
      content: 'auth 模組應該改成 async，效能會好很多',
      source: 'Claude Desktop',
      context_hint: 'Work/Zentropy/Architecture',
    })

    // Verify response structure
    expect(result.id).toBe('bd-abc-123')
    expect(result.status).toBe('processed')
    expect(result.classified_as).toBe('thought')
    expect(result.filed_to).toBeDefined()
  })

  it('不帶 mode 應預設為 thought，走 brain-dump pipeline', async () => {
    (mockApiClient.captureThought as any).mockResolvedValue({
      id: 'bd-def-456',
      status: 'completed',
    })

    const result = await handleCapture(
      mockApiClient,
      authContext,
      {
        content: '跟客戶開會，他們要 camelCase API',
        source: 'Claude Desktop',
      },
      false,
    )

    expect(mockApiClient.captureThought).toHaveBeenCalled()
    expect(result.classified_as).toBe('thought')
    expect(result.status).toBe('processed')
  })

  it('帶 context_hint 應傳遞給 brain-dump pipeline', async () => {
    (mockApiClient.captureThought as any).mockResolvedValue({
      id: 'bd-ghi-789',
      status: 'completed',
    })

    const result = await handleCapture(
      mockApiClient,
      authContext,
      {
        content: 'Q1 報告下週交',
        source: 'Claude Desktop',
        mode: 'thought',
        context_hint: 'Work/Finance',
      },
      false,
    )

    expect(mockApiClient.captureThought).toHaveBeenCalledWith('user-1', {
      content: 'Q1 報告下週交',
      source: 'Claude Desktop',
      context_hint: 'Work/Finance',
    })
    expect(result.filed_to).toBeDefined()
  })

  it('sanitized 時應在回應加上 _warning', async () => {
    (mockApiClient.captureThought as any).mockResolvedValue({
      id: 'bd-jkl-012',
      status: 'completed',
    })

    const result = await handleCapture(
      mockApiClient,
      authContext,
      {
        content: '測試內容',
        source: 'Claude Desktop',
        mode: 'thought',
      },
      true, // sanitized
    )

    expect(result.status).toBe('processed')
    expect(result._warning).toBe('content_sanitized')
  })
})
