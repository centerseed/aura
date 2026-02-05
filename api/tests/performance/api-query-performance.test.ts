/**
 * API 查詢效能測試 - 直接連接 Supabase 生產環境
 *
 * ⚠️  警告：此測試連接生產資料庫，只做查詢，不做任何寫入或刪除
 *
 * 測試目標：
 * 1. GET /api/me - 獲取當前用戶資訊
 * 2. GET /api/library - 獲取完整層級結構
 * 3. GET /api/tasks?completed_today=true - 查詢今日完成的任務
 * 4. GET /api/milestones - 獲取所有里程碑
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient, Prisma } from '@prisma/client'

// ⚠️  使用生產環境 DATABASE_URL
const PRODUCTION_DB_URL = process.env.DATABASE_URL
const TEST_FIREBASE_UID = 'NEGH2cr1ucXnhWnGKFPipPuS7Hz2' // hhh12302001@gmail.com

// 創建專用的 Prisma Client（確保使用生產環境）
const prisma = new PrismaClient({
  datasourceUrl: PRODUCTION_DB_URL,
})

// 測試用的 userId（從 Firebase UID 查詢得到）
let userId: string

// ============================================================================
// 效能測量工具
// ============================================================================

function measure<T>(name: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve) => {
    const start = Date.now()
    const result = await fn()
    const duration = Date.now() - start
    console.log(`⏱️  ${name}: ${duration}ms`)
    resolve({ result, duration })
  })
}

// ============================================================================
// 測試開始前：查詢 userId
// ============================================================================

beforeAll(async () => {
  console.log('\n🔍 查詢 userId from Firebase UID...')
  const user = await prisma.user.findFirst({
    where: {
      auth_provider_id: TEST_FIREBASE_UID,
      deleted_at: null,
    },
    select: { id: true, email: true, name: true },
  })

  if (!user) {
    throw new Error(`User not found for Firebase UID: ${TEST_FIREBASE_UID}`)
  }

  userId = user.id
  console.log(`✅ User found: ${user.email} (${user.name})`)
  console.log(`   User ID: ${userId}\n`)
})

// ============================================================================
// 測試案例
// ============================================================================

describe('API 查詢效能測試 - 生產環境', () => {
  it('📊 效能基準測試：比較四個 API 的查詢時間', async () => {
    console.log('\n' + '='.repeat(80))
    console.log('開始效能測試...')
    console.log('='.repeat(80) + '\n')

    const results: Record<string, number> = {}

    // ========================================================================
    // 1. GET /api/me - 獲取當前用戶資訊 + areas
    // ========================================================================

    console.log('1️⃣  測試 /api/me 查詢')
    const { result: meResult, duration: meDuration } = await measure(
      'GET /api/me',
      async () => {
        const user = await prisma.user.findFirst({
          where: {
            auth_provider_id: TEST_FIREBASE_UID,
            deleted_at: null,
          },
          include: {
            areas: {
              where: { deleted_at: null },
              select: {
                id: true,
                name: true,
                scope: true,
                description: true,
              },
            },
          },
        })
        return user
      }
    )
    results['GET /api/me'] = meDuration
    console.log(`   ✓ 返回 ${meResult?.areas.length || 0} 個 areas\n`)

    // ========================================================================
    // 2. GET /api/library - 使用 raw SQL JOIN 載入完整結構
    // ========================================================================

    console.log('2️⃣  測試 /api/library 查詢（raw SQL JOIN）')
    const { result: libraryResult, duration: libraryDuration } = await measure(
      'GET /api/library',
      async () => {
        interface RawLibraryRow {
          area_id: string
          area_name: string
          area_description: string | null
          area_scope: string | null
          product_id: string | null
          product_name: string | null
          product_description: string | null
          product_status: string | null
          product_lifecycle: string | null
          product_references: unknown
          product_display_order: number | null
          task_id: string | null
          task_content: string | null
          task_status: string | null
          task_ai_analysis: unknown
          task_sub_items: unknown
          task_references: unknown
          task_start_date: Date | null
          task_due_date: Date | null
          task_time_confidence: number | null
          task_inferred_from_milestone: string | null
          task_created_at: Date | null
          topic_name: string | null
        }

        const rawRows = await prisma.$queryRaw<RawLibraryRow[]>`
          SELECT
            a.id::text as area_id,
            a.name as area_name,
            a.description as area_description,
            a.scope as area_scope,
            p.id::text as product_id,
            p.name as product_name,
            p.description as product_description,
            p.status::text as product_status,
            p.lifecycle::text as product_lifecycle,
            p.references as product_references,
            p.display_order as product_display_order,
            t.id::text as task_id,
            t.content as task_content,
            t.status::text as task_status,
            t.ai_analysis as task_ai_analysis,
            t.sub_items as task_sub_items,
            t.references as task_references,
            t.start_date as task_start_date,
            t.due_date as task_due_date,
            t.time_confidence as task_time_confidence,
            t.inferred_from_milestone as task_inferred_from_milestone,
            t.created_at as task_created_at,
            top.name as topic_name
          FROM areas a
          LEFT JOIN products p ON p.area_id = a.id AND p.deleted_at IS NULL
          LEFT JOIN tasks t ON t.product_id = p.id AND t.deleted_at IS NULL AND t.status != 'ARCHIVE'::"statusenum"
          LEFT JOIN topics top ON top.id = t.topic_id
          WHERE a.user_id = ${userId}::uuid AND a.deleted_at IS NULL
          ORDER BY a.name, p.display_order, p.name, t.created_at DESC
        `
        return rawRows
      }
    )
    results['GET /api/library'] = libraryDuration

    // 統計資料量
    const areaIds = new Set(libraryResult.map(r => r.area_id))
    const productIds = new Set(libraryResult.map(r => r.product_id).filter(Boolean))
    const taskIds = new Set(libraryResult.map(r => r.task_id).filter(Boolean))

    console.log(`   ✓ 返回 ${libraryResult.length} 行資料`)
    console.log(`   ✓ ${areaIds.size} 個 areas`)
    console.log(`   ✓ ${productIds.size} 個 products`)
    console.log(`   ✓ ${taskIds.size} 個 tasks\n`)

    // ========================================================================
    // 3. GET /api/tasks?completed_today=true - 今日完成的任務
    // ========================================================================

    console.log('3️⃣  測試 /api/tasks?completed_today=true 查詢')
    const { result: completedTodayResult, duration: completedTodayDuration } = await measure(
      'GET /api/tasks?completed_today=true',
      async () => {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
        const archiveStatus = 'ARCHIVE'

        interface RawTaskRow {
          id: string
          user_id: string
          product_id: string
          topic_id: string | null
          content: string
          status: string
          ai_analysis: unknown
          references: unknown
          sub_items: unknown
          start_date: Date | null
          due_date: Date | null
          time_confidence: number | null
          inferred_from_milestone: string | null
          remind_at: Date | null
          reminder_enabled: boolean
          reminder_timezone: string | null
          notification_id: number | null
          created_at: Date
          updated_at: Date
          product_name: string | null
          area_id: string | null
          area_name: string | null
          topic_name: string | null
        }

        const rawTasks = await prisma.$queryRaw<RawTaskRow[]>`
          SELECT
            t.id::text,
            t.user_id::text,
            t.product_id::text,
            t.topic_id::text,
            t.content,
            t.status::text,
            t.ai_analysis,
            t.references,
            t.sub_items,
            t.start_date,
            t.due_date,
            t.time_confidence,
            t.inferred_from_milestone,
            t.remind_at,
            t.reminder_enabled,
            t.reminder_timezone,
            t.notification_id,
            t.created_at,
            t.updated_at,
            p.name as product_name,
            p.area_id::text as area_id,
            a.name as area_name,
            top.name as topic_name
          FROM tasks t
          LEFT JOIN products p ON p.id = t.product_id
          LEFT JOIN areas a ON a.id = p.area_id
          LEFT JOIN topics top ON top.id = t.topic_id
          WHERE t.user_id = ${userId}::uuid
            AND t.deleted_at IS NULL
            AND t.status = ${archiveStatus}::text::"statusenum"
            AND t.updated_at >= ${todayStart}
            AND t.updated_at < ${todayEnd}
          ORDER BY t.updated_at DESC
        `
        return rawTasks
      }
    )
    results['GET /api/tasks?completed_today=true'] = completedTodayDuration
    console.log(`   ✓ 返回 ${completedTodayResult.length} 個今日完成的任務\n`)

    // ========================================================================
    // 4. GET /api/milestones - 查詢所有里程碑 + 批次載入關聯實體
    // ========================================================================

    console.log('4️⃣  測試 /api/milestones 查詢（含批次載入關聯）')
    const { result: milestonesResult, duration: milestonesDuration } = await measure(
      'GET /api/milestones',
      async () => {
        // Step 1: 查詢所有里程碑
        const milestones = await prisma.milestone.findMany({
          where: {
            user_id: userId,
            deleted_at: null,
          },
          orderBy: {
            target_date: 'asc',
          },
        })

        // Step 2: 批次查詢關聯實體
        const productIds = milestones
          .filter((m) => m.entity_type === 'PRODUCT')
          .map((m) => m.entity_id)
        const areaIds = milestones
          .filter((m) => m.entity_type === 'AREA')
          .map((m) => m.entity_id)
        const topicIds = milestones
          .filter((m) => m.entity_type === 'TOPIC')
          .map((m) => m.entity_id)

        const [products, areas, topics] = await Promise.all([
          productIds.length > 0
            ? prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true },
              })
            : [],
          areaIds.length > 0
            ? prisma.area.findMany({
                where: { id: { in: areaIds } },
                select: { id: true, name: true },
              })
            : [],
          topicIds.length > 0
            ? prisma.topic.findMany({
                where: { id: { in: topicIds } },
                select: { id: true, name: true },
              })
            : [],
        ])

        return { milestones, products, areas, topics }
      }
    )
    results['GET /api/milestones'] = milestonesDuration
    console.log(`   ✓ 返回 ${milestonesResult.milestones.length} 個里程碑`)
    console.log(`   ✓ 關聯 ${milestonesResult.products.length} 個 products, ${milestonesResult.areas.length} 個 areas, ${milestonesResult.topics.length} 個 topics\n`)

    // ========================================================================
    // 總結報告
    // ========================================================================

    console.log('\n' + '='.repeat(80))
    console.log('📊 效能測試總結')
    console.log('='.repeat(80) + '\n')

    const sortedResults = Object.entries(results).sort((a, b) => a[1] - b[1])

    sortedResults.forEach(([api, duration], index) => {
      const emoji = index === 0 ? '🏆' : index === sortedResults.length - 1 ? '🐌' : '  '
      console.log(`${emoji} ${api.padEnd(45)} ${duration.toString().padStart(6)}ms`)
    })

    console.log('\n' + '='.repeat(80) + '\n')

    // 斷言：確保所有查詢都在合理時間內完成
    expect(results['GET /api/me']).toBeLessThan(10000) // 10 秒
    expect(results['GET /api/library']).toBeLessThan(10000)
    expect(results['GET /api/tasks?completed_today=true']).toBeLessThan(10000)
    expect(results['GET /api/milestones']).toBeLessThan(10000)
  }, 60000) // 60 秒 timeout

  it('🔬 深入分析：分解 /api/library 查詢的各個階段', async () => {
    console.log('\n' + '='.repeat(80))
    console.log('分解 /api/library 查詢時間')
    console.log('='.repeat(80) + '\n')

    // 測試 1：只查詢 areas（無 JOIN）
    const { duration: areasOnlyDuration } = await measure(
      '階段 1: 只查詢 areas',
      async () => {
        return await prisma.area.findMany({
          where: {
            user_id: userId,
            deleted_at: null,
          },
        })
      }
    )

    // 測試 2：areas + products（1 層 JOIN）
    const { duration: areasProductsDuration } = await measure(
      '階段 2: areas + products',
      async () => {
        return await prisma.$queryRaw`
          SELECT
            a.id::text as area_id,
            a.name as area_name,
            p.id::text as product_id,
            p.name as product_name
          FROM areas a
          LEFT JOIN products p ON p.area_id = a.id AND p.deleted_at IS NULL
          WHERE a.user_id = ${userId}::uuid AND a.deleted_at IS NULL
        `
      }
    )

    // 測試 3：完整查詢（areas + products + tasks + topics）
    const { duration: fullQueryDuration } = await measure(
      '階段 3: 完整查詢 (areas + products + tasks + topics)',
      async () => {
        return await prisma.$queryRaw`
          SELECT
            a.id::text as area_id,
            p.id::text as product_id,
            t.id::text as task_id,
            top.id::text as topic_id
          FROM areas a
          LEFT JOIN products p ON p.area_id = a.id AND p.deleted_at IS NULL
          LEFT JOIN tasks t ON t.product_id = p.id AND t.deleted_at IS NULL AND t.status != 'ARCHIVE'::"statusenum"
          LEFT JOIN topics top ON top.id = t.topic_id
          WHERE a.user_id = ${userId}::uuid AND a.deleted_at IS NULL
        `
      }
    )

    console.log('\n📈 各階段查詢時間對比：')
    console.log(`   階段 1 (areas only):           ${areasOnlyDuration}ms`)
    console.log(`   階段 2 (+ products):           ${areasProductsDuration}ms (+${areasProductsDuration - areasOnlyDuration}ms)`)
    console.log(`   階段 3 (+ tasks + topics):     ${fullQueryDuration}ms (+${fullQueryDuration - areasProductsDuration}ms)`)
    console.log(`\n   總開銷：${fullQueryDuration}ms\n`)
  }, 60000)
})
