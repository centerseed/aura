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

    // 4. 取得校準資訊 + AI 排序
    start = Date.now()
    const calibrationNote = await this.calibration.getCalibrationNote(request.userId)
    const aiResult = await this.planGenerator.generate(
      collected.candidates,
      collected.productContexts,
      collected.availableMinutes,
      collected.meetingMinutes,
      calibrationNote ?? undefined,
    )
    timings.ai = Date.now() - start

    // 5. 映射 AI 結果到候選資料（AI 估時優先）
    const candidateMap = new Map(
      collected.candidates.map(c => [c.subTaskId || c.taskId, c])
    )

    const plannedItems = aiResult.daily_plan
      .map(item => {
        const candidate = candidateMap.get(item.item_id)
        if (!candidate) return null
        // AI 估時優先，fallback 到候選值
        const estimatedMinutes = item.estimated_minutes ?? candidate.estimatedMinutes
        return {
          taskId: candidate.taskId,
          subTaskId: candidate.subTaskId,
          content: candidate.content,
          areaName: candidate.areaName,
          productName: candidate.productName,
          estimatedMinutes,
          dueDate: candidate.dueDate,
          order: item.order,
          reasoning: item.reasoning,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    // 5b. 回寫 AI 估時到原始 Task/SubTask（僅首次估時，不覆蓋用戶手動值）
    await this.writeBackEstimates(aiResult, candidateMap)

    // 計算 planned_minutes
    const plannedMinutes = plannedItems.reduce(
      (sum, item) => sum + (item.estimatedMinutes ?? 60),
      0,
    )

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
      items: plannedItems,
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
}
