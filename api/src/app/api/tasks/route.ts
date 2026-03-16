/**
 * Tasks API Routes - 使用 Clean Architecture
 *
 * Interface Layer: 處理 HTTP 請求/回應，呼叫 Use Cases
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import {
  ApiResponseBuilder,
  catchDomainException, ValidationException } from '@/lib/api-response'
import { safeToISOString, safeToISOStringRequired } from '@/lib/date-utils'
import { GetTasksUseCase } from '@/application/use-cases/tasks/get-tasks'
import { UpdateTaskUseCase } from '@/application/use-cases/tasks/update-task'
import { CreateTaskUseCase } from '@/application/use-cases/tasks/create-task'
import { syncPlanOnTaskChange } from '@/application/services/plan-sync'

const FALLBACK_AREA_NAME = '收件匣'
const FALLBACK_PRODUCT_NAME = '待整理'

// ============================================================================
// GET /api/tasks - 查詢任務列表
// ============================================================================

/**
 * Query params:
 * - status: 篩選特定狀態 (INBOX, ACTIVE, MAINTAIN, REFERENCE, ARCHIVE)
 * - completed_today: true 時只返回今日完成的任務
 * - from: ISO 日期字串，篩選 updated_at >= from
 * - to: ISO 日期字串，篩選 updated_at < to
 */
export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析查詢參數
    const { searchParams } = new URL(request.url)

    // 3. 執行 Use Case
    const useCase = new GetTasksUseCase()
    const result = await useCase.execute({
      userId,
      status: searchParams.get('status') || undefined,
      productId: searchParams.get('product_id') || undefined,
      topicId: searchParams.get('topic_id') || undefined,
      completedToday: searchParams.get('completed_today') === 'true',
      updatedAtFrom: searchParams.get('from') || undefined,
      updatedAtTo: searchParams.get('to') || undefined,
    })

    // 4. 格式化為前端格式
    const formattedTasks = result.tasks.map((task) => ({
      id: task.id,
      title: task.content,
      narrative: task.aiAnalysis?.narrative || null,
      drawer: task.status,
      lifecycle: task.aiAnalysis?.lifecycle || 'embryo',
      tag: {
        area: task.product?.area.name || FALLBACK_AREA_NAME,
        product: task.product?.name || FALLBACK_PRODUCT_NAME,
        topic: task.topic?.name || '未分類',
      },
      // Raw fields for Mobile App / Sync
      product_id: task.productId,
      topic_id: task.topicId,
      user_id: task.userId,
      content: task.content,
      status: task.status,
      recurring_task_id: task.recurringTaskId || null,
      sub_items: task.subItems.map((s) => ({
        id: s.id,
        content: s.content,
        completed: s.completed,
        created_at: safeToISOStringRequired(s.createdAt),
        completed_at: safeToISOString(s.completedAt),
        order: s.order,
        start_date: safeToISOString(s.startDate),
        due_date: safeToISOString(s.dueDate),
      })),
      strategy_used: task.aiAnalysis?.strategyUsed || null,
      reasoning: task.aiAnalysis?.reasoning || null,
      start_date: safeToISOString(task.startDate),
      due_date: safeToISOString(task.dueDate),
      time_confidence: task.timeConfidence || null,
      inferred_from_milestone: task.inferredFromMilestone || null,
      date_source: task.dateSource || null,
      date_locked: task.dateLocked || false,
      updated_at: safeToISOStringRequired(task.updatedAt),
      created_at: safeToISOStringRequired(task.createdAt),
      references: task.references.map((r) => ({
        id: r.id,
        type: r.type,
        content: r.content,
        title: r.title || null,
        created_at: safeToISOStringRequired(r.createdAt),
      })),
    }))

    // 5. 統一回應格式
    return ApiResponseBuilder.success(
      {
        tasks: formattedTasks,
      },
      {
        total: result.meta.total,
        filtered: result.meta.filtered,
      }
    )
  })
}

// ============================================================================
// PATCH /api/tasks - 更新任務
// ============================================================================

/**
 * Request body:
 * {
 *   taskId: string (required)
 *   status?: string
 *   productId?: string
 *   topicId?: string | null
 *   content?: string
 *   narrative?: string | null
 *   start_date?: string | null
 *   due_date?: string | null
 *   time_confidence?: number | null
 *   inferred_from_milestone?: string | null
 * }
 */
export async function PATCH(request: NextRequest) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析請求體
    const body = await request.json() as any
    const {
      taskId,
      status,
      productId,
      topicId,
      content,
      narrative,
      start_date,
      due_date,
      time_confidence,
      inferred_from_milestone,
    } = body

    // 3. 基礎驗證
    if (!taskId) {
      throw new ValidationException('taskId is required', 'taskId')
    }

    // 4. 執行 Use Case
    const useCase = new UpdateTaskUseCase()
    const result = await useCase.execute({
      taskId,
      userId,
      status,
      productId,
      topicId,
      content,
      narrative,
      startDate: start_date,
      dueDate: due_date,
      timeConfidence: time_confidence,
      inferredFromMilestone: inferred_from_milestone,
    })

    // 5. 格式化任務資料
    const task = result.task
    const analysis = task.aiAnalysis || {}
    const subItems = task.subItems || []
    const subItemsMeta = subItems.length > 0
      ? {
          total: subItems.length,
          completed: subItems.filter((item) => item.completed).length,
          completion_rate:
            subItems.filter((item) => item.completed).length / subItems.length,
        }
      : { total: 0, completed: 0, completion_rate: 0 }

    const formattedTask = {
      id: task.id,
      title: task.content,
      narrative: analysis.narrative || null,
      drawer: task.status,
      lifecycle: analysis.lifecycle || 'embryo',
      tag: {
        area: task.product?.area.name || FALLBACK_AREA_NAME,
        product: task.product?.name || FALLBACK_PRODUCT_NAME,
        topic: task.topic?.name || '未分類',
      },
      product_id: task.productId,
      topic_id: task.topicId,
      user_id: task.userId,
      content: task.content,
      status: task.status,
      sub_items: subItems.map((s) => ({
        id: s.id,
        content: s.content,
        completed: s.completed,
        created_at: safeToISOStringRequired(s.createdAt),
        completed_at: safeToISOString(s.completedAt),
        order: s.order,
        start_date: safeToISOString(s.startDate),
        due_date: safeToISOString(s.dueDate),
      })),
      sub_items_meta: subItemsMeta,
      strategy_used: analysis.strategyUsed || null,
      reasoning: analysis.reasoning || null,
      start_date: safeToISOString(task.startDate),
      due_date: safeToISOString(task.dueDate),
      time_confidence: task.timeConfidence || null,
      inferred_from_milestone: task.inferredFromMilestone || null,
      date_source: task.dateSource || null,
      date_locked: task.dateLocked || false,
      updated_at: safeToISOStringRequired(task.updatedAt),
      created_at: safeToISOStringRequired(task.createdAt),
      references: task.references.map((r) => ({
        id: r.id,
        type: r.type,
        content: r.content,
        title: r.title || null,
        created_at: safeToISOStringRequired(r.createdAt),
      })),
    }

    // 6. 同步 Plan（fire-and-forget）
    if (due_date !== undefined) {
      syncPlanOnTaskChange({
        userId,
        taskId,
        dueDate: due_date,
      }).catch(console.error)
    }

    // 7. 統一回應格式（包含狀態轉換提示訊息）
    return ApiResponseBuilder.success(
      {
        task: formattedTask,
        message: result.message,
      },
      {}
    )
  })
}

// ============================================================================
// POST /api/tasks - 建立任務
// ============================================================================

/**
 * Request body:
 * {
 *   content: string (required)
 *   product_id?: string | null (optional for INBOX tasks)
 *   topic_id?: string | null
 *   status?: string (default: INBOX)
 *   start_date?: string | null (ISO format)
 *   due_date?: string | null (ISO format)
 *   time_confidence?: number | null (0-1)
 *   inferred_from_milestone?: string | null
 * }
 */
export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析請求體
    const body = await request.json() as any
    const {
      content,
      product_id,
      topic_id,
      status,
      start_date,
      due_date,
      time_confidence,
      inferred_from_milestone,
      narrative,
    } = body

    // 3. 基礎驗證
    if (!content) {
      throw new ValidationException('content is required', 'content')
    }

    // product_id 為可選: INBOX 任務可以不指定 product

    // 4. 執行 Use Case
    const useCase = new CreateTaskUseCase()
    const result = await useCase.execute({
      userId,
      productId: product_id,
      topicId: topic_id,
      content,
      status,
      startDate: start_date,
      dueDate: due_date,
      timeConfidence: time_confidence,
      inferredFromMilestone: inferred_from_milestone,
      narrative,
    })

    // 5. 格式化任務資料
    const task = result.task
    const analysis = task.aiAnalysis || {}
    const subItems = task.subItems || []

    const formattedTask = {
      id: task.id,
      title: task.content,
      narrative: analysis.narrative || null,
      drawer: task.status,
      lifecycle: analysis.lifecycle || 'embryo',
      tag: {
        area: task.product?.area.name || FALLBACK_AREA_NAME,
        product: task.product?.name || FALLBACK_PRODUCT_NAME,
        topic: task.topic?.name || '未分類',
      },
      product_id: task.productId,
      topic_id: task.topicId,
      user_id: task.userId,
      content: task.content,
      status: task.status,
      sub_items: subItems.map((s) => ({
        id: s.id,
        content: s.content,
        completed: s.completed,
        created_at: safeToISOStringRequired(s.createdAt),
        completed_at: safeToISOString(s.completedAt),
        order: s.order,
        start_date: safeToISOString(s.startDate),
        due_date: safeToISOString(s.dueDate),
      })),
      strategy_used: analysis.strategyUsed || null,
      reasoning: analysis.reasoning || null,
      start_date: safeToISOString(task.startDate),
      due_date: safeToISOString(task.dueDate),
      time_confidence: task.timeConfidence || null,
      inferred_from_milestone: task.inferredFromMilestone || null,
      date_source: task.dateSource || null,
      date_locked: task.dateLocked || false,
      updated_at: safeToISOStringRequired(task.updatedAt),
      created_at: safeToISOStringRequired(task.createdAt),
      references: task.references.map((r) => ({
        id: r.id,
        type: r.type,
        content: r.content,
        title: r.title || null,
        created_at: safeToISOStringRequired(r.createdAt),
      })),
    }

    // 6. 同步 Plan（fire-and-forget）
    if (due_date) {
      syncPlanOnTaskChange({
        userId,
        taskId: task.id,
        dueDate: due_date,
      }).catch(console.error)
    }

    // 7. 統一回應格式
    return ApiResponseBuilder.success(
      {
        task: formattedTask,
        message: result.message,
      },
      {}
    )
  })
}
