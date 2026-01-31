/**
 * GetLibraryUseCase - 獲取用戶完整層級結構
 *
 * Application Layer Use Case
 * 獲取用戶的所有 Areas、Products 和 Tasks,並格式化為前端需要的結構
 */

import { prisma } from '@/lib/db'
import { Status } from '@prisma/client'
import { ValidationException } from '@/lib/api-response'

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface GetLibraryRequest {
  userId: string
  includeArchived?: boolean
}

export interface TaskData {
  id: string
  title: string
  narrative: string | null
  drawer: string
  lifecycle: string
  tag: {
    area: string
    product: string
    topic: string
  }
  strategy_used: string | null
  reasoning: string | null
  start_date: string | null
  due_date: string | null
  time_confidence: number | null
  inferred_from_milestone: string | null
  sub_items: Array<{
    id: string
    content: string
    completed: boolean
    created_at: string
    completed_at: string | null
    order: number
  }>
  sub_items_meta: {
    total: number
    completed: number
    completion_rate: number
  }
  references: Array<{
    id: string
    type: 'url' | 'note'
    content: string
    title?: string | null
    created_at: string
  }>
}

export interface ProductData {
  id: string
  name: string
  description: string | null
  status: string
  lifecycle: string
  referenceCount: number
  tasks: TaskData[]
}

export interface AreaData {
  id: string
  name: string
  description: string | null
  scope: string | null
  products: ProductData[]
}

export interface GetLibraryResponse {
  areas: AreaData[]
}

// ============================================================================
// Use Case
// ============================================================================

export class GetLibraryUseCase {
  async execute(request: GetLibraryRequest): Promise<GetLibraryResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 建立 task 查詢條件(預設排除 ARCHIVE)
    const taskWhereClause: { deleted_at: null; status?: { not: Status } } = {
      deleted_at: null,
    }
    if (!request.includeArchived) {
      taskWhereClause.status = { not: Status.ARCHIVE }
    }

    // 3. 獲取用戶的所有 Areas,包含 Products 和 Tasks
    const areas = await prisma.area.findMany({
      where: {
        user_id: request.userId,
        deleted_at: null,
      },
      include: {
        products: {
          where: { deleted_at: null },
          include: {
            tasks: {
              where: taskWhereClause,
              include: { topic: true },
              orderBy: { created_at: 'desc' },
            },
          },
          orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    })

    // 4. 轉換為前端格式
    const formattedAreas: AreaData[] = areas.map((area) => ({
      id: area.id,
      name: area.name,
      description: area.description,
      scope: area.scope,
      products: area.products.map((product) => {
        // 計算 product 層級的 references 數量
        const productRefs = (product.references as Array<unknown>) || []
        // 計算所有 task 層級的 references 數量
        const taskRefsCount = product.tasks.reduce((sum, task) => {
          const taskRefs = (task.references as Array<unknown>) || []
          return sum + taskRefs.length
        }, 0)
        const totalReferenceCount = productRefs.length + taskRefsCount

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          status: product.status,
          lifecycle: product.lifecycle,
          referenceCount: totalReferenceCount,
          tasks: product.tasks.map((task) => {
            const analysis = task.ai_analysis as Record<string, unknown> | null

            // 提取 sub_items
            const subItems = (task.sub_items as Array<{
              id: string
              content: string
              completed: boolean
              created_at: string
              completed_at: string | null
              order: number
            }>) || []

            const subItemsMeta =
              subItems.length > 0
                ? {
                    total: subItems.length,
                    completed: subItems.filter((item) => item.completed).length,
                    completion_rate:
                      subItems.filter((item) => item.completed).length /
                      subItems.length,
                  }
                : { total: 0, completed: 0, completion_rate: 0 }

            // 提取 references
            const references = (task.references as Array<{
              id: string
              type: 'url' | 'note'
              content: string
              title?: string | null
              created_at: string
            }>) || []

            return {
              id: task.id,
              title: task.content,
              narrative: (analysis?.narrative as string) || null,
              drawer: task.status,
              lifecycle: (analysis?.lifecycle as string) || 'embryo',
              tag: {
                area: area.name,
                product: product.name,
                topic: task.topic?.name || '未分類',
              },
              strategy_used: (analysis?.strategy_used as string) || null,
              reasoning: (analysis?.reasoning as string) || null,
              start_date: task.start_date?.toISOString() || null,
              due_date: task.due_date?.toISOString() || null,
              time_confidence: task.time_confidence || null,
              inferred_from_milestone: task.inferred_from_milestone || null,
              sub_items: subItems,
              sub_items_meta: subItemsMeta,
              references: references,
            }
          }),
        }
      }),
    }))

    return {
      areas: formattedAreas,
    }
  }

  /**
   * 驗證請求資料
   */
  private validateRequest(request: GetLibraryRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }
  }
}
