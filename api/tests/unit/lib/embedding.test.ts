/**
 * Embedding 工具模組單元測試
 *
 * 測試目標：
 * 1. cosineSimilarity() 計算正確性（純函數，不依賴外部 API）
 * 2. callGeminiEmbedding() API 呼叫邏輯（使用 Mock）
 * 3. 邊界條件處理
 *
 * 注意：findRelevantProducts() 的完整測試在整合測試中
 * (因為需要調用 Google Embedding API)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  cosineSimilarity,
  findRelevantProducts,
  callGeminiEmbedding,
  callGeminiBatchEmbedding,
  getEmbedding,
  batchGetEmbeddings,
} from '@/lib/embedding'

describe('Embedding 工具模組', () => {
  describe('cosineSimilarity()', () => {
    it('應該計算兩個相同向量的相似度為 1', () => {
      const vecA = [1, 2, 3]
      const vecB = [1, 2, 3]
      const similarity = cosineSimilarity(vecA, vecB)

      expect(similarity).toBeCloseTo(1.0, 5)
    })

    it('應該計算兩個正交向量的相似度為 0', () => {
      const vecA = [1, 0, 0]
      const vecB = [0, 1, 0]
      const similarity = cosineSimilarity(vecA, vecB)

      expect(similarity).toBeCloseTo(0.0, 5)
    })

    it('應該計算兩個相反向量的相似度為 -1', () => {
      const vecA = [1, 2, 3]
      const vecB = [-1, -2, -3]
      const similarity = cosineSimilarity(vecA, vecB)

      expect(similarity).toBeCloseTo(-1.0, 5)
    })

    it('應該正確計算部分相似的向量', () => {
      const vecA = [1, 0, 1]
      const vecB = [1, 1, 0]
      const similarity = cosineSimilarity(vecA, vecB)

      // cos(60°) = 0.5
      expect(similarity).toBeCloseTo(0.5, 5)
    })

    it('應該處理高維向量 (768 維 - text-embedding-004)', () => {
      const vecA = Array(768).fill(0).map((_, i) => i % 10)
      const vecB = Array(768).fill(0).map((_, i) => (i + 1) % 10)

      // 應該不拋出錯誤
      const similarity = cosineSimilarity(vecA, vecB)
      expect(similarity).toBeGreaterThanOrEqual(-1)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('應該拋出錯誤當向量維度不匹配', () => {
      const vecA = [1, 2, 3]
      const vecB = [1, 2]

      expect(() => cosineSimilarity(vecA, vecB)).toThrow('向量維度不匹配')
    })

    it('應該返回 0 當向量長度為零', () => {
      const vecA = [0, 0, 0]
      const vecB = [1, 2, 3]
      const similarity = cosineSimilarity(vecA, vecB)

      expect(similarity).toBe(0)
    })

    it('應該返回 0 當兩個向量長度都為零', () => {
      const vecA = [0, 0, 0]
      const vecB = [0, 0, 0]
      const similarity = cosineSimilarity(vecA, vecB)

      expect(similarity).toBe(0)
    })
  })

  describe('findRelevantProducts() - 邊界條件', () => {
    it('應該返回空陣列當沒有 Products', async () => {
      const result = await findRelevantProducts('測試輸入', [], 3)
      expect(result).toEqual([])
    })

    // 注意：其他 findRelevantProducts 測試（排序、語意匹配等）在整合測試中
    // 因為需要調用真實的 Google Embedding API
  })

  describe('callGeminiEmbedding (Mock 版本)', () => {
    let originalFetch: typeof global.fetch
    let originalEnv: string | undefined

    beforeEach(() => {
      originalFetch = global.fetch
      originalEnv = process.env.GOOGLE_GENERATIVE_AI_API_KEY
      // 設置測試用的 API key
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-api-key-12345'
      // Mock fetch
      global.fetch = vi.fn()
    })

    afterEach(() => {
      global.fetch = originalFetch
      if (originalEnv !== undefined) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnv
      } else {
        delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
      }
    })

    it('應該正確呼叫 Gemini Embedding API', async () => {
      const mockEmbedding = Array(768).fill(0.1)
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: { values: mockEmbedding } }),
      })

      const result = await callGeminiEmbedding('測試文本')

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-embedding-001'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('測試文本'),
        })
      )
      expect(result).toEqual(mockEmbedding)
      expect(result.length).toBe(768)
    })

    it('應該拋出錯誤當 API key 未設定', async () => {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY

      await expect(callGeminiEmbedding('test')).rejects.toThrow(
        'GOOGLE_GENERATIVE_AI_API_KEY is not set'
      )
    })

    it('應該處理 API 429 錯誤（速率限制）', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      })

      await expect(callGeminiEmbedding('test')).rejects.toThrow(
        'Gemini Embedding API error: 429 - Rate limit exceeded'
      )
    })

    it('應該處理 API 500 錯誤（伺服器錯誤）', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })

      await expect(callGeminiEmbedding('test')).rejects.toThrow(
        'Gemini Embedding API error: 500 - Internal Server Error'
      )
    })

    it('應該處理網路錯誤（fetch 失敗）', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      await expect(callGeminiEmbedding('test')).rejects.toThrow('Network error')
    })

    it('應該在請求 body 中包含正確的參數', async () => {
      const mockEmbedding = Array(768).fill(0.5)
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: { values: mockEmbedding } }),
      })

      await callGeminiEmbedding('測試輸入')

      const callArgs = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)

      expect(requestBody).toEqual({
        model: 'models/gemini-embedding-001',
        content: {
          parts: [{ text: '測試輸入' }],
        },
        outputDimensionality: 768,
      })
    })
  })

  describe('callGeminiBatchEmbedding (Mock 版本)', () => {
    let originalFetch: typeof global.fetch
    let originalEnv: string | undefined

    beforeEach(() => {
      originalFetch = global.fetch
      originalEnv = process.env.GOOGLE_GENERATIVE_AI_API_KEY
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-api-key-12345'
      global.fetch = vi.fn()
    })

    afterEach(() => {
      global.fetch = originalFetch
      if (originalEnv !== undefined) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnv
      } else {
        delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
      }
    })

    it('應該批次處理多個文本', async () => {
      const mockEmbeddings = [
        Array(768).fill(0.1),
        Array(768).fill(0.2),
        Array(768).fill(0.3),
      ]
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          embeddings: mockEmbeddings.map((values) => ({ values })),
        }),
      })

      const result = await callGeminiBatchEmbedding(['text1', 'text2', 'text3'])

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(mockEmbeddings[0])
      expect(result[1]).toEqual(mockEmbeddings[1])
      expect(result[2]).toEqual(mockEmbeddings[2])
    })

    it('應該處理空陣列輸入', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ embeddings: [] }),
      })

      const result = await callGeminiBatchEmbedding([])

      expect(result).toEqual([])
    })

    it('應該拋出錯誤當 API key 未設定', async () => {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY

      await expect(callGeminiBatchEmbedding(['test'])).rejects.toThrow(
        'GOOGLE_GENERATIVE_AI_API_KEY is not set'
      )
    })

    it('應該處理 API 錯誤', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      })

      await expect(callGeminiBatchEmbedding(['test'])).rejects.toThrow(
        'Gemini Batch Embedding API error: 400 - Bad Request'
      )
    })
  })

  describe('getEmbedding (Mock callGeminiEmbedding)', () => {
    let originalFetch: typeof global.fetch
    let originalEnv: string | undefined

    beforeEach(() => {
      originalFetch = global.fetch
      originalEnv = process.env.GOOGLE_GENERATIVE_AI_API_KEY
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-api-key-12345'
      global.fetch = vi.fn()
    })

    afterEach(() => {
      global.fetch = originalFetch
      if (originalEnv !== undefined) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnv
      } else {
        delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
      }
    })

    it('應該正確呼叫底層 API', async () => {
      const mockEmbedding = Array(768).fill(0.5)
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: { values: mockEmbedding } }),
      })

      const result = await getEmbedding('測試文本')

      expect(result).toEqual(mockEmbedding)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('batchGetEmbeddings', () => {
    let originalFetch: typeof global.fetch
    let originalEnv: string | undefined

    beforeEach(() => {
      originalFetch = global.fetch
      originalEnv = process.env.GOOGLE_GENERATIVE_AI_API_KEY
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-api-key-12345'
      global.fetch = vi.fn()
    })

    afterEach(() => {
      global.fetch = originalFetch
      if (originalEnv !== undefined) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnv
      } else {
        delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
      }
    })

    it('應該批次獲取 embeddings', async () => {
      const mockEmbeddings = [
        Array(768).fill(0.1),
        Array(768).fill(0.2),
      ]
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          embeddings: mockEmbeddings.map((values) => ({ values })),
        }),
      })

      const result = await batchGetEmbeddings(['text1', 'text2'])

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(mockEmbeddings[0])
      expect(result[1]).toEqual(mockEmbeddings[1])
    })

    it('應該返回空陣列當輸入為空', async () => {
      const result = await batchGetEmbeddings([])
      expect(result).toEqual([])
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('應該對單一文本使用 getEmbedding', async () => {
      const mockEmbedding = Array(768).fill(0.3)
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: { values: mockEmbedding } }),
      })

      const result = await batchGetEmbeddings(['single text'])

      expect(result).toEqual([mockEmbedding])
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('embedContent'), // 使用單一 API
        expect.any(Object)
      )
    })
  })
})
