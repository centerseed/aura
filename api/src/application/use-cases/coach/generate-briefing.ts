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
import { UnifiedDataCollector } from '@/infrastructure/services/unified-data-collector'
import { UnifiedDataTransformer } from '@/infrastructure/services/unified-data-transformer'
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
    private readonly collector: UnifiedDataCollector = new UnifiedDataCollector(),
    private readonly transformer: UnifiedDataTransformer = new UnifiedDataTransformer(),
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

    // 4. 收集原始資料（統一收集器，briefing 和 plan 共用）
    start = Date.now()
    const rawData = await this.collector.collect(
      request.userId,
      briefingDate,
      timezone,
    )
    timings.collect = Date.now() - start

    // 5. 轉換成 briefing 格式（記憶體操作，極快）
    start = Date.now()
    const todayStart = new Date(briefingDate)
    todayStart.setHours(0, 0, 0, 0)
    const threeDaysLater = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000)
    const aggregatedData = this.transformer.toBriefingData(rawData, todayStart, threeDaysLater)
    timings.transform = Date.now() - start

    // 6. 偵測衝突 + 停滯
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

    // 7. 晨報：生成每日計畫 + 從結果組裝摘要（單次 LLM）
    //    晚報：呼叫 AI 生成回顧（單次 LLM）
    let aiResult: import('@/application/services/coach-ai-generator').CoachAIOutput
    let planResult: Awaited<ReturnType<GeneratePlanUseCase['execute']>> | undefined

    if (request.type === 'MORNING') {
      try {
        start = Date.now()
        const planUseCase = new GeneratePlanUseCase()
        planResult = await planUseCase.execute({
          userId: request.userId,
          date: request.date,
          timezone,
          rawData, // 共用已收集的資料，避免重複查詢
        })
        timings.plan = Date.now() - start
      } catch (err) {
        console.error('[GenerateBriefing] Plan generation failed (non-blocking):', err)
        timings.plan_error = 1
      }

      // 從 plan 結果 + 偵測結果組裝摘要，不需第二次 LLM
      aiResult = this.buildMorningSummaryFromPlan(
        planResult,
        conflicts,
        stagnations,
        aggregatedData.overdueTasks,
        aggregatedData.calendarEvents,
      )
    } else {
      // 晚報仍用 AI（回顧語氣需要 AI）
      start = Date.now()
      aiResult = await this.aiGenerator.generate({
        type: request.type,
        calendarEvents: aggregatedData.calendarEvents,
        overdueTasks: aggregatedData.overdueTasks,
        approachingTasks: aggregatedData.approachingTasks,
        conflicts,
        stagnations,
        completedTasks: aggregatedData.completedTasks,
        remainingTasks: aggregatedData.remainingTasks,
        tomorrowPreview: aggregatedData.tomorrowPreview,
      })
      timings.ai = Date.now() - start
    }

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

    // 合併 plan 內部的 timings
    if (planResult?.timings) {
      for (const [key, value] of Object.entries(planResult.timings)) {
        timings[`plan.${key}`] = value
      }
    }

    console.log('[Briefing] timings:', JSON.stringify(timings))

    return { briefing, timings }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 從 plan 結果 + 偵測結果組裝晨報摘要（無 LLM）
   * plan 的 coachMessage 已是 AI 生成的，直接當 summary 用
   */
  private buildMorningSummaryFromPlan(
    planResult: Awaited<ReturnType<GeneratePlanUseCase['execute']>> | undefined,
    conflicts: import('@/domain/entities/coach-briefing.entity').ConflictItem[],
    stagnations: import('@/domain/entities/coach-briefing.entity').StagnationItem[],
    overdueTasks: import('@/domain/entities/coach-briefing.entity').TaskSummary[],
    calendarEvents: import('@/domain/entities/coach-briefing.entity').CalendarEventSummary[],
  ): import('@/application/services/coach-ai-generator').CoachAIOutput {
    const recommendations: import('@/domain/entities/coach-briefing.entity').Recommendation[] = []

    // Summary: 用 plan 的 coachMessage，如果沒有就自己組
    let summary: string
    if (planResult?.plan.coachMessage) {
      summary = planResult.plan.coachMessage
    } else {
      const parts: string[] = []
      if (overdueTasks.length > 0) parts.push(`有 ${overdueTasks.length} 個逾期任務需要注意`)
      if (calendarEvents.length > 0) parts.push(`今天有 ${calendarEvents.length} 場會議`)
      summary = parts.length > 0 ? parts.join('，') + '。' : '今天沒有特別緊急的事項，可以專注推進手上的工作。'
    }

    // Recommendations: 從偵測結果提取
    if (overdueTasks.length > 0) {
      const top = overdueTasks[0]
      recommendations.push({
        priority: 1,
        action: `先處理逾期任務「${top.content}」`,
        reasoning: `已逾期 ${top.days_overdue} 天`,
        related_task_id: top.id,
      })
    }

    for (const conflict of conflicts.slice(0, 2)) {
      if (conflict.type === 'capacity_overload') {
        recommendations.push({
          priority: 2,
          action: '考慮延後非緊急任務，今天行程較滿',
          reasoning: conflict.description,
          related_task_id: null,
        })
      }
    }

    // 至少一個建議
    if (recommendations.length === 0 && planResult?.plan.items && planResult.plan.items.length > 0) {
      const first = planResult.plan.items[0]
      recommendations.push({
        priority: 1,
        action: `從「${first.content}」開始今天的工作`,
        reasoning: first.reasoning || '排序優先',
        related_task_id: null,
      })
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 1,
        action: '查看今日計畫，按順序執行',
        reasoning: '保持節奏',
        related_task_id: null,
      })
    }

    return {
      summary,
      recommendations,
      deferSuggestions: [],
    }
  }

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
