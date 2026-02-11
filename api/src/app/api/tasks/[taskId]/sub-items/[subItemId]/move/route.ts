/**
 * Move Sub-Item API Route
 *
 * Interface Layer: 將 sub-item 移動到另一個 Task
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import {
  ApiResponseBuilder,
  catchDomainException,
} from '@/lib/api-response'
import { MoveSubItemUseCase } from '@/application/use-cases/tasks/move-sub-item'

// ============================================================================
// POST /api/tasks/[taskId]/sub-items/[subItemId]/move - 移動 sub-item 到另一個 Task
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
    const body = (await request.json()) as { target_task_id: string }
    const targetTaskId = body.target_task_id

    // 3. 執行 Use Case
    const useCase = new MoveSubItemUseCase()
    const result = await useCase.execute({
      sourceTaskId: taskId,
      targetTaskId,
      subItemId,
      userId,
    })

    // 4. 統一回應格式
    return ApiResponseBuilder.success(result, {})
  })
}
