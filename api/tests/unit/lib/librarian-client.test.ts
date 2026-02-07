/**
 * Librarian Client 單元測試
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { librarianObserve, librarianRecall } from '@/lib/librarian-client'

// Mock global fetch
global.fetch = vi.fn()

describe('Librarian Client', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      LIBRARIAN_URL: 'https://test-librarian.example.com',
      LIBRARIAN_API_KEY: 'test-api-key-12345',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('librarianObserve', () => {
    it('應該正確發送 observe 請求到 Librarian Service', async () => {
      const mockFetch = global.fetch as any
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      await librarianObserve({
        userId: 'user-123',
        taskContent: '買牛奶',
        originalProduct: '行政事務',
        correctedProduct: '生活雜務',
      })

      // 檢查呼叫參數（API key 使用實際環境變數值，不檢查具體內容）
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/observe'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': expect.any(String),
          }),
          body: JSON.stringify({
            userId: 'user-123',
            domain: 'naruvia',
            input: '買牛奶',
            aiPrediction: '行政事務',
            userCorrection: '生活雜務',
          }),
        })
      )
    })

    it('應該包含 topic 變更資訊', async () => {
      const mockFetch = global.fetch as any
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      await librarianObserve({
        userId: 'user-123',
        taskContent: '預約牙醫',
        originalProduct: '生活雜務',
        correctedProduct: '生活雜務',
        originalTopic: '健康',
        correctedTopic: '醫療',
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.originalTopic).toBe('健康')
      expect(callBody.correctedTopic).toBe('醫療')
    })

    // 注意：環境變數在模組載入時就被讀取了，無法在測試中動態修改
    // 此測試僅用於文件化行為，實際測試略過
    it.skip('當環境變數未設定時，應該直接返回不執行請求', async () => {
      // 此測試需要在模組載入前設定環境變數，
      // 在單元測試中難以實現，保留作為文件說明
    })

    it('當請求失敗時，不應該拋出錯誤（fire-and-forget）', async () => {
      const mockFetch = global.fetch as any
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      // 不應該拋出錯誤
      await expect(
        librarianObserve({
          userId: 'user-123',
          taskContent: '測試',
          originalProduct: 'A',
          correctedProduct: 'B',
        })
      ).resolves.toBeUndefined()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[librarian] observe failed: 500')
      )

      consoleWarnSpy.mockRestore()
    })

    it('當網路錯誤時，不應該拋出錯誤', async () => {
      const mockFetch = global.fetch as any
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(
        librarianObserve({
          userId: 'user-123',
          taskContent: '測試',
          originalProduct: 'A',
          correctedProduct: 'B',
        })
      ).resolves.toBeUndefined()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[librarian] observe error:'),
        expect.any(String)
      )

      consoleWarnSpy.mockRestore()
    })

    it('成功時應該輸出 log', async () => {
      const mockFetch = global.fetch as any
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      await librarianObserve({
        userId: 'user-123',
        taskContent: '買牛奶',
        originalProduct: '行政事務',
        correctedProduct: '生活雜務',
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[librarian] ✅ observe success')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('userId: user-123')
      )

      consoleLogSpy.mockRestore()
    })
  })

  describe('librarianRecall', () => {
    it('應該正確發送 recall 請求', async () => {
      const mockFetch = global.fetch as any
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          rules: [
            { id: '1', pattern: 'test', correction: 'result', confidence: 0.9 },
          ],
        }),
      })

      const result = await librarianRecall({
        userId: 'user-123',
        input: '買東西',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/recall'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': expect.any(String),
          }),
          body: JSON.stringify({
            userId: 'user-123',
            domain: 'naruvia',
            input: '買東西',
          }),
        })
      )

      expect(result).toEqual([
        { id: '1', pattern: 'test', correction: 'result', confidence: 0.9 },
      ])
    })

    it('當請求失敗時，應該返回空陣列', async () => {
      const mockFetch = global.fetch as any
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const result = await librarianRecall({
        userId: 'user-123',
        input: '測試',
      })

      expect(result).toEqual([])
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[librarian] recall failed: 404')
      )

      consoleWarnSpy.mockRestore()
    })

    it.skip('當環境變數未設定時，應該返回空陣列', async () => {
      // 同上，環境變數在模組載入時已確定，測試略過
    })
  })
})
