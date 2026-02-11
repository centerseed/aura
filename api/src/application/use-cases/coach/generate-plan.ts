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
import { PlanCandidateCollector } from '@/application/services/plan-candidate-collector'
import { CoachPlanGenerator } from '@/application/services/coach-plan-generator'
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

    // 4. AI 排序
    start = Date.now()
    const aiResult = await this.planGenerator.generate(
      collected.candidates,
      collected.productContexts,
      collected.availableMinutes,
      collected.meetingMinutes,
    )
    timings.ai = Date.now() - start

    // 5. 映射 AI 結果到候選資料
    const candidateMap = new Map(
      collected.candidates.map(c => [c.subTaskId || c.taskId, c])
    )

    const plannedItems = aiResult.daily_plan
      .map(item => {
        const candidate = candidateMap.get(item.item_id)
        if (!candidate) return null
        return {
          taskId: candidate.taskId,
          subTaskId: candidate.subTaskId,
          content: candidate.content,
          areaName: candidate.areaName,
          productName: candidate.productName,
          estimatedMinutes: candidate.estimatedMinutes,
          dueDate: candidate.dueDate,
          order: item.order,
          reasoning: item.reasoning,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

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
}
