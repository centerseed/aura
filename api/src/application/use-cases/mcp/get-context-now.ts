/**
 * GetContextNowUseCase - 全局狀態感知
 *
 * MCP Resource: zentropy://context/now
 * 組裝 CoachDataAggregator + CoachDetection + CoachCalibration 的數據。
 */

import { CoachDataAggregator, type AggregatedData } from '@/infrastructure/services/coach-data-aggregator'
import { CoachCalibration } from '@/application/services/coach-calibration'
import {
  detectTimeOverlaps,
  detectDeadlineCollisions,
  detectCapacityOverload,
  detectStagnantProducts,
  detectStuckTasks,
} from '@/application/services/coach-detection'
import type { StagnationItem } from '@/domain/entities/coach-briefing.entity'
import { ValidationException } from '@/lib/api-response'
import { resolveTimezone } from '@/lib/timezone-utils'

export interface GetContextNowRequest {
  userId: string
}

export interface ContextNowStalledItem {
  id: string
  title: string
  stalled_days: number
}

export interface GetContextNowResponse {
  generated_at: string
  summary: string
  open_loops: number
  due_today: number
  overdue: number
  top_priorities: string[]
  calendar_conflicts: Array<{ description: string; severity: string }>
  stalled_items: ContextNowStalledItem[]
  estimation_bias: {
    overall: number
    by_area: Record<string, number>
  }
}

export class GetContextNowUseCase {
  constructor(
    private readonly aggregator: CoachDataAggregator = new CoachDataAggregator(),
    private readonly calibration: CoachCalibration = new CoachCalibration(),
  ) {}

  async execute(request: GetContextNowRequest): Promise<GetContextNowResponse> {
    if (!request.userId) {
      throw new ValidationException('User ID is required', 'userId')
    }

    const now = new Date()
    const timezone = await resolveTimezone(request.userId)

    // Parallel: aggregate data + calibration
    const [aggregated, calibResult] = await Promise.all([
      this.aggregator.aggregate(request.userId, now, timezone),
      this.calibration.calculate(request.userId),
    ])

    // Run detection on aggregated data
    const timeOverlaps = detectTimeOverlaps(aggregated.calendarEvents)
    const deadlineCollisions = detectDeadlineCollisions([
      ...aggregated.overdueTasks,
      ...aggregated.approachingTasks,
    ])
    const capacityOverload = detectCapacityOverload(
      aggregated.remainingTasks,
      aggregated.calendarEvents,
    )
    const stagnantProducts = detectStagnantProducts(aggregated.stagnantProducts)
    const stuckTasks = detectStuckTasks(aggregated.remainingTasks)

    // All conflicts
    const allConflicts = [...timeOverlaps, ...deadlineCollisions, ...capacityOverload]

    // Stalled items
    const stalledItems: ContextNowStalledItem[] = [
      ...stagnantProducts.map(s => ({
        id: s.entity_id,
        title: s.entity_name,
        stalled_days: s.days_inactive,
      })),
      ...stuckTasks.map(s => ({
        id: s.entity_id,
        title: s.entity_name,
        stalled_days: s.days_inactive,
      })),
    ]

    // Calibration bias by area
    const byArea: Record<string, number> = {}
    for (const area of calibResult.byArea) {
      if (area.sampleCount >= 3) {
        byArea[area.areaName] = Math.round(area.ratio * 100) / 100
      }
    }

    // Top priorities: overdue first, then approaching
    const topPriorities = [
      ...aggregated.overdueTasks.slice(0, 3).map(t => t.id),
      ...aggregated.approachingTasks.slice(0, 2).map(t => t.id),
    ].slice(0, 5)

    // Count today's due
    const todayStr = now.toISOString().substring(0, 10)
    const dueToday = aggregated.approachingTasks.filter(
      t => t.due_date && t.due_date.substring(0, 10) === todayStr,
    ).length

    // Summary
    const summary = this.generateSummary(aggregated, allConflicts.length, stalledItems.length)

    return {
      generated_at: now.toISOString(),
      summary,
      open_loops: aggregated.remainingTasks.length,
      due_today: dueToday,
      overdue: aggregated.overdueTasks.length,
      top_priorities: topPriorities,
      calendar_conflicts: allConflicts.map(c => ({
        description: c.description,
        severity: c.severity,
      })),
      stalled_items: stalledItems,
      estimation_bias: {
        overall: calibResult.totalSamples >= 3
          ? Math.round(calibResult.overallRatio * 100) / 100
          : 1.0,
        by_area: byArea,
      },
    }
  }

  private generateSummary(
    data: AggregatedData,
    conflictCount: number,
    stalledCount: number,
  ): string {
    const parts: string[] = []

    if (data.overdueTasks.length > 0) {
      parts.push(`${data.overdueTasks.length} overdue`)
    }
    if (data.approachingTasks.length > 0) {
      parts.push(`${data.approachingTasks.length} approaching deadline`)
    }
    if (conflictCount > 0) {
      parts.push(`${conflictCount} conflicts detected`)
    }
    if (stalledCount > 0) {
      parts.push(`${stalledCount} stalled items`)
    }

    if (parts.length === 0) {
      return 'All clear — no urgent items or conflicts.'
    }

    return parts.join(', ') + '.'
  }
}
