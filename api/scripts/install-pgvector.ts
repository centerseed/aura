/**
 * 安裝 pgvector 擴充
 *
 * 這是一個安全的操作：
 * - CREATE EXTENSION IF NOT EXISTS 不會重複安裝
 * - 不會影響現有的 tables 或資料
 * - 只是啟用 PostgreSQL 的 vector 型別支援
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function installPgvector() {
  try {
    console.log('🔧 開始安裝 pgvector 擴充...')

    // 安裝 pgvector 擴充
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`)
    console.log('✅ pgvector 擴充安裝成功')

    // 驗證安裝
    const result = await prisma.$queryRawUnsafe<Array<{ extname: string; extversion: string }>>(
      `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';`
    )

    if (result.length > 0) {
      console.log(`✅ 驗證成功: pgvector v${result[0].extversion}`)
    } else {
      console.error('❌ 驗證失敗: pgvector 未安裝')
      process.exit(1)
    }

    // 測試向量運算子
    const testResult = await prisma.$queryRawUnsafe<Array<{ distance: number }>>(
      `SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector AS distance;`
    )
    console.log(`✅ 向量運算測試通過: distance = ${testResult[0].distance}`)

    console.log('\n🎉 pgvector 安裝完成！MCP search 工具現在可以正常運作了。')

  } catch (error) {
    console.error('❌ 安裝失敗:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

installPgvector()
