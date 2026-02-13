/**
 * PrismaDailyPlanRepository - Prisma 每日計畫儲存庫實作
 */

import { prisma } from '@/lib/db'
import type {
  IDailyPlanRepository,
  DailyPlanData,
  DailyPlanItemData,
  CreateDailyPlanData,
  UpdateDailyPlanItemData,
} from '@/domain/interfaces/daily-plan-repository'

export class PrismaDailyPlanRepository implements IDailyPlanRepository {
  async findByDate(userId: string, date: Date): Promise<DailyPlanData | null> {
    const row = await prisma.dailyPlan.findUnique({
      where: {
        user_id_plan_date: {
          user_id: userId,
          plan_date: date,
        },
      },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return row ? this.toDomain(row) : null
  }

  async upsert(data: CreateDailyPlanData): Promise<DailyPlanData> {
    // Delete existing plan items first if plan exists, then upsert
    const existing = await prisma.dailyPlan.findUnique({
      where: {
        user_id_plan_date: {
          user_id: data.userId,
          plan_date: data.planDate,
        },
      },
    })

    if (existing) {
      // 只刪除未完成的 items，保留已完成的（含 actual_minutes 偏差學習資料）
      await prisma.dailyPlanItem.deleteMany({
        where: { plan_id: existing.id, completed: false },
      })

      const row = await prisma.dailyPlan.update({
        where: { id: existing.id },
        data: {
          coach_message: data.coachMessage,
          capacity_note: data.capacityNote,
          available_minutes: data.availableMinutes,
          meeting_minutes: data.meetingMinutes,
          planned_minutes: data.plannedMinutes,
          items: {
            create: data.items.map(item => ({
              task_id: item.taskId,
              sub_task_id: item.subTaskId,
              content: item.content,
              area_name: item.areaName,
              product_name: item.productName,
              estimated_minutes: item.estimatedMinutes,
              due_date: item.dueDate,
              order: item.order,
              reasoning: item.reasoning,
            })),
          },
        },
        include: {
          items: {
            orderBy: { order: 'asc' },
          },
        },
      })

      return this.toDomain(row)
    }

    // Create new plan
    const row = await prisma.dailyPlan.create({
      data: {
        user_id: data.userId,
        plan_date: data.planDate,
        coach_message: data.coachMessage,
        capacity_note: data.capacityNote,
        available_minutes: data.availableMinutes,
        meeting_minutes: data.meetingMinutes,
        planned_minutes: data.plannedMinutes,
        items: {
          create: data.items.map(item => ({
            task_id: item.taskId,
            sub_task_id: item.subTaskId,
            content: item.content,
            area_name: item.areaName,
            product_name: item.productName,
            estimated_minutes: item.estimatedMinutes,
            due_date: item.dueDate,
            order: item.order,
            reasoning: item.reasoning,
          })),
        },
      },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return this.toDomain(row)
  }

  async updateItem(itemId: string, data: UpdateDailyPlanItemData): Promise<DailyPlanItemData> {
    const updateData: any = {}
    if (data.order !== undefined) updateData.order = data.order
    if (data.completed !== undefined) {
      updateData.completed = data.completed
      updateData.completed_at = data.completed ? new Date() : null
    }
    if (data.actualMinutes !== undefined) updateData.actual_minutes = data.actualMinutes
    if (data.pinned !== undefined) updateData.pinned = data.pinned
    if (data.deferred !== undefined) updateData.deferred = data.deferred

    const row = await prisma.dailyPlanItem.update({
      where: { id: itemId },
      data: updateData,
    })

    return this.toItemDomain(row)
  }

  // ============================================================================
  // 轉換方法
  // ============================================================================

  private toDomain(row: any): DailyPlanData {
    return {
      id: row.id,
      userId: row.user_id,
      planDate: row.plan_date,
      coachMessage: row.coach_message,
      capacityNote: row.capacity_note,
      availableMinutes: row.available_minutes,
      meetingMinutes: row.meeting_minutes,
      plannedMinutes: row.planned_minutes,
      items: (row.items || []).map((item: any) => this.toItemDomain(item)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private toItemDomain(row: any): DailyPlanItemData {
    return {
      id: row.id,
      planId: row.plan_id,
      taskId: row.task_id,
      subTaskId: row.sub_task_id,
      content: row.content,
      areaName: row.area_name,
      productName: row.product_name,
      estimatedMinutes: row.estimated_minutes,
      dueDate: row.due_date,
      order: row.order,
      reasoning: row.reasoning,
      completed: row.completed,
      completedAt: row.completed_at,
      actualMinutes: row.actual_minutes,
      pinned: row.pinned,
      deferred: row.deferred,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
