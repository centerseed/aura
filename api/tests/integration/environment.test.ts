/**
 * 環境變數整合測試
 *
 * 這個測試確保所有必要的環境變數都已正確設置
 * 這樣可以在部署前就發現配置問題，避免在 Cloud Run 上才出錯
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/lib/db'

describe('環境變數驗證', () => {
  beforeAll(() => {
    // 顯示當前使用的 DATABASE_URL（隱藏密碼）
    const dbUrl = process.env.DATABASE_URL || ''
    const sanitizedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@')
    console.log('當前 DATABASE_URL:', sanitizedUrl)
  })

  it('應該已設置 DATABASE_URL', () => {
    expect(process.env.DATABASE_URL).toBeDefined()
    expect(process.env.DATABASE_URL).not.toBe('')

    // 確保不是 mock 的資料庫 URL（整合測試應該使用真實的資料庫）
    const dbUrl = process.env.DATABASE_URL || ''
    if (dbUrl.includes('test:test@localhost')) {
      console.warn('⚠️  警告：正在使用 mock 資料庫 URL，整合測試需要真實的資料庫')
      console.warn('請確保在運行整合測試前設置正確的 DATABASE_URL 環境變數')
    }
  })

  it('應該已設置 GOOGLE_GENERATIVE_AI_API_KEY', () => {
    expect(process.env.GOOGLE_GENERATIVE_AI_API_KEY).toBeDefined()
    expect(process.env.GOOGLE_GENERATIVE_AI_API_KEY).not.toBe('')
  })

  it.skip('應該能夠連接到資料庫', async () => {
    // Skip this test for now - requires real database connection
    // 這個測試需要真實的資料庫連接
    // 在 CI/CD 環境中或有測試資料庫時才啟用
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toBeDefined()
  })

  it.skip('應該能夠查詢 User 資料表', async () => {
    // Skip - requires real database
    const result = await prisma.user.findMany({ take: 1 })
    expect(result).toBeInstanceOf(Array)
  })

  it.skip('應該能夠查詢 Task 資料表', async () => {
    // Skip - requires real database
    const result = await prisma.task.findMany({ take: 1 })
    expect(result).toBeInstanceOf(Array)
  })

  it.skip('應該能夠查詢 Product 資料表', async () => {
    // Skip - requires real database
    const result = await prisma.product.findMany({ take: 1 })
    expect(result).toBeInstanceOf(Array)
  })

  it.skip('應該能夠查詢 Area 資料表', async () => {
    // Skip - requires real database
    const result = await prisma.area.findMany({ take: 1 })
    expect(result).toBeInstanceOf(Array)
  })
})

/**
 * 為什麼這些測試很重要？
 *
 * 1. DATABASE_URL 缺失：
 *    - 之前在 Cloud Run 部署時，DATABASE_URL 環境變數缺失
 *    - 導致 Prisma 無法連接資料庫
 *    - 這個測試會在本地就發現問題
 *
 * 2. 資料庫連接：
 *    - 確保 DATABASE_URL 格式正確
 *    - 確保資料庫可以正常連接
 *    - 確保網路權限正確
 *
 * 3. Schema 驗證：
 *    - 確保資料庫 schema 與 Prisma schema 一致
 *    - 確保所有必要的資料表都存在
 *    - 避免部署後才發現 migration 未執行
 *
 * 如何啟用資料庫測試：
 *
 * 1. 確保有測試資料庫可用
 * 2. 設置 DATABASE_URL 環境變數指向測試資料庫
 * 3. 移除 it.skip 中的 .skip
 * 4. 運行測試：npm run test tests/integration/environment.test.ts
 */
