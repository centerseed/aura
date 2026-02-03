/**
 * Promote Sub-Item API Route - 使用 Clean Architecture
 *
 * Interface Layer: 處理將 sub-item 升級為獨立 Task 的操作
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import {
  ApiResponseBuilder,
  catchDomainException,
} from '@/lib/api-response'
import { PromoteSubItemUseCase } from '@/application/use-cases/tasks/promote-sub-item'

// ============================================================================
// POST /api/tasks/[taskId]/sub-items/[subItemId]/promote - 升級 sub-item 為 Task
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; subItemId: string }> }
) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析參數
    const { taskId, subItemId } = await params

    // 3. 執行 Use Case
    const useCase = new PromoteSubItemUseCase()
    const result = await useCase.execute({
      taskId,
      userId,
      subItemId,
    })

    // 4. 統一回應格式
    return ApiResponseBuilder.success(
      {
        newTask: result.newTask,
        parentTaskId: result.parentTaskId,
        removedSubItemId: result.removedSubItemId,
        meta: result.meta,
        message: result.message,
      },
      {}
    )
  })
}
