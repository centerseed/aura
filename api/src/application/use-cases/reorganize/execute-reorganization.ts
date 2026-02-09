/**
 * ExecuteReorganizationUseCase - 執行結構重組
 *
 * Application Layer Use Case
 * 執行合併操作、重新分類、清理空 Products/Areas
 */

import { prisma } from "@/lib/db"
import { Status, Lifecycle } from "@prisma/client"
import type { TaskInfo, ProductInfo } from "./analyze-structure"

// ============================================================================
// DTOs
// ============================================================================

export interface ExecuteReorganizationRequest {
  userId: string
  merges: Array<{
    reason: string
    target_area: string
    source_areas: string[]
    target_product: string
    source_products: string[]
  }>
  reclassifications: Array<{
    task_id: string
    task_title: string
    current_area: string
    current_product: string
    new_area: string
    new_product: string
    reason: string
  }>
  taskMap: Record<string, TaskInfo>
  areaCache: Map<string, { id: string; name: string }>
  productCache: Map<string, ProductInfo>
  productByNameCache: Map<string, Array<{ id: string; areaName: string; taskCount: number }>>
  selectedOperationIds: string[] | null
}

export interface ExecuteReorganizationResponse {
  operationLog: string[]
  changes: {
    merges: number
    reclassifications: number
    emptyProductsCleaned: number
    emptyAreasCleaned: number
  }
}

// ============================================================================
// Use Case
// ============================================================================

export class ExecuteReorganizationUseCase {
  async execute(
    request: ExecuteReorganizationRequest
  ): Promise<ExecuteReorganizationResponse> {
    const operationLog: string[] = []

    // 建立選擇集合
    let selectedOperationSet: Set<string> | null = null
    if (request.selectedOperationIds && Array.isArray(request.selectedOperationIds)) {
      selectedOperationSet = new Set(request.selectedOperationIds)
    }

    // 建立執行時的動態快取
    const execAreaCache = new Map<string, string>()
    const execProductCache = new Map<string, string>()

    request.areaCache.forEach((info, name) => {
      execAreaCache.set(name, info.id)
    })
    request.productCache.forEach((info, id) => {
      execProductCache.set(`${info.areaId}::${info.name}`, id)
    })

    // 輔助函數：獲取或創建 Area
    const getOrCreateArea = async (areaName: string): Promise<string> => {
      const cached = execAreaCache.get(areaName)
      if (cached) return cached

      const newArea = await prisma.area.create({
        data: {
          user_id: request.userId,
          name: areaName,
          is_custom: true,
          created_at: new Date(),
        },
      })
      execAreaCache.set(areaName, newArea.id)
      operationLog.push(`  ➕ 創建新 Area：${areaName}`)
      return newArea.id
    }

    // 輔助函數：獲取或創建 Product
    const getOrCreateProduct = async (areaId: string, areaName: string, productName: string): Promise<string> => {
      const cacheKey = `${areaId}::${productName}`
      const cached = execProductCache.get(cacheKey)
      if (cached) return cached

      const newProduct = await prisma.product.create({
        data: {
          user_id: request.userId,
          area_id: areaId,
          name: productName,
          status: Status.ACTIVE,
          lifecycle: Lifecycle.FINITE,
          created_at: new Date(),
        },
      })
      execProductCache.set(cacheKey, newProduct.id)
      operationLog.push(`  ➕ 創建新 Product：${areaName} / ${productName}`)
      return newProduct.id
    }

    // 執行合併操作
    let mergeCount = 0
    let opIdCounter = 0
    const productsToDelete: string[] = []

    for (const merge of request.merges) {
      operationLog.push(`🔀 合併操作：${merge.reason}`)

      const targetAreaId = await getOrCreateArea(merge.target_area)
      const targetProductId = await getOrCreateProduct(targetAreaId, merge.target_area, merge.target_product)

      for (const sourceProductName of merge.source_products) {
        const sourceProducts = request.productByNameCache.get(sourceProductName) || []

        for (const sourceProduct of sourceProducts) {
          const currentOpId = `merge-${opIdCounter++}`

          if (selectedOperationSet && !selectedOperationSet.has(currentOpId)) {
            continue
          }

          if (sourceProduct.id === targetProductId) continue

          const taskCount = sourceProduct.taskCount

          await prisma.task.updateMany({
            where: { product_id: sourceProduct.id, deleted_at: null },
            data: { product_id: targetProductId },
          })

          await prisma.topic.updateMany({
            where: { product_id: sourceProduct.id, deleted_at: null },
            data: { product_id: targetProductId },
          })

          operationLog.push(`  📦 合併「${sourceProductName}」→「${merge.target_product}」（${taskCount} 個任務）`)
          productsToDelete.push(sourceProduct.id)
          mergeCount++
        }
      }
    }

    // 批量軟刪除來源 Products
    if (productsToDelete.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: productsToDelete } },
        data: { deleted_at: new Date() },
      })
    }

    // 執行重新分類操作
    let reclassifyCount = 0
    for (const reclass of request.reclassifications) {
      const currentOpId = `reclass-${opIdCounter++}`

      if (selectedOperationSet && !selectedOperationSet.has(currentOpId)) {
        continue
      }

      const taskInfo = request.taskMap[reclass.task_id]
      if (!taskInfo) continue

      operationLog.push(`🏷️  重新分類：「${taskInfo.content}」`)
      operationLog.push(`  原本：${reclass.current_area} / ${reclass.current_product}`)
      operationLog.push(`  改為：${reclass.new_area} / ${reclass.new_product}`)
      operationLog.push(`  原因：${reclass.reason}`)

      const targetAreaId = await getOrCreateArea(reclass.new_area)
      const targetProductId = await getOrCreateProduct(targetAreaId, reclass.new_area, reclass.new_product)

      await prisma.task.update({
        where: { id: reclass.task_id },
        data: {
          product_id: targetProductId,
          ai_analysis: {
            ...(taskInfo.aiAnalysis || {}),
            reclassification_reason: reclass.reason,
            reclassified_at: new Date().toISOString(),
          },
        },
      })

      reclassifyCount++
    }

    // 清理空的 Products 和 Areas
    const emptyProducts = await prisma.product.findMany({
      where: {
        user_id: request.userId,
        deleted_at: null,
        tasks: { none: { deleted_at: null, status: { not: Status.ARCHIVE } } },
      },
      select: { id: true },
    })

    if (emptyProducts.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: emptyProducts.map(p => p.id) } },
        data: { deleted_at: new Date() },
      })
      operationLog.push(`🧹 清理空 Product：${emptyProducts.length} 個`)
    }

    const emptyAreas = await prisma.area.findMany({
      where: {
        user_id: request.userId,
        deleted_at: null,
        products: { none: { deleted_at: null } },
      },
      select: { id: true },
    })

    if (emptyAreas.length > 0) {
      await prisma.area.updateMany({
        where: { id: { in: emptyAreas.map(a => a.id) } },
        data: { deleted_at: new Date() },
      })
      operationLog.push(`🧹 清理空 Area：${emptyAreas.length} 個`)
    }

    return {
      operationLog,
      changes: {
        merges: mergeCount,
        reclassifications: reclassifyCount,
        emptyProductsCleaned: emptyProducts.length,
        emptyAreasCleaned: emptyAreas.length,
      },
    }
  }
}
