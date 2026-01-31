/**
 * Vitest 測試環境設定
 */

import { vi } from 'vitest'

// Mock 環境變數（僅用於單元測試）
// 整合測試需要真實的 DATABASE_URL，所以不覆蓋已存在的環境變數

// 如果 DATABASE_URL 未設置或是舊的 mock 值，才設置 mock
const currentDbUrl = process.env.DATABASE_URL || ''
const isMockDbUrl = currentDbUrl.includes('test:test@localhost') || currentDbUrl === ''
if (isMockDbUrl) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
}

// GOOGLE_GENERATIVE_AI_API_KEY 可以始終使用 mock（整合測試中會被 mock）
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'
}

// 全域 Mock（如果需要）
// vi.mock('@/lib/db', () => ({
//   prisma: {
//     // Mock Prisma client
//   }
// }))
