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
  ValidationException,
  NotFoundException,
} from '@/lib/api-response'
import { AddSubItemUseCase } from '@/application/use-cases/tasks/add-sub-item'

// ============================================================================
// PUT /api/tasks/[taskId]/sub-items - 重新排序 sub-items
// ============================================================================

/**
 * Request body:
 * {
 *   sub_item_ids: string[]
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  return catchDomainException(async () => {
    // 1. 認證
    const userId = await authenticateRequest(request, prisma)

    // 2. 解析參數
    const { taskId } = await params
    const body = await request.json() as any
    const { sub_item_ids } = body

    // 3. 驗證 sub_item_ids
    if (!Array.isArray(sub_item_ids)) {
      throw new ValidationException(
        'sub_item_ids must be an array', 'sub_item_ids'
      )
    }

    // TODO: 將此邏輯移至 ReorderSubItemsUseCase
    // 目前先保持原有邏輯
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        deleted_at: null,
        product: { user_id: userId },
      },
      include: { product: true },
    })

    if (!task) {
      throw new NotFoundException('Task')
    }

    const subItems = (task.sub_items as Array<{
      id: string
      content: string
      completed: boolean
      created_at: string
      completed_at: string | null
      order: number
    }>) || []

    const orderedSubItems = sub_item_ids
      .map((id) => subItems.find((item) => item.id === id))
      .filter(Boolean)
      .map((item, index) => ({
        ...item!,
        order: index,
      }))

    const completedCount = orderedSubItems.filter((item) => item.completed).length
    const total = orderedSubItems.length
    const completionRate = total > 0 ? completedCount / total : 0

    await prisma.task.update({
      where: { id: taskId },
      data: {
        sub_items: orderedSubItems,
        updated_at: new Date(),
      },
    })

    return ApiResponseBuilder.success(
      {
        subItems: orderedSubItems,
        meta: {
          total,
          completed: completedCount,
          completionRate,
        },
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
