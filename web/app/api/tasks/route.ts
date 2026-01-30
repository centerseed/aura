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
  catchDomainException,
} from '@/lib/api-response'
import { GetTasksUseCase } from '@/application/use-cases/tasks/get-tasks'
import { UpdateTaskUseCase } from '@/application/use-cases/tasks/update-task'

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
        area: task.product?.area.name || 'Unknown',
        product: task.product?.name || 'Unknown',
        topic: task.topic?.name || '未分類',
      },
      // Raw fields for Mobile App / Sync
      product_id: task.productId,
      topic_id: task.topicId,
      user_id: task.userId,
      content: task.content,
      status: task.status,
      sub_items: task.subItems.map((s) => ({
        id: s.id,
        content: s.content,
        completed: s.completed,
        created_at: s.createdAt.toISOString(),
        completed_at: s.completedAt?.toISOString() || null,
        order: s.order,
      })),
      strategy_used: task.aiAnalysis?.strategyUsed || null,
      reasoning: task.aiAnalysis?.reasoning || null,
      start_date: task.startDate?.toISOString() || null,
      due_date: task.dueDate?.toISOString() || null,
      time_confidence: task.timeConfidence || null,
      inferred_from_milestone: task.inferredFromMilestone || null,
      updated_at: task.updatedAt.toISOString(),
      created_at: task.createdAt.toISOString(),
      references: task.references.map((r) => ({
        id: r.id,
        type: r.type,
        content: r.content,
        title: r.title || null,
        created_at: r.createdAt.toISOString(),
      })),
    }))

    // 5. 統一回應格式
    return ApiResponseBuilder.success(formattedTasks, {
      total: result.meta.total,
      filtered: result.meta.filtered,
    })
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
    const body = await request.json()
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
      return ApiResponseBuilder.validationError('taskId is required', {
        field: 'taskId',
      })
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
        area: task.product?.area.name || 'Unknown',
        product: task.product?.name || 'Unknown',
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
        created_at: s.createdAt.toISOString(),
        completed_at: s.completedAt?.toISOString() || null,
        order: s.order,
      })),
      sub_items_meta: subItemsMeta,
      strategy_used: analysis.strategyUsed || null,
      reasoning: analysis.reasoning || null,
      start_date: task.startDate?.toISOString() || null,
      due_date: task.dueDate?.toISOString() || null,
      time_confidence: task.timeConfidence || null,
      inferred_from_milestone: task.inferredFromMilestone || null,
      updated_at: task.updatedAt.toISOString(),
      created_at: task.createdAt.toISOString(),
      references: task.references.map((r) => ({
        id: r.id,
        type: r.type,
        content: r.content,
        title: r.title || null,
        created_at: r.createdAt.toISOString(),
      })),
    }

    // 6. 統一回應格式（包含狀態轉換提示訊息）
    return ApiResponseBuilder.success(
      {
        task: formattedTask,
        message: result.message,
      },
      {}
    )
  })
}
