/**
 * GetLibraryUseCase - 獲取用戶完整層級結構
 *
 * Application Layer Use Case
 * 獲取用戶的所有 Areas、Products 和 Tasks,並格式化為前端需要的結構
 *
 * 🚀 優化：使用 raw SQL JOIN 取代 3 層 nested include，減少 DB round-trips
 */

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
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
    start_date: string | null
    due_date: string | null
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

// Raw SQL 查詢結果的型別
interface RawLibraryRow {
  area_id: string
  area_name: string
  area_description: string | null
  area_scope: string | null
  product_id: string | null
  product_name: string | null
  product_description: string | null
  product_status: string | null
  product_lifecycle: string | null
  product_references: unknown
  product_display_order: number | null
  task_id: string | null
  task_content: string | null
  task_status: string | null
  task_ai_analysis: unknown
  task_sub_items: unknown
  task_references: unknown
  task_start_date: Date | null
  task_due_date: Date | null
  task_time_confidence: number | null
  task_inferred_from_milestone: string | null
  task_created_at: Date | null
  topic_name: string | null
}

export class GetLibraryUseCase {
  async execute(request: GetLibraryRequest): Promise<GetLibraryResponse> {
    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 🚀 單一 SQL 查詢：areas JOIN products JOIN tasks JOIN topics
    const rawRows = await prisma.$queryRaw<RawLibraryRow[]>`
      SELECT
        a.id::text as area_id,
        a.name as area_name,
        a.description as area_description,
        a.scope as area_scope,
        p.id::text as product_id,
        p.name as product_name,
        p.description as product_description,
        p.status::text as product_status,
        p.lifecycle::text as product_lifecycle,
        p.references as product_references,
        p.display_order as product_display_order,
        t.id::text as task_id,
        t.content as task_content,
        t.status::text as task_status,
        t.ai_analysis as task_ai_analysis,
        t.sub_items as task_sub_items,
        t.references as task_references,
        t.start_date as task_start_date,
        t.due_date as task_due_date,
        t.time_confidence as task_time_confidence,
        t.inferred_from_milestone as task_inferred_from_milestone,
        t.created_at as task_created_at,
        top.name as topic_name
      FROM areas a
      LEFT JOIN products p ON p.area_id = a.id AND p.deleted_at IS NULL
      LEFT JOIN tasks t ON t.product_id = p.id AND t.deleted_at IS NULL
        ${request.includeArchived ? Prisma.empty : Prisma.sql`AND t.status != 'ARCHIVE'::"statusenum"`}
      LEFT JOIN topics top ON top.id = t.topic_id
      WHERE a.user_id = ${request.userId}::uuid AND a.deleted_at IS NULL
      ORDER BY a.name, p.display_order, p.name, t.created_at DESC
    `

    // 3. 將扁平結果轉換為巢狀結構
    const formattedAreas = this.transformToNestedStructure(rawRows)

    return {
      areas: formattedAreas,
    }
  }

  /**
   * 將扁平的 SQL 結果轉換為巢狀的 Area → Product → Task 結構
   */
  private transformToNestedStructure(rows: RawLibraryRow[]): AreaData[] {
    const areasMap = new Map<string, AreaData>()
    const productsMap = new Map<string, ProductData>()
    const taskIdsAdded = new Set<string>()

    for (const row of rows) {
      // 處理 Area
      if (!areasMap.has(row.area_id)) {
        areasMap.set(row.area_id, {
          id: row.area_id,
          name: row.area_name,
          description: row.area_description,
          scope: row.area_scope,
          products: [],
        })
      }
      const area = areasMap.get(row.area_id)!

      // 處理 Product
      if (row.product_id && !productsMap.has(row.product_id)) {
        const productRefs = (row.product_references as Array<unknown>) || []
        const product: ProductData = {
          id: row.product_id,
          name: row.product_name!,
          description: row.product_description,
          status: row.product_status!,
          lifecycle: row.product_lifecycle!,
          referenceCount: productRefs.length, // 先計算 product refs，後面加 task refs
          tasks: [],
        }
        productsMap.set(row.product_id, product)
        area.products.push(product)
      }

      // 處理 Task
      if (row.task_id && row.product_id && !taskIdsAdded.has(row.task_id)) {
        taskIdsAdded.add(row.task_id)
        const product = productsMap.get(row.product_id)!
        const taskData = this.transformTask(row)
        product.tasks.push(taskData)

        // 累加 task references 到 product 的 referenceCount
        product.referenceCount += taskData.references.length
      }
    }

    return Array.from(areasMap.values())
  }

  /**
   * 轉換單一 Task 資料
   */
  private transformTask(row: RawLibraryRow): TaskData {
    const analysis = row.task_ai_analysis as Record<string, unknown> | null

    // 提取並清理 sub_items
    const rawSubItems = (row.task_sub_items as Array<any>) || []
    const subItems = rawSubItems
      .filter((item) => item != null && item.id && item.content)
      .map((item) => ({
        id: item.id,
        content: item.content,
        completed: Boolean(item.completed),
        created_at: item.created_at || new Date().toISOString(),
        completed_at: item.completed_at || null,
        order: Number(item.order) || 0,
        start_date: item.start_date || null,
        due_date: item.due_date || null,
      }))

    const subItemsMeta =
      subItems.length > 0
        ? {
            total: subItems.length,
            completed: subItems.filter((item) => item.completed).length,
            completion_rate:
              subItems.filter((item) => item.completed).length / subItems.length,
          }
        : { total: 0, completed: 0, completion_rate: 0 }

    // 提取並清理 references
    const rawReferences = (row.task_references as Array<any>) || []
    const references = rawReferences
      .filter((ref) => ref != null && ref.id && ref.type && ref.content)
      .map((ref) => ({
        id: ref.id,
        type: ref.type as 'url' | 'note',
        content: ref.content,
        title: ref.title || null,
        created_at: ref.created_at || new Date().toISOString(),
      }))

    return {
      id: row.task_id!,
      title: row.task_content!,
      narrative: (analysis?.narrative as string) || null,
      drawer: row.task_status!,
      lifecycle: (analysis?.lifecycle as string) || 'embryo',
      tag: {
        area: row.area_name,
        product: row.product_name!,
        topic: row.topic_name || '未分類',
      },
      strategy_used: (analysis?.strategy_used as string) || null,
      reasoning: (analysis?.reasoning as string) || null,
      start_date: row.task_start_date?.toISOString() || null,
      due_date: row.task_due_date?.toISOString() || null,
      time_confidence: row.task_time_confidence || null,
      inferred_from_milestone: row.task_inferred_from_milestone || null,
      sub_items: subItems,
      sub_items_meta: subItemsMeta,
      references: references,
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
