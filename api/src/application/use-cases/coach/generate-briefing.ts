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
import type { IDataCollector } from '@/domain/interfaces/data-collector'
import type { IDataTransformer } from '@/domain/interfaces/data-transformer'
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
import { resolveTimezone, toDateOnly, getStartOfDay } from '@/lib/timezone-utils'

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
    private readonly collector: IDataCollector = new UnifiedDataCollector(),
    private readonly transformer: IDataTransformer = new UnifiedDataTransformer(),
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
    const todayStart = getStartOfDay(briefingDate, timezone)
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
      // 先生成 plan
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

      // 把 plan 結果傳給 AI generator 作為 context
      start = Date.now()
      aiResult = await this.aiGenerator.generate({
        type: 'MORNING',
        calendarEvents: aggregatedData.calendarEvents,
        overdueTasks: aggregatedData.overdueTasks,
        approachingTasks: aggregatedData.approachingTasks,
        conflicts,
        stagnations,
        completedTasks: aggregatedData.completedTasks,
        remainingTasks: aggregatedData.remainingTasks,
        tomorrowPreview: aggregatedData.tomorrowPreview,
        dailyPlan: planResult ? {
          items: planResult.plan.items
            .filter(i => i.status === 'today')
            .map(i => ({
            order: i.order,
            content: i.content,
            areaName: i.areaName,
            productName: i.productName,
            estimatedMinutes: i.estimatedMinutes,
            reasoning: i.reasoning,
          })),
          coachMessage: planResult.plan.coachMessage,
          capacityNote: planResult.plan.capacityNote,
          overflowItems: [],
        } : undefined,
      })
      timings.ai = Date.now() - start
    } else {
      // 晚報：補充 plan 已完成項目（向前相容：舊的完成不會有 ARCHIVE status）
      const eveningCompleted = [...aggregatedData.completedTasks]
      try {
        const todayStr = toDateOnly(briefingDate, timezone)
        const todayPlan = await prisma.dailyPlan.findFirst({
          where: { user_id: request.userId, plan_date: new Date(todayStr) },
          include: {
            items: {
              where: { completed: true },
              select: {
                id: true, task_id: true, sub_task_id: true, content: true,
                area_name: true, product_name: true, estimated_minutes: true,
              },
            },
          },
        })
        if (todayPlan) {
          const existingIds = new Set(eveningCompleted.map(t => t.id))
          for (const item of todayPlan.items) {
            const id = item.sub_task_id || item.task_id
            if (id && !existingIds.has(id)) {
              eveningCompleted.push({
                id,
                content: item.content,
                status: 'completed',
                due_date: null,
                start_date: null,
                area_name: item.area_name || '',
                product_name: item.product_name || '',
                days_overdue: null,
                days_remaining: null,
                days_stagnant: null,
                urgency_level: null,
                estimated_minutes: item.estimated_minutes,
              })
            }
          }
        }
      } catch (err) {
        console.error('[GenerateBriefing] Failed to load plan completed items:', err)
      }

      // AI 生成回顧（不傳 remainingTasks）
      start = Date.now()
      aiResult = await this.aiGenerator.generate({
        type: request.type,
        calendarEvents: aggregatedData.calendarEvents,
        overdueTasks: aggregatedData.overdueTasks,
        approachingTasks: aggregatedData.approachingTasks,
        conflicts,
        stagnations,
        completedTasks: eveningCompleted,
        remainingTasks: [], // 不傳 remainingTasks 給 AI，防止捏造
        tomorrowPreview: aggregatedData.tomorrowPreview,
      })
      timings.ai = Date.now() - start

      // defer_suggestions 改用程式碼規則生成，不靠 AI
      aiResult.deferSuggestions = this.buildDeferSuggestions(
        aggregatedData.remainingTasks,
        stagnations,
      )
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
      remainingTasks: request.type === 'MORNING' ? aggregatedData.remainingTasks : [],
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
   * 基於規則生成 defer suggestions（不靠 AI）
   * - 逾期 > 14 天 → archive
   * - 逾期 > 7 天 → defer
   * - 停滯 > 14 天 → archive
   */
  private buildDeferSuggestions(
    remainingTasks: import('@/domain/entities/coach-briefing.entity').TaskSummary[],
    stagnations: import('@/domain/entities/coach-briefing.entity').StagnationItem[],
  ): import('@/domain/entities/coach-briefing.entity').DeferSuggestion[] {
    const suggestions: import('@/domain/entities/coach-briefing.entity').DeferSuggestion[] = []

    for (const task of remainingTasks) {
      if (task.days_overdue != null && task.days_overdue > 14) {
        suggestions.push({
          task_id: task.id,
          task_content: task.content,
          suggested_action: 'archive',
          reasoning: `已逾期 ${task.days_overdue} 天，建議歸檔或重新評估是否仍需要`,
        })
      } else if (task.days_overdue != null && task.days_overdue > 7) {
        suggestions.push({
          task_id: task.id,
          task_content: task.content,
          suggested_action: 'defer',
          reasoning: `已逾期 ${task.days_overdue} 天，建議重新設定截止日期`,
        })
      }
    }

    for (const stag of stagnations) {
      if (stag.days_inactive > 14) {
        // 避免與 remainingTasks 重複
        if (!suggestions.some(s => s.task_id === stag.entity_id)) {
          suggestions.push({
            task_id: stag.entity_id,
            task_content: stag.entity_name,
            suggested_action: 'archive',
            reasoning: `已停滯 ${stag.days_inactive} 天未更新，建議歸檔或委派`,
          })
        }
      }
    }

    return suggestions.slice(0, 5)
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
