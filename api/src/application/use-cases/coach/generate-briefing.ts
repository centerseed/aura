/**
 * GenerateBriefingUseCase - 生成教練簡報
 *
 * Application Layer Use Case
 * 聚合資料 → 偵測衝突/停滯 → AI 生成摘要 → 儲存
 */

import type {
  ICoachBriefingRepository,
  CoachBriefingData,
  CreateCoachBriefingData,
} from '@/domain/interfaces/coach-briefing-repository'
import type { BriefingType } from '@/domain/entities/coach-briefing.entity'
import { PrismaCoachBriefingRepository } from '@/infrastructure/repositories/prisma-coach-briefing-repository'
import { CoachDataAggregator } from '@/infrastructure/services/coach-data-aggregator'
import {
  detectTimeOverlaps,
  detectDeadlineCollisions,
  detectCapacityOverload,
  detectStuckTasks,
  detectStuckSubTasks,
} from '@/application/services/coach-detection'
import { CoachAIGenerator } from '@/application/services/coach-ai-generator'
import { GeneratePlanUseCase } from '@/application/use-cases/coach/generate-plan'
import { ValidationException } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { resolveTimezone, toDateOnly } from '@/lib/timezone-utils'

// ============================================================================
// DTOs
// ============================================================================

export interface GenerateBriefingRequest {
  userId: string
  type: BriefingType
  date?: string // ISO date string, defaults to today
  timezone?: string // defaults to user's timezone or Asia/Taipei
}

export interface GenerateBriefingResponse {
  briefing: CoachBriefingData
  timings: Record<string, number>
}

// ============================================================================
// Use Case
// ============================================================================

export class GenerateBriefingUseCase {
  constructor(
    private readonly repository: ICoachBriefingRepository = new PrismaCoachBriefingRepository(),
    private readonly aggregator: CoachDataAggregator = new CoachDataAggregator(),
    private readonly aiGenerator: CoachAIGenerator = new CoachAIGenerator(),
  ) {}

  async execute(request: GenerateBriefingRequest): Promise<GenerateBriefingResponse> {
    const timings: Record<string, number> = {}
    let start: number

    // 1. 驗證輸入
    this.validateRequest(request)

    // 2. 取得用戶時區
    const timezone = await resolveTimezone(request.userId, request.timezone)

    // 3. 決定日期
    const briefingDate = request.date
      ? new Date(request.date)
      : new Date()

    // 4. 聚合資料
    start = Date.now()
    const aggregatedData = await this.aggregator.aggregate(
      request.userId,
      briefingDate,
      timezone,
    )
    timings.aggregate = Date.now() - start

    // 5. 偵測衝突 + 停滯
    start = Date.now()
    const timeOverlaps = detectTimeOverlaps(aggregatedData.calendarEvents)
    const deadlineCollisions = detectDeadlineCollisions([
      ...aggregatedData.overdueTasks,
      ...aggregatedData.approachingTasks,
    ])
    const capacityOverload = detectCapacityOverload(
      aggregatedData.approachingTasks,
      aggregatedData.calendarEvents,
    )
    const conflicts = [...timeOverlaps, ...deadlineCollisions, ...capacityOverload]

    const stuckTasks = detectStuckTasks(aggregatedData.remainingTasks)
    const stuckSubTasks = detectStuckSubTasks(aggregatedData.stuckSubTasks)
    const stagnations = [...stuckTasks, ...stuckSubTasks]
    timings.detection = Date.now() - start

    // 6. 晨報時先生成每日計畫（plan 結果會傳給 AI）
    let dailyPlan: import('@/application/services/coach-ai-generator').DailyPlanForBriefing | undefined
    if (request.type === 'MORNING') {
      try {
        start = Date.now()
        const planUseCase = new GeneratePlanUseCase()
        const planResult = await planUseCase.execute({
          userId: request.userId,
          date: request.date,
          timezone,
        })
        timings.plan = Date.now() - start

        // 提取 plan 資料供 AI 使用
        dailyPlan = {
          items: planResult.plan.items.map(item => ({
            order: item.order,
            content: item.content,
            areaName: item.areaName,
            productName: item.productName,
            estimatedMinutes: item.estimatedMinutes,
            reasoning: item.reasoning,
          })),
          coachMessage: planResult.plan.coachMessage,
          capacityNote: planResult.plan.capacityNote,
          overflowItems: [], // overflow 目前不存在於 DailyPlanData，由 AI 生成時已處理
        }
      } catch (err) {
        console.error('[GenerateBriefing] Plan generation failed (non-blocking):', err)
        timings.plan_error = 1
      }
    }

    // 7. AI 生成摘要 + 建議（含 plan 資料）
    start = Date.now()
    const aiResult = await this.aiGenerator.generate({
      type: request.type,
      calendarEvents: aggregatedData.calendarEvents,
      overdueTasks: aggregatedData.overdueTasks,
      approachingTasks: aggregatedData.approachingTasks,
      conflicts,
      stagnations,
      completedTasks: aggregatedData.completedTasks,
      remainingTasks: aggregatedData.remainingTasks,
      tomorrowPreview: aggregatedData.tomorrowPreview,
      dailyPlan,
    })
    timings.ai = Date.now() - start

    // 8. 儲存（幂等：同 user+type+date 覆蓋）
    start = Date.now()
    const createData: CreateCoachBriefingData = {
      userId: request.userId,
      type: request.type,
      briefingDate: toDateOnly(briefingDate, timezone),
      calendarEvents: aggregatedData.calendarEvents,
      overdueTasks: aggregatedData.overdueTasks,
      approachingTasks: aggregatedData.approachingTasks,
      conflicts,
      stagnations,
      completedTasks: aggregatedData.completedTasks,
      remainingTasks: aggregatedData.remainingTasks,
      tomorrowPreview: aggregatedData.tomorrowPreview,
      summary: aiResult.summary,
      recommendations: aiResult.recommendations,
      deferSuggestions: aiResult.deferSuggestions,
    }

    const briefing = await this.repository.upsertByDate(createData)
    timings.save = Date.now() - start

    return { briefing, timings }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateRequest(request: GenerateBriefingRequest): void {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    if (!request.type || !['MORNING', 'EVENING'].includes(request.type)) {
      throw new ValidationException(
        'type must be MORNING or EVENING',
        'type',
      )
    }

    if (request.date) {
      const parsed = new Date(request.date)
      if (isNaN(parsed.getTime())) {
        throw new ValidationException('Invalid date format', 'date')
      }
    }
  }

}
