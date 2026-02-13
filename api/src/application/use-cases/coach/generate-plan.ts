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
    const timezone = await this.resolveTimezone(request)
    const planDate = request.date ? new Date(request.date) : new Date()
    const planDateOnly = this.toDateOnly(planDate, timezone)

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

    return { plan, timings }
  }

  // ============================================================================
  // Private
  // ============================================================================

  private async resolveTimezone(request: GeneratePlanRequest): Promise<string> {
    if (request.timezone) return request.timezone

    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { timezone: true },
    })

    return user?.timezone || 'Asia/Taipei'
  }

  private toDateOnly(date: Date, timezone: string): Date {
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone })
    return new Date(dateStr + 'T00:00:00.000Z')
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
      if (!item.estimated_minutes) continue
      const candidate = candidateMap.get(item.item_id)
      if (!candidate || !candidate.subTaskId) continue
      // 只回寫原始值為 null 的（首次估時，不覆蓋用戶手動值）
      if (candidate.estimatedMinutes !== null) continue

      subTaskUpdates.push({ id: candidate.subTaskId, minutes: item.estimated_minutes })
    }

    if (subTaskUpdates.length > 0) {
      await Promise.all(
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
