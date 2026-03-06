/**
 * ExecuteBrainDumpUseCase - 執行 Brain Dump 結果寫入
 *
 * Application Layer Use Case
 * 根據 AI 判斷執行 append_sub_item 或 create_new_tasks
 */

import { prisma } from "@/lib/db"
import { isValidUUID } from "@/domain/constants/validation"
import { ValidationException } from "@/lib/api-response"
import { ensureProductEmbedding, ensureTaskEmbedding } from "@/lib/embedding"
import { maybeRefreshBlueprint } from "@/lib/product-blueprint"
import type { StructureResult, StructuredItem, Milestone, ExistingArea } from "./generate-brain-dump-structure"

// ============================================================================
// Helper Functions
// ============================================================================

function calculateDueDate(
  item: StructuredItem,
  milestones: Milestone[],
  siblingItems: StructuredItem[]
): { dueDate: Date | null; inferredFromMilestone: string | null; timeConfidence: number | null } {

  // 層級 1: 用戶明確指定的日期
  if (item.due_date) {
    return {
      dueDate: new Date(item.due_date),
      inferredFromMilestone: null,
      timeConfidence: item.time_confidence ?? 1.0,
    }
  }

  // 層級 2: 從里程碑推斷（AI 回傳里程碑名稱或 UUID，兩者都支援）
  if (item.inferred_from_milestone) {
    const milestone = milestones.find(m =>
      m.name === item.inferred_from_milestone ||
      (isValidUUID(item.inferred_from_milestone) && m.id === item.inferred_from_milestone)
    )

    if (milestone?.target_date) {
      let daysBeforeMilestone = item.estimated_days_needed ?? getDefaultDays(item.task_type)

      if (item.depends_on_task) {
        const dependentItem = siblingItems.find(
          si => si.title === item.depends_on_task
        )
        if (dependentItem) {
          const dependentDays = dependentItem.estimated_days_needed ??
            getDefaultDays(dependentItem.task_type)
          daysBeforeMilestone += dependentDays
        }
      }

      if (item.sub_items && item.sub_items.length > 0) {
        daysBeforeMilestone += Math.ceil(item.sub_items.length * 0.5)
      }

      const now = new Date()
      const daysUntilMilestone = Math.ceil(
        (new Date(milestone.target_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysBeforeMilestone >= daysUntilMilestone) {
        daysBeforeMilestone = Math.max(1, daysUntilMilestone - 1)
      }

      const dueDate = new Date(milestone.target_date)
      dueDate.setDate(dueDate.getDate() - daysBeforeMilestone)

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)

      if (dueDate < tomorrow) {
        dueDate.setTime(tomorrow.getTime())
      }

      console.log(`📅 [calculateDueDate] Task: "${item.title}" -> ${daysBeforeMilestone} days before milestone "${milestone.name}" = ${dueDate.toISOString().split('T')[0]}`)

      return {
        dueDate,
        inferredFromMilestone: milestone.id,
        timeConfidence: item.time_confidence ?? 0.5,
      }
    }
  }

  // fallback: 嘗試用名稱查找 milestone ID
  const fallbackMilestone = item.inferred_from_milestone
    ? milestones.find(m =>
        m.name === item.inferred_from_milestone ||
        (isValidUUID(item.inferred_from_milestone) && m.id === item.inferred_from_milestone)
      )
    : null

  return {
    dueDate: null,
    inferredFromMilestone: fallbackMilestone?.id ?? null,
    timeConfidence: null,
  }
}

function getDefaultDays(taskType: string | undefined): number {
  switch (taskType) {
    case 'waiting': return 10
    case 'booking': return 6
    case 'preparation': return 4
    case 'execution': return 2
    default: return 3
  }
}

// ============================================================================
// DTOs
// ============================================================================

export interface ExecuteBrainDumpRequest {
  userId: string
  text: string
  inputType: "text" | "image" | "image_with_text"
  result: StructureResult
  milestones: Milestone[]
  existingAreas: ExistingArea[]
  imageUnderstandingResult: any | null
}

export interface ExecuteBrainDumpResponse {
  data: any
  timings: Record<string, number>
}

// ============================================================================
// Use Case
// ============================================================================

export class ExecuteBrainDumpUseCase {
  async execute(
    request: ExecuteBrainDumpRequest
  ): Promise<ExecuteBrainDumpResponse> {
    const timings: Record<string, number> = {}
    const startDbPersist = Date.now()

    // 情況 1: 追加 sub-item 到既有任務
    if (request.result.action === "append_sub_item") {
      const result = request.result

      // 防禦：sub_items 缺失時給出清楚錯誤（AI 偶爾漏填）
      if (!result.sub_items || result.sub_items.length === 0) {
        throw new ValidationException(
          "AI 返回 append_sub_item 但未提供 sub_items，請重新送出輸入",
          "sub_items"
        )
      }

      // 支援多個 target task（target_task_ids 陣列）
      const targetTaskIds = result.target_task_ids ?? []

      if (targetTaskIds.length === 0) {
        throw new ValidationException(
          "AI 返回 append_sub_item 但未提供 target_task_ids",
          "target_task_ids"
        )
      }

      const now = new Date()
      const appendedByTask: Array<{ task: { id: string; content: string; product: string }; sub_items: typeof result.sub_items }> = []

      for (const taskId of targetTaskIds) {
        const targetTask = await prisma.task.findFirst({
          where: {
            id: taskId,
            deleted_at: null,
            product: { user_id: request.userId },
          },
          include: { product: true },
        })

        if (!targetTask) {
          throw new ValidationException(
            `Target task ${taskId} not found`,
            "target_task_ids"
          )
        }

        // 取得目前最大 order
        const maxOrderResult = await prisma.subTask.aggregate({
          where: { task_id: taskId, deleted_at: null },
          _max: { order: true },
        })
        const startOrder = (maxOrderResult._max.order ?? -1) + 1

        const newSubItems = result.sub_items.map((sub, idx) => ({
          id: crypto.randomUUID(),
          content: sub.content,
          completed: false,
          created_at: now.toISOString(),
          completed_at: null,
          order: startOrder + idx,
        }))

        // 寫入 sub_tasks 表
        for (const subItem of newSubItems) {
          await prisma.subTask.create({
            data: {
              id: subItem.id,
              task_id: taskId,
              user_id: request.userId,
              content: subItem.content,
              completed: false,
              order: subItem.order,
              source: 'user',
            },
          })
        }

        appendedByTask.push({
          task: { id: targetTask.id, content: targetTask.content, product: targetTask.product.name },
          sub_items: newSubItems as any,
        })
      }

      await prisma.systemEvaluationLog.create({
        data: {
          user_id: request.userId,
          type: "BRAIN_DUMP",
          input_content: { text: request.text },
          output_content: {
            action: "append_sub_item",
            target_task_ids: targetTaskIds,
            sub_items: result.sub_items,
            reasoning: result.reasoning,
          },
          user_action: "APPLIED",
          metadata: {
            appended_sub_items_count: result.sub_items.length * targetTaskIds.length,
            target_task_count: targetTaskIds.length,
            input_type: request.inputType,
          },
        },
      })

      timings["db_persist"] = Date.now() - startDbPersist

      // 回傳：單一目標保持舊結構，多目標改為 appended_tasks 陣列
      const firstAppended = appendedByTask[0]
      return {
        data: {
          action: "append_sub_item",
          target_task: firstAppended.task,
          appended_tasks: appendedByTask,
          appended_sub_items: firstAppended.sub_items,
          reasoning: result.reasoning,
        },
        timings,
      }
    }

    // 情況 2: 創建新任務
    const result = request.result
    const areaCache = new Map<string, { id: string }>()
    const productCache = new Map<string, { id: string }>()
    const topicCache = new Map<string, { id: string }>()

    // 預先填充快取
    for (const area of request.existingAreas) {
      areaCache.set(area.name, { id: area.id })
      for (const product of area.products) {
        productCache.set(`${area.name}::${product.name}`, { id: product.id })
        for (const topic of product.topics) {
          topicCache.set(`${product.id}::${topic.name}`, { id: topic.id })
        }
      }
    }

    // 預先批次查詢：收集 cache miss 可能的 product 名稱，一次 findMany 取代 transaction 內 N 次 findFirst
    const allProductNames = [...new Set(result.items.map(i => i.tag.product))]
    const existingProductsByName = await prisma.product.findMany({
      where: { user_id: request.userId, name: { in: allProductNames }, deleted_at: null },
      select: { id: true, name: true },
    })
    const crossAreaProductMap = new Map(existingProductsByName.map(p => [p.name, p.id]))

    // 批次檢查重複任務
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const allTitles = result.items.map(item => item.title)
    const existingTasks = await prisma.task.findMany({
      where: {
        user_id: request.userId,
        content: { in: allTitles },
        deleted_at: null,
        created_at: { gte: twentyFourHoursAgo },
        status: { not: 'ARCHIVE' },
      },
      select: { content: true },
    })
    const existingTitleSet = new Set(existingTasks.map(t => t.content))

    // Transaction 批次處理
    const createdTasks = await prisma.$transaction(async (tx) => {
      const tasks: Array<{
        id: string
        title: string
        narrative: string
        drawer: string
        lifecycle: string
        tag: { area: string; product: string; topic: string }
        strategy_used: string
        reasoning: string
        due_date: string | null
        time_confidence: number | null
        due_date_source: any
        inferred_from_milestone: string | null
        task_type: string | null
        estimated_days_needed: number | null
        sub_items: Array<{ id: string; content: string }>
      }> = []

      for (const item of result.items) {
        if (existingTitleSet.has(item.title)) {
          console.warn(`⚠️ [brain-dump] Duplicate task detected, skipping: "${item.title}"`)
          continue
        }

        // 1. Area（禁止自動創建）
        let areaId: string
        const cachedArea = areaCache.get(item.tag.area)
        if (cachedArea) {
          areaId = cachedArea.id
        } else {
          const existingAreaNames = Array.from(areaCache.keys())
          const fuzzyMatch = existingAreaNames.find(
            name => name.toLowerCase() === item.tag.area.toLowerCase()
          )

          if (fuzzyMatch) {
            areaId = areaCache.get(fuzzyMatch)!.id
            console.log(`🔄 [brain-dump] Area fuzzy match: "${item.tag.area}" → "${fuzzyMatch}"`)
          } else {
            const availableAreas = existingAreaNames.join(", ") || "(無)"
            console.error(`🚨 [brain-dump] AI attempted to create non-existent Area: "${item.tag.area}". Available: ${availableAreas}`)
            throw new ValidationException(
              `Area "${item.tag.area}" 不存在。Brain Dump 不允許自動創建 Area，請先手動創建或選擇既有的 Area: [${availableAreas}]`,
              "tag.area"
            )
          }
        }

        // 2. Product
        let productId: string
        const productKey = `${item.tag.area}::${item.tag.product}`
        const cachedProduct = productCache.get(productKey)
        if (cachedProduct) {
          productId = cachedProduct.id
        } else {
          // Cross-area dedup: check pre-fetched map before creating
          const crossAreaId = crossAreaProductMap.get(item.tag.product)
          if (crossAreaId) {
            // Reuse existing product (possibly in a different area) — do not create duplicate
            productId = crossAreaId
            productCache.set(productKey, { id: crossAreaId })
            console.log(`🔄 [brain-dump] Reusing existing product "${item.tag.product}" (cross-area dedup, skipping create)`)
          } else {
            const product = await tx.product.create({
              data: {
                user_id: request.userId,
                area_id: areaId,
                name: item.tag.product,
                status: item.drawer as any,
                lifecycle: item.lifecycle as any,
              },
            })
            productId = product.id
            productCache.set(productKey, { id: product.id })
            // 非同步計算 embedding（不阻塞 transaction）
            ensureProductEmbedding(product.id, product.name, null).catch(err => {
              console.error(`❌ [embedding] Failed to compute embedding for new Product "${product.name}":`, err)
            })
          }
        }

        // 3. Topic
        let topicId: string | null = null
        if (item.tag.topic && item.tag.topic.trim() !== "") {
          const topicKey = `${productId}::${item.tag.topic}`
          const cachedTopic = topicCache.get(topicKey)
          if (cachedTopic) {
            topicId = cachedTopic.id
          } else {
            const topic = await tx.topic.create({
              data: {
                user_id: request.userId,
                product_id: productId,
                name: item.tag.topic,
              },
            })
            topicId = topic.id
            topicCache.set(topicKey, { id: topic.id })
          }
        }

        // 4. Task
        const aiAnalysis: any = {
          raw_input: request.text,
          narrative: item.narrative,
          lifecycle: item.lifecycle,
          strategy_used: item.strategy_used,
          reasoning: item.reasoning,
          ...(request.imageUnderstandingResult && {
            source_type: "extracted_from_image",
            image_type: request.imageUnderstandingResult.image_type,
            image_confidence: request.imageUnderstandingResult.confidence,
          }),
        }

        if (item.due_date_source) {
          aiAnalysis.due_date_source = item.due_date_source
        }

        // 準備 sub_items 資料（先暫存，建 Task 後再寫入 sub_tasks 表）
        const pendingSubItems: Array<{ id: string; content: string; order: number }> = []
        if (item.sub_items && item.sub_items.length > 0) {
          for (let idx = 0; idx < item.sub_items.length; idx++) {
            pendingSubItems.push({
              id: crypto.randomUUID(),
              content: item.sub_items[idx].content,
              order: idx,
            })
          }
        }

        const { dueDate, inferredFromMilestone, timeConfidence } = calculateDueDate(
          item,
          request.milestones,
          result.items
        )

        // 建立 Task
        const task = await tx.task.create({
          data: {
            user_id: request.userId,
            product_id: productId,
            topic_id: topicId,
            content: item.title,
            status: item.drawer as any,
            due_date: dueDate,
            inferred_from_milestone: inferredFromMilestone,
            time_confidence: timeConfidence,
            sub_items: [] as any,
            ai_analysis: aiAnalysis,
          },
        })

        // 寫入 sub_tasks 表
        for (const subItem of pendingSubItems) {
          await tx.subTask.create({
            data: {
              id: subItem.id,
              task_id: task.id,
              user_id: request.userId,
              content: subItem.content,
              completed: false,
              order: subItem.order,
              source: 'user',
            },
          })
        }

        const formattedDueDate = dueDate ? dueDate.toISOString() : null

        tasks.push({
          id: task.id,
          title: item.title,
          narrative: item.narrative,
          drawer: item.drawer,
          lifecycle: item.lifecycle,
          tag: {
            area: item.tag.area,
            product: item.tag.product,
            topic: item.tag.topic,
          },
          strategy_used: item.strategy_used,
          reasoning: item.reasoning,
          due_date: formattedDueDate,
          time_confidence: timeConfidence,
          due_date_source: item.due_date_source || null,
          inferred_from_milestone: inferredFromMilestone,
          task_type: item.task_type || null,
          estimated_days_needed: item.estimated_days_needed || null,
          sub_items: pendingSubItems.map(s => ({ id: s.id, content: s.content })),
        })
      }

      // 記錄評估 Log
      await tx.systemEvaluationLog.create({
        data: {
          user_id: request.userId,
          type: "BRAIN_DUMP",
          input_content: { text: request.text },
          output_content: { action: "create_new_tasks", items: result.items },
          user_action: "APPLIED",
          metadata: {
            created_tasks_count: tasks.length,
            input_type: request.inputType,
            ...(request.imageUnderstandingResult && {
              image_type: request.imageUnderstandingResult.image_type,
              image_confidence: request.imageUnderstandingResult.confidence,
              extracted_items_count: request.imageUnderstandingResult.extracted_items.length,
            }),
          },
        },
      })

      return tasks
    }, { timeout: 60000 })

    timings["db_persist"] = Date.now() - startDbPersist

    // Fire-and-forget: task embeddings + blueprint updates
    const affectedProductIds = new Set<string>()
    for (const task of createdTasks) {
      // Task embedding
      ensureTaskEmbedding(task.id, task.title).catch(err => {
        console.error(`❌ [embedding] Failed to embed task "${task.title}":`, err)
      })
      // Collect affected product IDs for blueprint refresh
      const productKey = `${task.tag.area}::${task.tag.product}`
      const cached = productCache.get(productKey)
      if (cached) affectedProductIds.add(cached.id)
    }

    // Blueprint refresh for affected products
    for (const productId of affectedProductIds) {
      maybeRefreshBlueprint(productId).catch(err => {
        console.error(`❌ [blueprint] Failed to refresh blueprint for ${productId}:`, err)
      })
    }

    return {
      data: {
        action: "create_new_tasks",
        items: createdTasks,
      },
      timings,
    }
  }
}
