/**
 * Vitest 測試環境設定
 */

import { vi } from 'vitest'

// Mock 環境變數
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'

// 全域 Mock（如果需要）
// vi.mock('@/lib/db', () => ({
//   prisma: {
//     // Mock Prisma client
//   }
// }))
