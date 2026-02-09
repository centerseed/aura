/**
 * ExecuteAdjustmentUseCase - 執行標籤調整操作
 *
 * Application Layer Use Case
 * 執行 move_tasks 或 change_topic 操作、Topic 快取管理、Librarian 通知
 */

import { prisma } from "@/lib/db"
import { librarianObserve } from "@/lib/librarian-client"
import { Status, Lifecycle } from "@prisma/client"
import type { TaskInfo } from "./analyze-adjustment-intent"

// ============================================================================
// DTOs
// ============================================================================

export interface ExecuteAdjustmentRequest {
  userId: string
  intentType: "move_tasks" | "change_topic"
  taskMatches: Array<{
    task_id: string
    task_title: string
    current_location: string
    match_reason: string
  }>
  targetArea?: string
  targetProduct?: string
  targetTopic?: string
  taskMap: Record<string, TaskInfo>
  logId: string | null
}

export interface ExecuteAdjustmentResponse {
  operationLog: string[]
  movedCount: number
  timings: Record<string, number>
}

// ============================================================================
// Use Case
// ============================================================================

export class ExecuteAdjustmentUseCase {
  async execute(
    request: ExecuteAdjustmentRequest
  ): Promise<ExecuteAdjustmentResponse> {
    const timings: Record<string, number> = {}
    const operationLog: string[] = []
    let movedCount = 0
    const startExecution = Date.now()

    // 執行移動操作
    if (request.intentType === "move_tasks" && request.targetProduct) {
      // 找到目標 Area
      let targetArea = await prisma.area.findFirst({
        where: { user_id: request.userId, name: request.targetArea, deleted_at: null },
      })

      if (!targetArea && request.targetArea) {
        targetArea = await prisma.area.create({
          data: {
            user_id: request.userId,
            name: request.targetArea,
            is_custom: true,
          },
        })
        operationLog.push(`➕ 創建新 Area：${request.targetArea}`)
      }

      // 找到目標 Product
      let targetProduct = await prisma.product.findFirst({
        where: {
          user_id: request.userId,
          name: request.targetProduct,
          deleted_at: null,
          ...(targetArea ? { area_id: targetArea.id } : {}),
        },
      })

      if (!targetProduct && targetArea) {
        targetProduct = await prisma.product.create({
          data: {
            user_id: request.userId,
            area_id: targetArea.id,
            name: request.targetProduct,
            status: Status.ACTIVE,
            lifecycle: Lifecycle.FINITE,
          },
        })
        operationLog.push(`➕ 創建新 Product：${request.targetProduct}`)
      }

      if (!targetProduct) {
        // Return early with error info in operation log
        operationLog.push(`❌ 找不到目標專案「${request.targetProduct}」`)
        return { operationLog, movedCount, timings }
      }

      for (const match of request.taskMatches) {
        const taskInfo = request.taskMap[match.task_id]
        if (!taskInfo) continue

        await prisma.task.update({
          where: { id: match.task_id },
          data: {
            product_id: targetProduct.id,
            ai_analysis: {
              ...(taskInfo.aiAnalysis || {}),
              manual_adjustment: `移到 ${request.targetArea || ""} / ${request.targetProduct}`,
              adjusted_at: new Date().toISOString(),
            },
          },
        })

        operationLog.push(
          `✅ 移動「${taskInfo.content}」\n   從 ${taskInfo.areaName} / ${taskInfo.productName} → ${request.targetArea || taskInfo.areaName} / ${request.targetProduct}`
        )
        movedCount++

        librarianObserve({
          userId: request.userId,
          taskContent: taskInfo.content,
          originalProduct: taskInfo.productName,
          correctedProduct: request.targetProduct!,
        }).catch(() => {})
      }
    }

    // 執行 Topic 變更操作
    if (request.intentType === "change_topic" && request.targetTopic) {
      const topicCache = new Map<string, string | null>()

      for (const match of request.taskMatches) {
        const taskInfo = request.taskMap[match.task_id]
        if (!taskInfo) continue

        const cacheKey = `${taskInfo.productId}::${request.targetTopic}`
        let targetTopicId: string | null = null

        if (topicCache.has(cacheKey)) {
          targetTopicId = topicCache.get(cacheKey) ?? null
        } else {
          let targetTopic = await prisma.topic.findFirst({
            where: {
              user_id: request.userId,
              product_id: taskInfo.productId,
              name: request.targetTopic,
              deleted_at: null,
            },
          })

          if (!targetTopic && request.targetTopic.trim() !== "") {
            targetTopic = await prisma.topic.create({
              data: {
                user_id: request.userId,
                product_id: taskInfo.productId,
                name: request.targetTopic,
                created_at: new Date(),
              },
            })
            operationLog.push(`➕ 創建新 Topic：${request.targetTopic}`)
          }

          targetTopicId = targetTopic?.id ?? null
          topicCache.set(cacheKey, targetTopicId)
        }

        await prisma.task.update({
          where: { id: match.task_id },
          data: {
            topic_id: targetTopicId,
            ai_analysis: {
              ...(taskInfo.aiAnalysis || {}),
              manual_topic_change: request.targetTopic,
              topic_changed_at: new Date().toISOString(),
            },
          },
        })

        operationLog.push(
          `🏷️  更改「${taskInfo.content}」的 Topic\n   從 ${taskInfo.topicName || "(無)"} → ${request.targetTopic}`
        )
        movedCount++

        librarianObserve({
          userId: request.userId,
          taskContent: taskInfo.content,
          originalProduct: taskInfo.productName,
          correctedProduct: taskInfo.productName,
          originalTopic: taskInfo.topicName,
          correctedTopic: request.targetTopic,
        }).catch(() => {})
      }
    }

    // 更新評估 Log 狀態為 APPLIED
    if (request.logId) {
      await prisma.systemEvaluationLog.update({
        where: { id: request.logId },
        data: {
          user_action: "APPLIED",
          metadata: {
            operations: operationLog,
            moved_count: movedCount,
          },
        },
      })
    }

    timings["db_execution"] = Date.now() - startExecution
    return { operationLog, movedCount, timings }
  }
}
