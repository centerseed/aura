/**
 * GetProductsUseCase - 獲取產品列表
 *
 * Application Layer Use Case
 * 處理獲取用戶所有產品的業務邏輯
 *
 * 🚀 優化：使用 raw SQL JOIN 取代 nested include，減少 DB round-trips
 */

import { prisma } from '@/lib/db'
import { ValidationException } from '@/lib/api-response'

// Raw SQL 查詢結果的型別
interface RawProductRow {
  product_id: string
  product_user_id: string
  product_area_id: string
  product_name: string
  product_description: string | null
  product_status: string
  product_lifecycle: string
  product_priority: string
  product_display_order: number
  product_references: unknown
  product_created_at: Date
  product_updated_at: Date
  area_id: string | null
  area_name: string | null
  area_scope: string | null
  area_description: string | null
  task_id: string | null
  task_user_id: string | null
  task_product_id: string | null
  task_topic_id: string | null
  task_content: string | null
  task_status: string | null
  task_due_date: Date | null
  task_start_date: Date | null
  task_time_confidence: number | null
  task_inferred_from_milestone: string | null
  task_ai_analysis: unknown
  task_references: unknown
  task_created_at: Date | null
  task_updated_at: Date | null
  topic_name: string | null
}

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
  priority: string
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
  total_reference_count: number // product 層級 + 所有 task 層級的 references 總數
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

    // 2. 🚀 單一 SQL 查詢：products JOIN areas JOIN tasks JOIN topics
    const rawRows = await prisma.$queryRaw<RawProductRow[]>`
      SELECT
        p.id::text as product_id,
        p.user_id::text as product_user_id,
        p.area_id::text as product_area_id,
        p.name as product_name,
        p.description as product_description,
        p.status::text as product_status,
        p.lifecycle::text as product_lifecycle,
        p.priority::text as product_priority,
        p.display_order as product_display_order,
        p.references as product_references,
        p.created_at as product_created_at,
        p.updated_at as product_updated_at,
        a.id::text as area_id,
        a.name as area_name,
        a.scope as area_scope,
        a.description as area_description,
        t.id::text as task_id,
        t.user_id::text as task_user_id,
        t.product_id::text as task_product_id,
        t.topic_id::text as task_topic_id,
        t.content as task_content,
        t.status::text as task_status,
        t.due_date as task_due_date,
        t.start_date as task_start_date,
        t.time_confidence as task_time_confidence,
        t.inferred_from_milestone as task_inferred_from_milestone,
        t.ai_analysis as task_ai_analysis,
        t.references as task_references,
        t.created_at as task_created_at,
        t.updated_at as task_updated_at,
        top.name as topic_name
      FROM products p
      LEFT JOIN areas a ON a.id = p.area_id
      LEFT JOIN tasks t ON t.product_id = p.id
        AND t.deleted_at IS NULL
        AND t.status != 'ARCHIVE'::"statusenum"
      LEFT JOIN topics top ON top.id = t.topic_id
      WHERE p.user_id = ${request.userId}::uuid AND p.deleted_at IS NULL
      ORDER BY
        CASE p.priority::text WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 1 END ASC,
        p.display_order ASC,
        p.created_at DESC,
        t.created_at DESC
    `

    // 3. 批次查詢 sub_tasks
    const taskIds = rawRows.map(r => r.task_id).filter((id): id is string => id !== null)
    const uniqueTaskIds = [...new Set(taskIds)]
    const subTasksByTaskId = new Map<string, Array<{ id: string; content: string; completed: boolean; created_at: string; completed_at: string | null; order: number }>>()

    if (uniqueTaskIds.length > 0) {
      const allSubTasks = await prisma.subTask.findMany({
        where: { task_id: { in: uniqueTaskIds }, deleted_at: null },
        orderBy: { order: 'asc' },
        select: { id: true, task_id: true, content: true, completed: true, created_at: true, completed_at: true, order: true },
      })
      for (const st of allSubTasks) {
        const list = subTasksByTaskId.get(st.task_id) || []
        list.push({
          id: st.id,
          content: st.content,
          completed: st.completed,
          created_at: st.created_at.toISOString(),
          completed_at: st.completed_at?.toISOString() ?? null,
          order: st.order,
        })
        subTasksByTaskId.set(st.task_id, list)
      }
    }

    // 4. 將扁平結果轉換為巢狀結構
    const products = this.transformToProductStructure(rawRows, subTasksByTaskId)

    return {
      products,
    }
  }

  /**
   * 將扁平的 SQL 結果轉換為 Product → Task 結構
   */
  private transformToProductStructure(rows: RawProductRow[], subTasksByTaskId: Map<string, Array<{ id: string; content: string; completed: boolean; created_at: string; completed_at: string | null; order: number }>>): ProductData[] {
    const productsMap = new Map<string, ProductData>()
    const taskIdsAdded = new Set<string>()

    for (const row of rows) {
      // 處理 Product
      if (!productsMap.has(row.product_id)) {
        const productReferences = (row.product_references as Array<{
          id: string
          type: 'url' | 'note'
          content: string
          title?: string | null
          created_at: string
        }>) || []

        productsMap.set(row.product_id, {
          id: row.product_id,
          user_id: row.product_user_id,
          area_id: row.product_area_id,
          name: row.product_name,
          description: row.product_description,
          status: row.product_status,
          lifecycle: row.product_lifecycle,
          priority: row.product_priority,
          display_order: row.product_display_order,
          created_at: row.product_created_at,
          updated_at: row.product_updated_at,
          references: productReferences,
          total_reference_count: productReferences.length, // 先計算 product refs
          tasks: [],
          area: row.area_id ? {
            id: row.area_id,
            name: row.area_name!,
            scope: row.area_scope,
            description: row.area_description,
          } : undefined,
        })
      }

      // 處理 Task
      if (row.task_id && !taskIdsAdded.has(row.task_id)) {
        taskIdsAdded.add(row.task_id)
        const product = productsMap.get(row.product_id)!
        const taskData = this.transformTask(row, product, subTasksByTaskId.get(row.task_id!) || [])
        product.tasks.push(taskData)

        // 累加 task references 到 total_reference_count
        product.total_reference_count += taskData.references.length
      }
    }

    return Array.from(productsMap.values())
  }

  /**
   * 轉換單一 Task 資料
   */
  private transformTask(row: RawProductRow, product: ProductData, subItems: Array<{ id: string; content: string; completed: boolean; created_at: string; completed_at: string | null; order: number }>): ProductData['tasks'][0] {
    // 提取 task 層級的 references
    const taskReferences = (row.task_references as Array<{
      id: string
      type: 'url' | 'note'
      content: string
      title?: string | null
      created_at: string
    }>) || []

    return {
      id: row.task_id!,
      user_id: row.task_user_id!,
      product_id: row.task_product_id!,
      topic_id: row.task_topic_id,
      content: row.task_content!,
      status: row.task_status!,
      due_date: row.task_due_date?.toISOString() || null,
      start_date: row.task_start_date?.toISOString() || null,
      time_confidence: row.task_time_confidence,
      inferred_from_milestone: row.task_inferred_from_milestone,
      ai_analysis: (row.task_ai_analysis as Record<string, unknown>) || null,
      tag: {
        area: product.area?.name || '',
        product: product.name,
        topic: row.topic_name || '未分類',
      },
      sub_items: subItems,
      references: taskReferences,
      created_at: row.task_created_at!.toISOString(),
      updated_at: row.task_updated_at!.toISOString(),
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
