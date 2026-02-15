/**
 * 分析 SQL 查詢性能
 *
 * 執行：npx tsx scripts/analyze-query-performance.ts
 */

import 'dotenv/config'
import { prisma } from '../src/lib/db'

const USER_ID = '7c25eb8f-4f5a-4b5c-9b15-d43a97d2da44'

async function analyzeTaskQuery() {
  console.log('🔍 Analyzing queryAllTasksAndSubTasks performance...\n')

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // 1. Count total tasks
  const taskCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM tasks t
    WHERE t.user_id = ${USER_ID}::uuid
      AND t.deleted_at IS NULL
  `
  console.log('📊 Total tasks for user:', Number(taskCount[0].count))

  // 2. EXPLAIN ANALYZE for tasks query
  console.log('\n🔍 EXPLAIN ANALYZE for tasks query:\n')
  const explainTasks = await prisma.$queryRawUnsafe<any[]>(`
    EXPLAIN ANALYZE
    SELECT
      t.id::text as task_id,
      t.content as task_content,
      t.status::text as task_status,
      t.due_date as task_due_date,
      t.start_date as task_start_date,
      t.updated_at as task_updated_at,
      t.completed_at as task_completed_at,
      t.inferred_from_milestone::text as task_milestone,
      t.date_source as task_date_source,
      a.name as area_name,
      p.id::text as product_id,
      p.name as product_name,
      p.description as product_description
    FROM tasks t
    JOIN products p ON p.id = t.product_id
    JOIN areas a ON a.id = p.area_id
    WHERE t.user_id = '${USER_ID}'::uuid
      AND t.deleted_at IS NULL
      AND (
        t.status IN ('ACTIVE', 'INBOX')
        OR (t.status = 'ARCHIVE' AND t.completed_at >= '${todayStart.toISOString()}'::timestamp AND t.completed_at < '${todayEnd.toISOString()}'::timestamp)
      )
    ORDER BY
      CASE WHEN t.due_date IS NOT NULL AND t.due_date < NOW() THEN 0 ELSE 1 END,
      t.due_date ASC NULLS LAST,
      t.updated_at DESC
  `)

  for (const row of explainTasks) {
    console.log(row['QUERY PLAN'])
  }

  // 3. EXPLAIN ANALYZE for subtasks query
  console.log('\n\n🔍 EXPLAIN ANALYZE for subtasks query:\n')
  const explainSubTasks = await prisma.$queryRawUnsafe<any[]>(`
    EXPLAIN ANALYZE
    SELECT
      st.id::text,
      st.task_id::text,
      st.content,
      st.completed,
      st.due_date,
      st.start_date,
      st.estimated_minutes,
      st.order,
      st.updated_at
    FROM sub_tasks st
    JOIN tasks t ON t.id = st.task_id
    WHERE t.user_id = '${USER_ID}'::uuid
      AND st.deleted_at IS NULL
      AND t.deleted_at IS NULL
      AND (
        t.status IN ('ACTIVE', 'INBOX')
        OR (t.status = 'ARCHIVE' AND t.completed_at >= '${todayStart.toISOString()}'::timestamp AND t.completed_at < '${todayEnd.toISOString()}'::timestamp)
      )
    ORDER BY st.order ASC
  `)

  for (const row of explainSubTasks) {
    console.log(row['QUERY PLAN'])
  }

  // 4. Check if index exists
  console.log('\n\n📋 Checking indexes on tasks table:\n')
  const indexes = await prisma.$queryRaw<any[]>`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'tasks'
      AND indexname LIKE '%completed_at%'
  `

  if (indexes.length > 0) {
    console.log('✅ Found completed_at indexes:')
    for (const idx of indexes) {
      console.log(`  - ${idx.indexname}`)
      console.log(`    ${idx.indexdef}`)
    }
  } else {
    console.log('❌ No completed_at index found!')
  }
}

async function main() {
  try {
    await analyzeTaskQuery()
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
