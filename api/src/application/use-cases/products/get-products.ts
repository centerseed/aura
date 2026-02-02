/**
 * GetProductsUseCase - 獲取產品列表
 *
 * Application Layer Use Case
 * 處理獲取用戶所有產品的業務邏輯
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface GetProductsRequest {
  userId: string
}

export interface ProductData {
  id: string
  user_id: string
  area_id: string
  name: string
  description: string | null
  status: string
  lifecycle: string
  display_order: number
  created_at: Date
  updated_at: Date
  references: Array<{
    id: string
    type: 'url' | 'note'
    content: string
    title?: string | null
    created_at: string
  }>
  tasks: Array<{
    id: string
    user_id: string
    product_id: string
    topic_id: string | null
    content: string
    status: string
    due_date: string | null
    start_date: string | null
    time_confidence: number | null
    inferred_from_milestone: string | null
    ai_analysis: Record<string, unknown> | null
    tag: {
      area: string
      product: string
      topic: string
    }
    sub_items: Array<{
      id: string
      content: string
      completed: boolean
      created_at: string
      completed_at: string | null
      order: number
    }>
    references: Array<{
      id: string
      type: 'url' | 'note'
      content: string
      title?: string | null
      created_at: string
    }>
    created_at: string
    updated_at: string
  }>
  area?: {
    id: string
    name: string
    scope: string | null
    description: string | null
  }
}

export interface GetProductsResponse {
  products: ProductData[]
}

// ============================================================================
// Use Case
// ============================================================================

export class GetProductsUseCase {
  async execute(
    request: GetProductsRequest
  ): Promise<GetProductsResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 查詢所有未軟刪除的 Product,並做排序
    const productsRaw = await prisma.product.findMany({
      where: {
        user_id: request.userId,
        deleted_at: null,
      },
      include: {
        area: {
          select: {
            id: true,
            name: true,
            scope: true,
            description: true,
          },
        },
        tasks: {
          where: {
            deleted_at: null,
            status: { not: 'ARCHIVE' }, // 排除已歸檔的任務
          },
          include: {
            topic: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          // 返回所有 tasks (不限制數量)
        },
      },
      orderBy: [
        { display_order: 'asc' },
        { created_at: 'desc' },
      ],
    })

    // 3. 轉換格式，提取 references 和 tasks
    const products: ProductData[] = productsRaw.map((product) => {
      // 提取 product 層級的 references
      const productReferences = (product.references as Array<{
        id: string
        type: 'url' | 'note'
        content: string
        title?: string | null
        created_at: string
      }>) || []

      // 轉換 tasks 格式 (返回所有非歸檔任務)
      const tasks = product.tasks.map((task) => {
        // 提取 sub_items
        const subItems = (task.sub_items as Array<{
          id: string
          content: string
          completed: boolean
          created_at: string
          completed_at: string | null
          order: number
        }>) || []

        // 提取 task 層級的 references
        const taskReferences = (task.references as Array<{
          id: string
          type: 'url' | 'note'
          content: string
          title?: string | null
          created_at: string
        }>) || []

        return {
          id: task.id,
          user_id: task.user_id,
          product_id: task.product_id,
          topic_id: task.topic_id,
          content: task.content,
          status: task.status,
          due_date: task.due_date?.toISOString() || null,
          start_date: task.start_date?.toISOString() || null,
          time_confidence: task.time_confidence,
          inferred_from_milestone: task.inferred_from_milestone,
          ai_analysis: (task.ai_analysis as Record<string, unknown>) || null,
          tag: {
            area: product.area?.name || '',
            product: product.name,
            topic: (task.topic as { name: string } | null)?.name || '未分類',
          },
          sub_items: subItems,
          references: taskReferences,
          created_at: task.created_at.toISOString(),
          updated_at: task.updated_at.toISOString(),
        }
      })

      return {
        id: product.id,
        user_id: product.user_id,
        area_id: product.area_id,
        name: product.name,
        description: product.description,
        status: product.status,
        lifecycle: product.lifecycle,
        display_order: product.display_order,
        created_at: product.created_at,
        updated_at: product.updated_at,
        references: productReferences,
        tasks: tasks,
        area: product.area,
      }
    })

    return {
      products,
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: GetProductsRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }
  }
}
