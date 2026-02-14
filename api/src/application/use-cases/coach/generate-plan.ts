/**
 * GeneratePlanUseCase - 生成每日計畫
 *
 * 候選篩選 → AI 排序 → 儲存 daily_plans + daily_plan_items
 */

import type {
  IDailyPlanRepository,
  DailyPlanData,
  CreateDailyPlanData,
} from '@/domain/interfaces/daily-plan-repository'
import { PrismaDailyPlanRepository } from '@/infrastructure/repositories/prisma-daily-plan-repository'
import { PlanCandidateCollector, type PlanCandidate } from '@/application/services/plan-candidate-collector'
import { CoachPlanGenerator, type DailyPlanOutput } from '@/application/services/coach-plan-generator'
import { CoachCalibration } from '@/application/services/coach-calibration'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { resolveTimezone, toDateOnly } from '@/lib/timezone-utils'

// ============================================================================
// DTOs
// ============================================================================

export interface GeneratePlanRequest {
  userId: string
  date?: string
  timezone?: string
}

export interface GeneratePlanResponse {
  plan: DailyPlanData
  timings: Record<string, number>
}

// ============================================================================
// Use Case
// ============================================================================

export class GeneratePlanUseCase {
  constructor(
    private readonly repository: IDailyPlanRepository = new PrismaDailyPlanRepository(),
    private readonly collector: PlanCandidateCollector = new PlanCandidateCollector(),
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

    // 3. 收集候選
    start = Date.now()
    const collected = await this.collector.collect(request.userId, planDate, timezone)
    timings.collect = Date.now() - start

    // 4. 取得校準資訊（非阻塞）
    let calibrationNote: string | undefined
    try {
      const note = await this.calibration.getCalibrationNote(request.userId)
      calibrationNote = note ?? undefined
    } catch (err) {
      console.warn('[GeneratePlan] Calibration failed (non-blocking):', err)
    }

    // 5. AI 排序
    start = Date.now()
    const { output: aiResult, prompt: aiPrompt } = await this.planGenerator.generate(
      collected.candidates,
      collected.availableMinutes,
      collected.meetingMinutes,
      calibrationNote,
      collected.unscheduledTasks,
      collected.milestones,
    )
    timings.ai = Date.now() - start
    console.log('[GeneratePlan] Prompt length:', aiPrompt.length, 'chars')
    console.log('[GeneratePlan] Prompt:\n', aiPrompt)
    console.log('[GeneratePlan] AI result: daily_plan=%d items, overflow=%d items',
      aiResult.daily_plan.length, aiResult.overflow_items.length)

    // 6. 映射 AI 結果 + 容量硬截斷
    const candidateMap = new Map(
      collected.candidates.map(c => [c.subTaskId || c.taskId, c])
    )

    const plannedItems: Array<{
      taskId: string; subTaskId: string | null; content: string;
      areaName: string; productName: string; estimatedMinutes: number | null;
      dueDate: Date | null; order: number; reasoning: string;
    }> = []
    let accumulatedMinutes = 0

    for (const item of aiResult.daily_plan) {
      const candidate = candidateMap.get(item.item_id)
      if (!candidate) continue

      const estimatedMinutes = item.estimated_minutes ?? candidate.estimatedMinutes ?? 60
      // 容量硬截斷：超過 availableMinutes 就不排入
      if (accumulatedMinutes + estimatedMinutes > collected.availableMinutes && plannedItems.length > 0) {
        console.log('[GeneratePlan] Capacity cutoff at item %d (%s), accumulated=%dmin, available=%dmin',
          item.order, candidate.content.substring(0, 20), accumulatedMinutes, collected.availableMinutes)
        continue
      }
      accumulatedMinutes += estimatedMinutes

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
    const overflowItemRows = (aiResult.overflow_items || []).map((oi, idx) => {
      const candidate = candidateMap.get(oi.item_id)
      return {
        taskId: candidate?.taskId ?? '',
        subTaskId: candidate?.subTaskId ?? null,
        content: candidate?.content ?? oi.item_id,
        areaName: candidate?.areaName ?? '',
        productName: candidate?.productName ?? '',
        estimatedMinutes: candidate?.estimatedMinutes ?? null,
        dueDate: candidate?.dueDate ?? null,
        order: plannedItems.length + idx + 1,
        reasoning: oi.suggestion,
        status: 'overflow' as const,
      }
    })

    // 6e. 讀取前一天計畫，提取用戶手動調整的項目
    const yesterday = new Date(planDateOnly)
    yesterday.setDate(yesterday.getDate() - 1)
    let userAdjustedItems: typeof plannedItems = []
    try {
      const yesterdayPlan = await this.repository.findByDate(request.userId, yesterday)
      if (yesterdayPlan) {
        userAdjustedItems = yesterdayPlan.items
          .filter(item => item.userAdjusted && !item.completed)
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
      console.warn('[GeneratePlan] Failed to read yesterday plan (non-blocking):', err)
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

    // 6. 儲存
    start = Date.now()
    const createData: CreateDailyPlanData = {
      userId: request.userId,
      planDate: planDateOnly,
      coachMessage: aiResult.coach_message,
      capacityNote: aiResult.capacity_note,
      availableMinutes: collected.availableMinutes,
      meetingMinutes: collected.meetingMinutes,
      plannedMinutes: plannedMinutes,
      overflowItems: [],
      items: allItems,
    }

    const plan = await this.repository.upsert(createData)
    timings.save = Date.now() - start

    // 7. 自動設 start_date（排入計畫 = 開始執行）
    start = Date.now()
    await this.setStartDatesForPlannedItems(plannedItems, planDate)
    timings.setStartDates = Date.now() - start

    return { plan, timings }
  }

  // ============================================================================
  // Private
  // ============================================================================

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

    if (subTaskIds.length > 0) {
      await prisma.subTask.updateMany({
        where: {
          id: { in: subTaskIds },
          start_date: null,
        },
        data: { start_date: planDate },
      })
    }

    // Task（無 subtask 的）: 設 start_date + 切 ACTIVE
    const taskOnlyIds = items
      .filter(i => !i.subTaskId)
      .map(i => i.taskId)

    if (taskOnlyIds.length > 0) {
      await prisma.task.updateMany({
        where: {
          id: { in: taskOnlyIds },
          start_date: null,
        },
        data: {
          start_date: planDate,
          status: 'ACTIVE',
        },
      })
    }
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

    const updates = valid.map(s => {
      const data: Record<string, any> = {
        date_source: 'coach',
      }
      if (s.suggested_start_date) data.start_date = new Date(s.suggested_start_date)
      if (s.suggested_due_date) data.due_date = new Date(s.suggested_due_date)

      return prisma.task.update({
        where: {
          id: s.task_id!,
          OR: [{ date_source: null }, { date_source: 'coach' }],
        } as any,
        data,
      })
    })

    const results = await Promise.allSettled(updates)
    return results.filter(r => r.status === 'fulfilled').length
  }
}
