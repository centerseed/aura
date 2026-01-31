/**
 * Task Reference [referenceId] API Routes - 使用 Clean Architecture
 *
 * Interface Layer: 處理單一任務參考資料的操作
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import {
  ApiResponseBuilder,
  catchDomainException,
} from '@/lib/api-response'
import { UpdateTaskReferenceUseCase } from '@/application/use-cases/tasks/update-task-reference'

// ============================================================================
// PATCH /api/tasks/[taskId]/references/[referenceId] - 更新 reference
// ============================================================================

/**
 * Request body:
 * {
 *   content?: string
 *   title?: string | null
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; referenceId: string }> }
) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析參數
    const { taskId, referenceId } = await params
    const body = await request.json() as any
    const { content, title } = body

    // 3. 執行 Use Case
    const useCase = new UpdateTaskReferenceUseCase()
    const result = await useCase.execute({
      taskId,
      userId,
      referenceId,
      content,
      title,
    })

    // 4. 統一回應格式
    return ApiResponseBuilder.success(
      {
        reference: result.reference,
        message: result.message,
      },
      {}
    )
  })
}
