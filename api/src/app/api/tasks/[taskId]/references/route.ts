/**
 * Task References API Routes - 使用 Clean Architecture
 *
 * Interface Layer: 處理任務參考資料的 CRUD 操作
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import {
  ApiResponseBuilder,
  catchDomainException, ValidationException } from '@/lib/api-response'
import { AddTaskReferenceUseCase } from '@/application/use-cases/tasks/add-task-reference'
import { DeleteTaskReferenceUseCase } from '@/application/use-cases/tasks/delete-task-reference'

// ============================================================================
// POST /api/tasks/[taskId]/references - 新增 reference
// ============================================================================

/**
 * Request body:
 * {
 *   type: "url" | "note" (required)
 *   content: string (required)
 *   title?: string | null
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
    const { taskId } = await params
    const body = await request.json() as any
    const { type, content, title } = body

    // 3. 基礎驗證
    if (!type) {
      throw new ValidationException('type is required', 'type')
    }

    if (!content) {
      throw new ValidationException('content is required', 'content')
    }

    // 4. 執行 Use Case
    const useCase = new AddTaskReferenceUseCase()
    const result = await useCase.execute({
      taskId,
      userId,
      type,
      content,
      title,
    })

    // 5. 統一回應格式
    return ApiResponseBuilder.success(
      {
        reference: result.reference,
        total: result.total,
        message: result.message,
      },
      {}
    )
  })
}

// ============================================================================
// DELETE /api/tasks/[taskId]/references?referenceId=xxx - 刪除 reference
// ============================================================================

/**
 * Query params:
 * - referenceId: string (required)
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
    const { searchParams } = new URL(request.url)
    const referenceId = searchParams.get('referenceId')

    // 3. 基礎驗證
    if (!referenceId) {
      throw new ValidationException(
        'referenceId query parameter is required',
        'referenceId'
      )
    }

    // 4. 執行 Use Case
    const useCase = new DeleteTaskReferenceUseCase()
    const result = await useCase.execute({
      taskId,
      userId,
      referenceId,
    })

    // 5. 統一回應格式
    return ApiResponseBuilder.success(
      {
        referenceId: result.referenceId,
        total: result.total,
        message: result.message,
      },
      {}
    )
  })
}
