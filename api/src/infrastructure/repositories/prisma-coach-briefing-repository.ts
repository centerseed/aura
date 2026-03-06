/**
 * PrismaCoachBriefingRepository - Prisma 教練簡報儲存庫實作
 *
 * Infrastructure Layer 實作 Domain Layer 的 ICoachBriefingRepository 介面
 */

import { prisma } from '@/lib/db'
import type { BriefingType as PrismaBriefingType } from '@prisma/client'
import type {
  ICoachBriefingRepository,
  CoachBriefingData,
  CreateCoachBriefingData,
} from '@/domain/interfaces/coach-briefing-repository'
import type { BriefingType } from '@/domain/entities/coach-briefing.entity'

export class PrismaCoachBriefingRepository implements ICoachBriefingRepository {
  async create(data: CreateCoachBriefingData): Promise<CoachBriefingData> {
    const row = await prisma.coachBriefing.create({
      data: {
        user_id: data.userId,
        type: data.type as PrismaBriefingType,
        briefing_date: data.briefingDate,
        calendar_events: data.calendarEvents as any,
        overdue_tasks: data.overdueTasks as any,
        approaching_tasks: data.approachingTasks as any,
        conflicts: data.conflicts as any,
        stagnations: data.stagnations as any,
        completed_tasks: data.completedTasks as any,
        remaining_tasks: data.remainingTasks as any,
        tomorrow_preview: data.tomorrowPreview as any,
        summary: data.summary,
        recommendations: data.recommendations as any,
        defer_suggestions: data.deferSuggestions as any,
      },
    })

    return this.toDomain(row)
  }

  async findLatest(userId: string, type?: BriefingType): Promise<CoachBriefingData | null> {
    const row = await prisma.coachBriefing.findFirst({
      where: {
        user_id: userId,
        ...(type ? { type: type as PrismaBriefingType } : {}),
      },
      orderBy: { created_at: 'desc' },
    })

    return row ? this.toDomain(row) : null
  }

  async findByDate(
    userId: string,
    type: BriefingType,
    date: Date,
  ): Promise<CoachBriefingData | null> {
    const row = await prisma.coachBriefing.findUnique({
      where: {
        user_id_type_briefing_date: {
          user_id: userId,
          type: type as PrismaBriefingType,
          briefing_date: date,
        },
      },
    })

    return row ? this.toDomain(row) : null
  }

  async upsertByDate(data: CreateCoachBriefingData): Promise<CoachBriefingData> {
    const prismaData = {
      user_id: data.userId,
      type: data.type as PrismaBriefingType,
      briefing_date: data.briefingDate,
      calendar_events: data.calendarEvents as any,
      overdue_tasks: data.overdueTasks as any,
      approaching_tasks: data.approachingTasks as any,
      conflicts: data.conflicts as any,
      stagnations: data.stagnations as any,
      completed_tasks: data.completedTasks as any,
      remaining_tasks: data.remainingTasks as any,
      tomorrow_preview: data.tomorrowPreview as any,
      summary: data.summary,
      recommendations: data.recommendations as any,
      defer_suggestions: data.deferSuggestions as any,
    }

    const row = await prisma.coachBriefing.upsert({
      where: {
        user_id_type_briefing_date: {
          user_id: data.userId,
          type: data.type as PrismaBriefingType,
          briefing_date: data.briefingDate,
        },
      },
      create: prismaData,
      update: prismaData,
    })

    return this.toDomain(row)
  }

  async removeTaskFromBriefing(userId: string, taskId: string): Promise<void> {
    const today = new Date()
    const todayDate = new Date(today.toISOString().slice(0, 10))

    const row = await prisma.coachBriefing.findUnique({
      where: {
        user_id_type_briefing_date: {
          user_id: userId,
          type: 'MORNING',
          briefing_date: todayDate,
        },
      },
    })

    if (!row) return

    const overdueTasks = (row.overdue_tasks || []) as any[]
    const approachingTasks = (row.approaching_tasks || []) as any[]
    const remainingTasks = (row.remaining_tasks || []) as any[]
    const completedTasks = (row.completed_tasks || []) as any[]

    // Find the task in any of the arrays
    const removedTask =
      overdueTasks.find((t: any) => t.id === taskId) ||
      approachingTasks.find((t: any) => t.id === taskId) ||
      remainingTasks.find((t: any) => t.id === taskId)

    if (!removedTask) return

    const updatedOverdue = overdueTasks.filter((t: any) => t.id !== taskId)
    const updatedApproaching = approachingTasks.filter((t: any) => t.id !== taskId)
    const updatedRemaining = remainingTasks.filter((t: any) => t.id !== taskId)
    completedTasks.push(removedTask)

    await prisma.coachBriefing.update({
      where: { id: row.id },
      data: {
        overdue_tasks: updatedOverdue as any,
        approaching_tasks: updatedApproaching as any,
        remaining_tasks: updatedRemaining as any,
        completed_tasks: completedTasks as any,
      },
    })
  }

  // ============================================================================
  // 轉換方法
  // ============================================================================

  private toDomain(row: any): CoachBriefingData {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type as BriefingType,
      briefingDate: row.briefing_date,
      calendarEvents: (row.calendar_events || []) as any[],
      overdueTasks: (row.overdue_tasks || []) as any[],
      approachingTasks: (row.approaching_tasks || []) as any[],
      conflicts: (row.conflicts || []) as any[],
      stagnations: (row.stagnations || []) as any[],
      completedTasks: (row.completed_tasks || []) as any[],
      remainingTasks: (row.remaining_tasks || []) as any[],
      tomorrowPreview: (row.tomorrow_preview || []) as any[],
      summary: row.summary,
      recommendations: (row.recommendations || []) as any[],
      deferSuggestions: (row.defer_suggestions || []) as any[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
