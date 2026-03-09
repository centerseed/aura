import type { IDataCollector } from "@/domain/interfaces/data-collector"
import { UnifiedDataCollector } from "@/infrastructure/services/unified-data-collector"
import { prisma } from "@/lib/db"
import { resolveTimezone, getEndOfDay, getStartOfDay } from "@/lib/timezone-utils"

const MAX_DISPLAY_ITEMS = 10

export interface QueryCoverage {
  tasks: boolean
  subTasks: boolean
  dailyPlanItems: boolean
}

export interface AgentTaskQueryItem {
  id: string
  title: string
  sourceType: "task" | "sub_task" | "daily_plan_item"
  productName?: string
  completedAt?: string
  dueDate?: string
  urgency?: "overdue" | "today" | "tomorrow" | "upcoming" | "unscheduled"
}

export interface AgentTaskQueryResult {
  queryType: "completed_today" | "today_focus"
  timezone: string
  coverage: QueryCoverage
  totalCount: number
  displayCount: number
  truncated: boolean
  items: AgentTaskQueryItem[]
  summary: string
}

type TimezoneResolver = (userId: string, timezone?: string) => Promise<string>

interface CompletionExtraSource {
  getCompletedSubTasks(userId: string, start: Date, end: Date): Promise<AgentTaskQueryItem[]>
  getCompletedDailyPlanItems(
    userId: string,
    start: Date,
    end: Date,
    seenKeys: Set<string>,
  ): Promise<AgentTaskQueryItem[]>
}

export class AgentTaskQueryService {
  constructor(
    private readonly collector: IDataCollector = new UnifiedDataCollector(),
    private readonly timezoneResolver: TimezoneResolver = resolveTimezone,
    private readonly completionExtraSource: CompletionExtraSource = new PrismaCompletionExtraSource(),
  ) {}

  async queryCompletedToday(userId: string, timezone?: string): Promise<AgentTaskQueryResult> {
    const resolvedTimezone = await this.timezoneResolver(userId, timezone)
    const start = getStartOfDay(new Date(), resolvedTimezone)
    const end = getEndOfDay(new Date(), resolvedTimezone)
    const rawData = await this.collector.collect(userId, new Date(), resolvedTimezone)
    const taskItems = rawData.completedTasks.map((task) => ({
      id: task.id,
      title: task.content,
      sourceType: "task" as const,
      productName: task.product_name,
      completedAt: task.completed_at.toISOString(),
    }))
    const seenKeys = new Set(taskItems.map((item) => buildDedupKey(item.sourceType, item.id)))
    const subTaskItems = await this.completionExtraSource.getCompletedSubTasks(userId, start, end)
    for (const item of subTaskItems) {
      seenKeys.add(buildDedupKey(item.sourceType, item.id))
    }
    const dailyPlanItems = await this.completionExtraSource.getCompletedDailyPlanItems(
      userId,
      start,
      end,
      seenKeys,
    )
    const items = [...taskItems, ...subTaskItems, ...dailyPlanItems].sort((a, b) => {
      const lhs = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const rhs = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return rhs - lhs
    })

    return this.formatResult("completed_today", resolvedTimezone, items, {
      tasks: true,
      subTasks: true,
      dailyPlanItems: true,
    })
  }

  async queryTodayFocus(userId: string, timezone?: string): Promise<AgentTaskQueryResult> {
    const resolvedTimezone = await this.timezoneResolver(userId, timezone)
    const rawData = await this.collector.collect(userId, new Date(), resolvedTimezone)
    const todayStart = getStartOfDay(new Date(), resolvedTimezone)

    const items = rawData.allTasks.map((task) => ({
      id: task.id,
      title: task.content,
      sourceType: "task" as const,
      productName: task.product_name,
      dueDate: task.due_date?.toISOString(),
      urgency: inferUrgency(task.due_date, todayStart),
    }))

    return this.formatResult("today_focus", resolvedTimezone, items, {
      tasks: true,
      subTasks: false,
      dailyPlanItems: false,
    })
  }

  private formatResult(
    queryType: AgentTaskQueryResult["queryType"],
    timezone: string,
    items: AgentTaskQueryItem[],
    coverage: QueryCoverage,
  ): AgentTaskQueryResult {
    const totalCount = items.length
    const displayItems = items.slice(0, MAX_DISPLAY_ITEMS)
    const truncated = totalCount > MAX_DISPLAY_ITEMS

    return {
      queryType,
      timezone,
      coverage,
      totalCount,
      displayCount: displayItems.length,
      truncated,
      items: displayItems,
      summary: formatSummary({
        queryType,
        totalCount,
        displayItems,
        truncated,
        coverage,
      }),
    }
  }
}

function inferUrgency(
  dueDate: Date | null,
  todayStart: Date,
): AgentTaskQueryItem["urgency"] {
  if (!dueDate) return "unscheduled"

  const dueDay = new Date(dueDate)
  dueDay.setHours(0, 0, 0, 0)
  const localToday = new Date(todayStart)
  localToday.setHours(0, 0, 0, 0)
  const diff = Math.round((dueDay.getTime() - localToday.getTime()) / 86400000)

  if (diff < 0) return "overdue"
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  return "upcoming"
}

function formatSummary({
  queryType,
  totalCount,
  displayItems,
  truncated,
  coverage,
}: {
  queryType: AgentTaskQueryResult["queryType"]
  totalCount: number
  displayItems: AgentTaskQueryItem[]
  truncated: boolean
  coverage: QueryCoverage
}): string {
  if (queryType === "completed_today") {
    if (totalCount === 0) {
      return `目前查到你今天還沒有完成任何項目。${coverageDescription(coverage, true)}`
    }

    const header = truncated
      ? `✅ 目前查到你今天已完成 ${totalCount} 項完成紀錄。以下列出其中 ${displayItems.length} 項：`
      : `✅ 目前查到你今天已完成 ${totalCount} 項完成紀錄：`

    return [header, formatItems(displayItems, "completed_today"), coverageLine(coverage)].join("\n\n")
  }

  if (totalCount === 0) {
    return `目前查到你沒有待處理的 Task。${coverageDescription(coverage, false)}`
  }

  const header = truncated
    ? `📋 目前查到 ${totalCount} 項待處理 Task。以下列出最優先的 ${displayItems.length} 項：`
    : `📋 目前查到 ${totalCount} 項待處理 Task：`

  return [header, formatItems(displayItems, "today_focus"), coverageLine(coverage)].join("\n\n")
}

function formatItems(
  items: AgentTaskQueryItem[],
  queryType: AgentTaskQueryResult["queryType"],
): string {
  return items
    .map((item, index) => {
      const title = item.title.length > 40 ? item.title.slice(0, 40) + "…" : item.title
      const product = item.productName ? ` [${item.productName}]` : ""
      const urgency = queryType === "today_focus" ? formatUrgency(item.urgency) : ""
      const source = queryType === "completed_today" ? formatSourceType(item.sourceType) : ""
      return `${index + 1}. ${title}${product}${source}${urgency}`
    })
    .join("\n")
}

function formatSourceType(sourceType: AgentTaskQueryItem["sourceType"]): string {
  switch (sourceType) {
    case "sub_task":
      return " [SubTask]"
    case "daily_plan_item":
      return " [Daily Plan]"
    default:
      return ""
  }
}

function formatUrgency(urgency?: AgentTaskQueryItem["urgency"]): string {
  switch (urgency) {
    case "overdue":
      return " ⚠️ 逾期"
    case "today":
      return " 📅 今天"
    case "tomorrow":
      return " 📅 明天"
    case "upcoming":
      return " 📌 近期"
    default:
      return ""
  }
}

function coverageLine(coverage: QueryCoverage): string {
  const covered = []
  if (coverage.tasks) covered.push("Task")
  if (coverage.subTasks) covered.push("SubTask")
  if (coverage.dailyPlanItems) covered.push("Daily Plan")
  return `查詢範圍：${covered.join("、") || "無"}`
}

function coverageDescription(coverage: QueryCoverage, completedQuery: boolean): string {
  if (completedQuery) {
    return `這個查詢目前覆蓋 ${coverageLine(coverage).replace("查詢範圍：", "")}。`
  }
  return `這個查詢目前只覆蓋 ${coverageLine(coverage).replace("查詢範圍：", "")} 清單。`
}

function buildDedupKey(sourceType: AgentTaskQueryItem["sourceType"], id: string): string {
  return `${sourceType}:${id}`
}

class PrismaCompletionExtraSource implements CompletionExtraSource {
  async getCompletedSubTasks(userId: string, start: Date, end: Date): Promise<AgentTaskQueryItem[]> {
    const rows = await prisma.subTask.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        completed: true,
        completed_at: {
          gte: start,
          lt: end,
        },
      },
      orderBy: {
        completed_at: "desc",
      },
      select: {
        id: true,
        content: true,
        completed_at: true,
        task: {
          select: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    return rows.map((row) => ({
      id: row.id,
      title: row.content,
      sourceType: "sub_task",
      productName: row.task.product.name,
      completedAt: row.completed_at?.toISOString(),
    }))
  }

  async getCompletedDailyPlanItems(
    userId: string,
    start: Date,
    end: Date,
    seenKeys: Set<string>,
  ): Promise<AgentTaskQueryItem[]> {
    const rows = await prisma.dailyPlanItem.findMany({
      where: {
        completed: true,
        completed_at: {
          gte: start,
          lt: end,
        },
        plan: {
          user_id: userId,
        },
      },
      orderBy: {
        completed_at: "desc",
      },
      select: {
        id: true,
        content: true,
        completed_at: true,
        product_name: true,
        task_id: true,
        sub_task_id: true,
      },
    })

    return rows
      .filter((row) => {
        if (row.sub_task_id && seenKeys.has(buildDedupKey("sub_task", row.sub_task_id))) {
          return false
        }
        if (!row.sub_task_id && seenKeys.has(buildDedupKey("task", row.task_id))) {
          return false
        }
        return true
      })
      .map((row) => ({
        id: row.id,
        title: row.content,
        sourceType: "daily_plan_item",
        productName: row.product_name,
        completedAt: row.completed_at?.toISOString(),
      }))
  }
}
