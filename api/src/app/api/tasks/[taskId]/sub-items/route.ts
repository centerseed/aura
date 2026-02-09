/**
 * Task Sub-Items API Routes - 使用 Clean Architecture
 *
 * Interface Layer: 處理任務子項目的新增與排序操作
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import {
  ApiResponseBuilder,
  catchDomainException,
} from '@/lib/api-response'
import { AddSubItemUseCase } from '@/application/use-cases/tasks/add-sub-item'
import { ReorderSubItemsUseCase } from '@/application/use-cases/tasks/reorder-sub-items'

// ============================================================================
// PUT /api/tasks/[taskId]/sub-items - 重新排序 sub-items
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { taskId } = await params
    const body = await request.json() as any
    const { sub_item_ids } = body

    const useCase = new ReorderSubItemsUseCase()
    const result = await useCase.execute({
      taskId,
      userId,
      subItemIds: sub_item_ids,
    })

    return ApiResponseBuilder.success(
      {
        subItems: result.subItems,
        meta: result.meta,
      },
      {}
    )
  })
}

// ============================================================================
// POST /api/tasks/[taskId]/sub-items - 新增 sub-item
// ============================================================================

/**
 * Request body:
 * {
 *   content: string
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
    const { content } = body

    // 3. 執行 Use Case
    const useCase = new AddSubItemUseCase()
    const result = await useCase.execute({
      taskId,
      userId,
      content,
    })

    // 4. 統一回應格式
    return ApiResponseBuilder.success(
      {
        subItem: result.subItem,
        meta: result.meta,
        message: result.message,
      },
      {}
    )
  })
}
