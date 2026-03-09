import type { IDataCollector } from "@/domain/interfaces/data-collector"
import { UnifiedDataCollector } from "@/infrastructure/services/unified-data-collector"
import { resolveTimezone, getStartOfDay } from "@/lib/timezone-utils"

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

export class AgentTaskQueryService {
  constructor(
    private readonly collector: IDataCollector = new UnifiedDataCollector(),
    private readonly timezoneResolver: TimezoneResolver = resolveTimezone,
  ) {}

  async queryCompletedToday(userId: string, timezone?: string): Promise<AgentTaskQueryResult> {
    const resolvedTimezone = await this.timezoneResolver(userId, timezone)
    const rawData = await this.collector.collect(userId, new Date(), resolvedTimezone)
    const items = rawData.completedTasks.map((task) => ({
      id: task.id,
      title: task.content,
      sourceType: "task" as const,
      productName: task.product_name,
      completedAt: task.completed_at.toISOString(),
    }))

    return this.formatResult("completed_today", resolvedTimezone, items)
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

    return this.formatResult("today_focus", resolvedTimezone, items)
  }

  private formatResult(
    queryType: AgentTaskQueryResult["queryType"],
    timezone: string,
    items: AgentTaskQueryItem[],
  ): AgentTaskQueryResult {
    const totalCount = items.length
    const displayItems = items.slice(0, MAX_DISPLAY_ITEMS)
    const truncated = totalCount > MAX_DISPLAY_ITEMS
    const coverage = {
      tasks: true,
      subTasks: false,
      dailyPlanItems: false,
    }

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
      return "目前查到你今天還沒有完成任何 Task。這個查詢目前只覆蓋 Task 完成紀錄。"
    }

    const header = truncated
      ? `✅ 目前查到你今天已完成 ${totalCount} 項 Task。以下列出其中 ${displayItems.length} 項：`
      : `✅ 目前查到你今天已完成 ${totalCount} 項 Task：`

    return [header, formatItems(displayItems, "completed_today"), coverageLine(coverage)].join("\n\n")
  }

  if (totalCount === 0) {
    return "目前查到你沒有待處理的 Task。這個查詢目前只覆蓋 Task 清單。"
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
      return `${index + 1}. ${title}${product}${urgency}`
    })
    .join("\n")
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

