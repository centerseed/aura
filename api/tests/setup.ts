/**
 * Vitest 測試環境設定
 */
import { vi } from 'vitest'

// Mock 環境變數
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-api-key'
}
