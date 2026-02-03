/**
 * Embedding 工具模組單元測試
 *
 * 測試目標：
 * 1. cosineSimilarity() 計算正確性（純函數，不依賴外部 API）
 * 2. 邊界條件處理
 *
 * 注意：findRelevantProducts() 的完整測試在整合測試中
 * (因為需要調用 Google Embedding API)
 */

import { describe, it, expect } from 'vitest'
import { cosineSimilarity, findRelevantProducts } from '@/lib/embedding'

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
})
