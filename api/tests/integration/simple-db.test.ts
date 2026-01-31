/**
 * 簡單的資料庫連線測試
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'

describe('資料庫連線測試', () => {
  const TEST_USER_ID = '00000000-0000-0000-0000-000000000099'

  beforeAll(async () => {
    // 清理測試資料
    await prisma.user.deleteMany({
      where: { id: TEST_USER_ID },
    })

    // 建立測試用戶
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: 'simple-test@example.com',
        name: 'Simple Test User',
        auth_provider: 'GOOGLE',
        auth_provider_id: 'simple-test-uid',
      },
    })
  })

  afterAll(async () => {
    // 清理測試資料
    await prisma.user.deleteMany({
      where: { id: TEST_USER_ID },
    })
  })

  it('應該能夠連接到資料庫', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as value`
    expect(result).toBeDefined()
  })

  it('應該能夠查詢用戶資料表', async () => {
    const user = await prisma.user.findUnique({
      where: { id: TEST_USER_ID },
    })

    expect(user).toBeDefined()
    expect(user?.id).toBe(TEST_USER_ID)
    expect(user?.email).toBe('simple-test@example.com')
  })

  it('應該能夠建立和查詢 Area', async () => {
    const area = await prisma.area.create({
      data: {
        user_id: TEST_USER_ID,
        name: 'Test Area',
        is_custom: true,
      },
    })

    expect(area).toBeDefined()
    expect(area.name).toBe('Test Area')
    expect(area.user_id).toBe(TEST_USER_ID)

    // 清理
    await prisma.area.delete({ where: { id: area.id } })
  })

  it('應該能夠建立和查詢 Product', async () => {
    // 先建立 Area
    const area = await prisma.area.create({
      data: {
        user_id: TEST_USER_ID,
        name: 'Test Area for Product',
        is_custom: true,
      },
    })

    // 建立 Product
    const product = await prisma.product.create({
      data: {
        user_id: TEST_USER_ID,
        area_id: area.id,
        name: 'Test Product',
        status: 'ACTIVE',
        lifecycle: 'PERPETUAL',
      },
    })

    expect(product).toBeDefined()
    expect(product.name).toBe('Test Product')
    expect(product.area_id).toBe(area.id)

    // 清理
    await prisma.product.delete({ where: { id: product.id } })
    await prisma.area.delete({ where: { id: area.id } })
  })
})
