/**
 * Task Merge API Route - 使用 Clean Architecture
 *
 * Interface Layer: 處理任務合併操作
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import {
  ApiResponseBuilder,
  catchDomainException,
} from '@/lib/api-response'
import { MergeTaskUseCase } from '@/application/use-cases/tasks/merge-task'

// ============================================================================
// POST /api/tasks/[taskId]/merge-into - 將此 Task 合併為另一個 Task 的 sub-item
// ============================================================================

/**
 * Request body:
 * {
 *   targetTaskId: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析參數
    const { taskId: sourceTaskId } = await params
    const body = await request.json() as any
    const { targetTaskId } = body

    // 3. 執行 Use Case
    const useCase = new MergeTaskUseCase()
    const result = await useCase.execute({
      sourceTaskId,
      targetTaskId,
      userId,
    })

    // 4. 統一回應格式
    return ApiResponseBuilder.success(
      {
        sourceTaskId: result.sourceTaskId,
        targetTaskId: result.targetTaskId,
        newSubItem: result.newSubItem,
        meta: result.meta,
        message: result.message,
      },
      {}
    )
  })
}
