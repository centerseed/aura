/**
 * Tasks [taskId] API Routes - 使用 Clean Architecture
 *
 * Interface Layer: 處理單一任務的 CRUD 操作
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import {
  ApiResponseBuilder,
  catchDomainException, ValidationException } from '@/lib/api-response'
import { safeToISOString, safeToISOStringRequired } from '@/lib/date-utils'
import { GetTaskByIdUseCase } from '@/application/use-cases/tasks/get-task-by-id'
import { DeleteTaskUseCase } from '@/application/use-cases/tasks/delete-task'
import { UpdateTaskUseCase } from '@/application/use-cases/tasks/update-task'

// ============================================================================
// GET /api/tasks/[taskId] - 取得單一任務詳情
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析參數
    const { taskId } = await params

    if (!taskId) {
      throw new ValidationException('taskId is required', 'taskId')
    }

    // 3. 執行 Use Case
    const useCase = new GetTaskByIdUseCase()
    const result = await useCase.execute({
      taskId,
      userId,
    })

    // 4. 格式化任務資料
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
      remind_at: safeToISOString(task.remindAt),
      reminder_enabled: task.reminderEnabled || false,
      reminder_timezone: task.reminderTimezone || null,
      notification_id: task.notificationId || null,
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

    // 5. 統一回應格式
    return ApiResponseBuilder.success({ task: formattedTask }, {})
  })
}

// ============================================================================
// PATCH /api/tasks/[taskId] - 更新任務
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析參數
    const { taskId } = await params

    if (!taskId) {
      throw new ValidationException('taskId is required', 'taskId')
    }

    // 3. 解析請求體
    const body = await request.json() as any
    const {
      status,
      product_id: productId,
      topic_id: topicId,
      content,
      narrative,
      start_date,
      due_date,
      time_confidence,
      inferred_from_milestone,
      remind_at,
      reminder_enabled,
      reminder_timezone,
      notification_id,
    } = body

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
      remindAt: remind_at,
      reminderEnabled: reminder_enabled,
      reminderTimezone: reminder_timezone,
      notificationId: notification_id,
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
      remind_at: safeToISOString(task.remindAt),
      reminder_enabled: task.reminderEnabled || false,
      reminder_timezone: task.reminderTimezone || null,
      notification_id: task.notificationId || null,
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

    // 6. 統一回應格式
    return ApiResponseBuilder.success({ task: formattedTask }, {})
  })
}

// ============================================================================
// DELETE /api/tasks/[taskId] - 軟刪除任務
// ============================================================================

/**
 * 軟刪除任務並將 references 遷移到 Product 層級
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析參數
    const { taskId } = await params

    if (!taskId) {
      throw new ValidationException('taskId is required', 'taskId')
    }

    // 3. 執行 Use Case
    const useCase = new DeleteTaskUseCase()
    const result = await useCase.execute({
      taskId,
      userId,
    })

    // 4. 統一回應格式
    return ApiResponseBuilder.success(
      {
        taskId: result.taskId,
        referencesMigrated: result.referencesMigrated,
        message: result.message,
      },
      {}
    )
  })
}
