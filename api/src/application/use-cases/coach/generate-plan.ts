/**
 * GeneratePlanUseCase - 生成每日計畫
 *
 * 候選篩選 → AI 排序 → 儲存 daily_plans + daily_plan_items
 */

import type {
  IDailyPlanRepository,
  DailyPlanData,
  CreateDailyPlanData,
  PlanItemStatus,
} from '@/domain/interfaces/daily-plan-repository'
import type { IDataCollector, UnifiedRawData } from '@/domain/interfaces/data-collector'
import type { IDataTransformer } from '@/domain/interfaces/data-transformer'
import type { PlanCandidate } from '@/domain/entities/plan-candidate.entity'
import { PrismaDailyPlanRepository } from '@/infrastructure/repositories/prisma-daily-plan-repository'
import { UnifiedDataCollector } from '@/infrastructure/services/unified-data-collector'
import { UnifiedDataTransformer } from '@/infrastructure/services/unified-data-transformer'
import { CoachPlanGenerator, type DailyPlanOutput } from '@/application/services/coach-plan-generator'
import { CoachCalibration } from '@/application/services/coach-calibration'
import { ValidationException } from '@/lib/api-response'
import type { AiTokenUsage } from '@/lib/ai-rate-limit'
import { prisma } from '@/lib/db'
import { resolveTimezone, toDateOnly } from '@/lib/timezone-utils'

// ============================================================================
// DTOs
// ============================================================================

export interface GeneratePlanRequest {
  userId: string
  date?: string
  timezone?: string
  rawData?: UnifiedRawData // 可選：如果 briefing 已收集，可共用避免重複查詢
}

export interface GeneratePlanResponse {
  plan: DailyPlanData
  timings: Record<string, number>
  usage?: AiTokenUsage
}

// ============================================================================
// Use Case
// ============================================================================

export class GeneratePlanUseCase {
  constructor(
    private readonly repository: IDailyPlanRepository = new PrismaDailyPlanRepository(),
    private readonly collector: IDataCollector = new UnifiedDataCollector(),
    private readonly transformer: IDataTransformer = new UnifiedDataTransformer(),
    private readonly planGenerator: CoachPlanGenerator = new CoachPlanGenerator(),
    private readonly calibration: CoachCalibration = new CoachCalibration(),
  ) {}

  async execute(request: GeneratePlanRequest): Promise<GeneratePlanResponse> {
    const timings: Record<string, number> = {}
    let start: number

    // 1. 驗證
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    // 2. 解析時區與日期
    const timezone = await resolveTimezone(request.userId, request.timezone)
    const planDate = request.date ? new Date(request.date) : new Date()
    const planDateOnly = toDateOnly(planDate, timezone)

    // 3. 收集候選（如果 briefing 已收集，共用資料）
    let rawData: UnifiedRawData
    if (request.rawData) {
      rawData = request.rawData
      timings.collect = 0 // 共用，不計時
    } else {
      start = Date.now()
      rawData = await this.collector.collect(request.userId, planDate, timezone)
      timings.collect = Date.now() - start
    }

    // 4. 轉換成 plan 格式
    start = Date.now()
    const collected = this.transformer.toPlanCollectedData(rawData, planDate, timezone)
    timings.transform = Date.now() - start

    // 5. 取得校準資訊（非阻塞）
    let calibrationNote: string | undefined
    try {
      const note = await this.calibration.getCalibrationNote(request.userId)
      calibrationNote = note ?? undefined
    } catch (err) {
      console.warn('[GeneratePlan] Calibration failed (non-blocking):', err)
    }

    // 6. AI 排序
    start = Date.now()
    const { output: aiResult, prompt: aiPrompt, usage: aiUsage } = await this.planGenerator.generate(
      collected.candidates,
      collected.availableMinutes,
      collected.meetingMinutes,
      calibrationNote,
      collected.unscheduledTasks,
      collected.milestones,
      collected.weeklyOverview,
      planDate,
      timezone,
    )
    timings.ai = Date.now() - start
    console.log('[GeneratePlan] Prompt length:', aiPrompt.length, 'chars')
    console.log('[GeneratePlan] Prompt:\n', aiPrompt)
    console.log('[GeneratePlan] AI result: daily_plan=%d items, overflow=%d items',
      aiResult.daily_plan.length, aiResult.overflow_items.length)

    // 7. 映射 AI 結果 + 容量硬截斷
    const candidateMap = new Map(
      collected.candidates.map(c => [c.subTaskId || c.taskId, c])
    )

    const plannedItems: Array<{
      taskId: string; subTaskId: string | null; content: string;
      areaName: string; productName: string; estimatedMinutes: number | null;
      dueDate: Date | null; order: number; reasoning: string;
      status: PlanItemStatus;
    }> = []
    let accumulatedMinutes = 0

    const seenItemIds = new Set<string>()
    const capacityCutoffItems: Array<{ candidate: typeof collected.candidates[0]; estimatedMinutes: number; reasoning: string }> = []
    for (const item of aiResult.daily_plan) {
      // AI 偶爾回傳重複的 item_id，跳過
      if (seenItemIds.has(item.item_id)) continue
      seenItemIds.add(item.item_id)

      const candidate = candidateMap.get(item.item_id)
      if (!candidate) continue

      const estimatedMinutes = item.estimated_minutes ?? candidate.estimatedMinutes ?? 60
      // 安全網：超過 availableMinutes 就放入 overflow（讓 AI 根據週表自行控制 3-5 項）
      // 但 due today / overdue 項目強制納入，避免用戶忽略而逾期
      const todayEnd = new Date(planDate)
      todayEnd.setHours(23, 59, 59, 999)
      const isDueTodayOrOverdue = candidate.dueDate && candidate.dueDate <= todayEnd

      if (accumulatedMinutes + estimatedMinutes > collected.availableMinutes && plannedItems.length > 0) {
        if (!isDueTodayOrOverdue) {
          console.log('[GeneratePlan] Capacity cutoff at item %d (%s), accumulated=%dmin, available=%dmin',
            item.order, candidate.content.substring(0, 20), accumulatedMinutes, collected.availableMinutes)
          capacityCutoffItems.push({ candidate, estimatedMinutes, reasoning: item.reasoning })
          continue
        }
        console.log('[GeneratePlan] Force-including due/overdue item: %s (due: %s)',
          candidate.content.substring(0, 30), candidate.dueDate?.toISOString())
      }
      accumulatedMinutes += estimatedMinutes

      // AI 已決定這個項目排入 daily_plan，一律設 'today'
      const itemStatus: PlanItemStatus = 'today'

      plannedItems.push({
        taskId: candidate.taskId,
        subTaskId: candidate.subTaskId,
        content: candidate.content,
        areaName: candidate.areaName,
        productName: candidate.productName,
        estimatedMinutes,
        dueDate: candidate.dueDate,
        order: plannedItems.length + 1,
        reasoning: item.reasoning,
        status: itemStatus,
      })
    }

    // 6b. 回寫 AI 估時到原始 Task/SubTask（僅首次估時，不覆蓋用戶手動值）
    await this.writeBackEstimates(aiResult, candidateMap)

    // 6c. 回寫 AI 建議日期到待排程任務
    if (aiResult.scheduling && aiResult.scheduling.length > 0) {
      const scheduledCount = await this.writeBackSuggestedDates(aiResult.scheduling)
      console.log('[GeneratePlan] Wrote back suggested dates for %d tasks', scheduledCount)
    }

    const plannedMinutes = accumulatedMinutes

    // 6d. 建構 overflow items 為 DailyPlanItem rows（不再用 JSONB）
    // 合併 AI 回傳的 overflow + 被容量截斷的項目
    // 先收集 plannedItems 的 key set，用於去重
    const plannedTaskKeys = new Set(
      plannedItems.map(i => `${i.taskId}:${i.subTaskId || ''}`)
    )
    const aiOverflowRows = (aiResult.overflow_items || [])
      .filter((oi) => {
        const candidate = candidateMap.get(oi.item_id)
        if (!candidate) return false
        return !plannedTaskKeys.has(`${candidate.taskId}:${candidate.subTaskId || ''}`)
      })
      .map((oi) => {
      const candidate = candidateMap.get(oi.item_id)
      return {
        taskId: candidate?.taskId ?? '',
        subTaskId: candidate?.subTaskId ?? null,
        content: candidate?.content ?? oi.item_id,
        areaName: candidate?.areaName ?? '',
        productName: candidate?.productName ?? '',
        estimatedMinutes: candidate?.estimatedMinutes ?? null,
        dueDate: candidate?.dueDate ?? null,
        reasoning: oi.suggestion,
      }
    })
    const cutoffOverflowRows = capacityCutoffItems.map((ci) => ({
      taskId: ci.candidate.taskId,
      subTaskId: ci.candidate.subTaskId,
      content: ci.candidate.content,
      areaName: ci.candidate.areaName,
      productName: ci.candidate.productName,
      estimatedMinutes: ci.estimatedMinutes,
      dueDate: ci.candidate.dueDate,
      reasoning: ci.reasoning + '（容量不足，移至明後天）',
    }))
    const overflowItemRows = [...cutoffOverflowRows, ...aiOverflowRows].map((item, idx) => ({
      ...item,
      order: plannedItems.length + idx + 1,
      status: 'overflow' as const,
    }))

    // 6e. 讀取今天既有計畫，提取用戶手動調整的項目（去重）
    let userAdjustedItems: typeof plannedItems = []
    try {
      const existingPlan = await this.repository.findByDate(request.userId, planDateOnly)
      if (existingPlan) {
        const seenAdjustedKeys = new Set<string>()
        userAdjustedItems = existingPlan.items
          .filter(item => item.userAdjusted && !item.completed && item.status === 'today')
          .filter(item => {
            const key = `${item.taskId}:${item.subTaskId || ''}`
            if (seenAdjustedKeys.has(key)) return false
            seenAdjustedKeys.add(key)
            return true
          })
          .map((item, idx) => ({
            taskId: item.taskId,
            subTaskId: item.subTaskId,
            content: item.content,
            areaName: item.areaName,
            productName: item.productName,
            estimatedMinutes: item.estimatedMinutes,
            dueDate: item.dueDate,
            order: idx + 1,
            reasoning: item.reasoning ?? '用戶手動調整保留',
            status: 'today' as const,
            userAdjusted: true,
          }))
      }
    } catch (err) {
      console.warn('[GeneratePlan] Failed to read existing plan (non-blocking):', err)
    }

    // 6f. 合併：用戶調整的在前，AI 排的在後（去重）
    const adjustedTaskKeys = new Set(
      userAdjustedItems.map(i => `${i.taskId}:${i.subTaskId || ''}`)
    )
    const deduplicatedPlanned = plannedItems
      .filter(i => !adjustedTaskKeys.has(`${i.taskId}:${i.subTaskId || ''}`))
    // Re-number orders: adjusted items first (1-based), then planned, then overflow
    const adjustedCount = userAdjustedItems.length
    const reorderedPlanned = deduplicatedPlanned.map((item, idx) => ({
      ...item,
      order: adjustedCount + idx + 1,
    }))
    const deduplicatedOverflow = overflowItemRows
      .filter(i => !adjustedTaskKeys.has(`${i.taskId}:${i.subTaskId || ''}`))
      .map((item, idx) => ({
        ...item,
        order: adjustedCount + reorderedPlanned.length + idx + 1,
      }))

    const allItems = [...userAdjustedItems, ...reorderedPlanned, ...deduplicatedOverflow]

    // 重新計算 plannedMinutes：只計算 status=today 的項目
    const actualPlannedMinutes = allItems
      .filter(i => i.status === 'today')
      .reduce((sum, i) => sum + (i.estimatedMinutes ?? 0), 0)

    // 6. 儲存 + 設定開始日期（並行執行，操作不同表）
    start = Date.now()
    const createData: CreateDailyPlanData = {
      userId: request.userId,
      planDate: planDateOnly,
      coachMessage: aiResult.coach_message,
      capacityNote: this.buildCapacityNote(collected.availableMinutes, collected.meetingMinutes, actualPlannedMinutes),
      availableMinutes: collected.availableMinutes,
      meetingMinutes: collected.meetingMinutes,
      plannedMinutes: actualPlannedMinutes,
      overflowItems: [],
      items: allItems,
    }

    const [plan] = await Promise.all([
      this.repository.upsert(createData),
      this.setStartDatesForPlannedItems(plannedItems, planDate),
    ])
    timings.save = Date.now() - start

    return { plan, timings, usage: aiUsage }
  }

  // ============================================================================
  // Private
  // ============================================================================

  private buildCapacityNote(availableMinutes: number, meetingMinutes: number, plannedMinutes: number): string {
    const availHours = (availableMinutes / 60).toFixed(1)
    const plannedHours = (plannedMinutes / 60).toFixed(1)
    const remainMinutes = availableMinutes - plannedMinutes
    const remainHours = (remainMinutes / 60).toFixed(1)
    const parts = [`今天可用工作時間為 ${availableMinutes} 分鐘`]
    if (meetingMinutes > 0) parts[0] += `（會議佔 ${meetingMinutes} 分鐘）`
    parts.push(`已安排 ${plannedMinutes} 分鐘的任務，尚餘 ${remainMinutes} 分鐘緩衝時間。`)
    return parts.join('，')
  }

  /**
   * 對排入計畫的項目自動設 start_date（僅首次，不覆蓋已有值）
   */
  private async setStartDatesForPlannedItems(
    items: Array<{ subTaskId: string | null; taskId: string }>,
    planDate: Date,
  ): Promise<void> {
    // SubTask: 設 start_date
    const subTaskIds = items
      .filter(i => i.subTaskId)
      .map(i => i.subTaskId!)

    // Task（無 subtask 的）: 設 start_date + 切 ACTIVE
    const taskOnlyIds = items
      .filter(i => !i.subTaskId)
      .map(i => i.taskId)

    // 並行更新 SubTask 和 Task（操作不同表）
    await Promise.all([
      subTaskIds.length > 0
        ? prisma.subTask.updateMany({
            where: {
              id: { in: subTaskIds },
              start_date: null,
            },
            data: { start_date: planDate },
          })
        : Promise.resolve(),
      taskOnlyIds.length > 0
        ? prisma.task.updateMany({
            where: {
              id: { in: taskOnlyIds },
              start_date: null,
            },
            data: {
              start_date: planDate,
              status: 'ACTIVE',
            },
          })
        : Promise.resolve(),
    ])
  }

  /**
   * 回寫 AI 估時到原始 Task/SubTask
   * 僅當原始記錄的 estimated_minutes 為 null 時才寫入（不覆蓋用戶手動值）
   */
  private async writeBackEstimates(
    aiResult: DailyPlanOutput,
    candidateMap: Map<string, PlanCandidate>,
  ): Promise<void> {
    const subTaskUpdates: Array<{ id: string; minutes: number }> = []

    for (const item of aiResult.daily_plan) {
      if (item.estimated_minutes == null) continue
      const candidate = candidateMap.get(item.item_id)
      if (!candidate || !candidate.subTaskId) continue
      // 只回寫原始值為 null 的（首次估時，不覆蓋用戶手動值）
      if (candidate.estimatedMinutes !== null) continue

      subTaskUpdates.push({ id: candidate.subTaskId, minutes: item.estimated_minutes })
    }

    if (subTaskUpdates.length > 0) {
      await prisma.$transaction(
        subTaskUpdates.map(u =>
          prisma.subTask.update({
            where: { id: u.id },
            data: { estimated_minutes: u.minutes },
          })
        ),
      )
    }
  }

  /**
   * 回寫 AI 建議的 start_date / due_date
   * 只更新 date_source 為 null 或 'coach' 的任務（絕不覆蓋 user 設定）
   */
  private async writeBackSuggestedDates(
    scheduling: Array<{
      task_id?: string
      suggested_start_date?: string
      suggested_due_date?: string | null
      reasoning?: string
    }>,
  ): Promise<number> {
    const valid = scheduling.filter(s => s.task_id && (s.suggested_start_date || s.suggested_due_date))
    if (valid.length === 0) return 0

    // 先查詢哪些 task 存在且允許更新（date_source 為 null 或 'coach'）
    const taskIds = valid.map(s => s.task_id!)
    const updateableTasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
        OR: [{ date_source: null }, { date_source: 'coach' }],
      },
      select: { id: true },
    })
    const updateableIds = new Set(updateableTasks.map(t => t.id))

    // 只更新可更新的 task
    const updates = valid
      .filter(s => updateableIds.has(s.task_id!))
      .map(s => {
        const data: Record<string, any> = {
          date_source: 'coach',
        }
        if (s.suggested_start_date) data.start_date = new Date(s.suggested_start_date)
        if (s.suggested_due_date) data.due_date = new Date(s.suggested_due_date)

        return prisma.task.update({
          where: { id: s.task_id! },
          data,
        })
      })

    if (updates.length === 0) return 0

    await Promise.all(updates)
    return updates.length
  }
}
