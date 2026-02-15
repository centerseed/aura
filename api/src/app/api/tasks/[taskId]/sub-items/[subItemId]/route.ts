/**
 * Task Sub-Item [subItemId] API Routes - 使用 Clean Architecture
 *
 * Interface Layer: 處理單一任務子項目的操作
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import {
  ApiResponseBuilder,
  catchDomainException,
} from '@/lib/api-response'
import { UpdateSubItemUseCase } from '@/application/use-cases/tasks/update-sub-item'
import { DeleteSubItemUseCase } from '@/application/use-cases/tasks/delete-sub-item'
import { syncPlanOnTaskChange } from '@/application/services/plan-sync'

// ============================================================================
// PATCH /api/tasks/[taskId]/sub-items/[subItemId] - 更新 sub-item
// ============================================================================

/**
 * Request body:
 * {
 *   completed?: boolean
 *   content?: string
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; subItemId: string }> }
) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析參數
    const { taskId, subItemId } = await params
    const body = await request.json() as any
    const { completed, content, start_date, due_date } = body

    // 3. 執行 Use Case
    const useCase = new UpdateSubItemUseCase()
    const result = await useCase.execute({
      taskId,
      userId,
      subItemId,
      completed,
      content,
      startDate: start_date,
      dueDate: due_date,
    })

    // 4. 同步 Plan（fire-and-forget）
    if (due_date !== undefined) {
      syncPlanOnTaskChange({
        userId,
        taskId,
        subTaskId: subItemId,
        dueDate: due_date,
      }).catch(console.error)
    }

    // 5. 統一回應格式
    return ApiResponseBuilder.success(
      {
        subItem: result.subItem,
        meta: result.meta,
        taskCompleted: result.taskCompleted,
        message: result.message,
      },
      {}
    )
  })
}

// ============================================================================
// DELETE /api/tasks/[taskId]/sub-items/[subItemId] - 刪除 sub-item
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; subItemId: string }> }
) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析參數
    const { taskId, subItemId } = await params

    // 3. 執行 Use Case
    const useCase = new DeleteSubItemUseCase()
    const result = await useCase.execute({
      taskId,
      userId,
      subItemId,
    })

    // 4. 統一回應格式
    return ApiResponseBuilder.success(
      {
        subItemId: result.subItemId,
        meta: result.meta,
        message: result.message,
      },
      {}
    )
  })
}
