import type { IDataCollector } from "@/domain/interfaces/data-collector"
import { UnifiedDataCollector } from "@/infrastructure/services/unified-data-collector"
import { prisma } from "@/lib/db"
import { resolveTimezone, getEndOfDay, getStartOfDay } from "@/lib/timezone-utils"
import { serializeFactsSummary } from "./tool-result-protocol"

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
  relatedTaskId?: string
  relatedSubTaskId?: string
}

export interface QueryGroupSummary {
  label: string
  count: number
}

export interface AgentTaskQueryResult {
  queryType: "completed_today" | "today_focus"
  scopeLabel: string
  timezone: string
  coverage: QueryCoverage
  totalCount: number
  displayCount: number
  truncated: boolean
  items: AgentTaskQueryItem[]
  groupedSummary: QueryGroupSummary[]
  summary: string
}

type TimezoneResolver = (userId: string, timezone?: string) => Promise<string>

interface CompletionExtraSource {
  getCompletedSubTasks(userId: string, start: Date, end: Date): Promise<AgentTaskQueryItem[]>
  getCompletedDailyPlanItems(userId: string, start: Date, end: Date): Promise<AgentTaskQueryItem[]>
}

interface TodayFocusExtraSource {
  getTodayFocusDailyPlanItems(
    userId: string,
    focusDate: Date,
  ): Promise<AgentTaskQueryItem[]>
}

export interface TodayFocusQueryOptions {
  strictToday?: boolean
  dayOffset?: number
}

export class AgentTaskQueryService {
  constructor(
    private readonly collector: IDataCollector = new UnifiedDataCollector(),
    private readonly timezoneResolver: TimezoneResolver = resolveTimezone,
    private readonly completionExtraSource: CompletionExtraSource = new PrismaCompletionExtraSource(),
    private readonly todayFocusExtraSource: TodayFocusExtraSource = new PrismaTodayFocusExtraSource(),
  ) {}

  async queryCompletedToday(userId: string, timezone?: string): Promise<AgentTaskQueryResult> {
    const resolvedTimezone = await this.timezoneResolver(userId, timezone)
    const start = getStartOfDay(new Date(), resolvedTimezone)
    const end = getEndOfDay(new Date(), resolvedTimezone)
    const [rawData, subTaskItems, dailyPlanItems] = await Promise.all([
      this.collector.collect(userId, new Date(), resolvedTimezone),
      this.completionExtraSource.getCompletedSubTasks(userId, start, end),
      this.completionExtraSource.getCompletedDailyPlanItems(userId, start, end),
    ])
    const taskItems = rawData.completedTasks.map((task) => ({
      id: task.id,
      title: task.content,
      sourceType: "task" as const,
      productName: task.product_name,
      completedAt: task.completed_at.toISOString(),
      relatedTaskId: task.id,
    }))
    const items = dedupeCompletedItems([...taskItems, ...subTaskItems, ...dailyPlanItems]).sort((a, b) => {
      const lhs = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const rhs = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return rhs - lhs
    })

    return this.formatResult("completed_today", resolvedTimezone, items, {
      scopeLabel: "今天",
      tasks: true,
      subTasks: true,
      dailyPlanItems: true,
    })
  }

  async queryTodayFocus(
    userId: string,
    timezone?: string,
    options?: TodayFocusQueryOptions,
  ): Promise<AgentTaskQueryResult> {
    const resolvedTimezone = await this.timezoneResolver(userId, timezone)
    const now = new Date()
    const todayStart = getStartOfDay(now, resolvedTimezone)
    const dayOffset = options?.dayOffset ?? 0
    const focusStart = new Date(todayStart.getTime() + dayOffset * 24 * 60 * 60 * 1000)
    const focusEnd = new Date(focusStart.getTime() + 24 * 60 * 60 * 1000)
    const tomorrowEnd = new Date(todayStart.getTime() + 2 * 24 * 60 * 60 * 1000)
    const upcomingEnd = new Date(todayStart.getTime() + 4 * 24 * 60 * 60 * 1000)

    const [rawData, rawDailyPlanItems] = await Promise.all([
      this.collector.collect(userId, now, resolvedTimezone),
      this.todayFocusExtraSource.getTodayFocusDailyPlanItems(userId, focusStart),
    ])
    const dailyPlanItems = rawDailyPlanItems.map((item) => ({
      ...item,
      urgency: inferUrgency(item.dueDate ? new Date(item.dueDate) : null, todayStart),
    }))
    const blockedTaskIds = new Set(
      dailyPlanItems
        .map((item) => item.relatedTaskId)
        .filter((id): id is string => Boolean(id)),
    )
    const subTaskItems = buildTodayFocusSubTaskItems(
      rawData,
      todayStart,
      focusStart,
      focusEnd,
      upcomingEnd,
      blockedTaskIds,
      options,
    )
    for (const item of subTaskItems) {
      if (item.relatedTaskId) {
        blockedTaskIds.add(item.relatedTaskId)
      }
    }
    const taskItems = buildTodayFocusTaskItems(
      rawData,
      todayStart,
      focusStart,
      focusEnd,
      tomorrowEnd,
      upcomingEnd,
      blockedTaskIds,
      options,
    )

    const items = [...dailyPlanItems, ...subTaskItems, ...taskItems].sort(compareTodayFocusItems)

    return this.formatResult("today_focus", resolvedTimezone, items, {
      scopeLabel: formatScopeLabel(dayOffset, focusStart),
      tasks: true,
      subTasks: true,
      dailyPlanItems: true,
    })
  }

  private formatResult(
    queryType: AgentTaskQueryResult["queryType"],
    timezone: string,
    items: AgentTaskQueryItem[],
    meta: QueryCoverage & { scopeLabel: string },
  ): AgentTaskQueryResult {
    const totalCount = items.length
    const displayItems = items.slice(0, MAX_DISPLAY_ITEMS)
    const truncated = totalCount > MAX_DISPLAY_ITEMS
    const groupedSummary = buildGroupedSummary(queryType, items)

    const coverage: QueryCoverage = {
      tasks: meta.tasks,
      subTasks: meta.subTasks,
      dailyPlanItems: meta.dailyPlanItems,
    }

    return {
      queryType,
      scopeLabel: meta.scopeLabel,
      timezone,
      coverage,
      totalCount,
      displayCount: displayItems.length,
      truncated,
      items: displayItems,
      groupedSummary,
      summary: formatSummary({
        queryType,
        scopeLabel: meta.scopeLabel,
        totalCount,
        displayItems,
        truncated,
        coverage,
        groupedSummary,
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
  scopeLabel,
  totalCount,
  displayItems,
  truncated,
  coverage,
  groupedSummary,
}: {
  queryType: AgentTaskQueryResult["queryType"]
  scopeLabel: string
  totalCount: number
  displayItems: AgentTaskQueryItem[]
  truncated: boolean
  coverage: QueryCoverage
  groupedSummary: QueryGroupSummary[]
}): string {
  if (queryType === "completed_today") {
    if (totalCount === 0) {
      return `今天還沒有查到完成項目。\n${coverageDescription(coverage, true)}`
    }

    const header = truncated
      ? `✅ 今天你已完成 ${totalCount} 項，我先列出 ${displayItems.length} 項重點：`
      : `✅ 今天你已完成 ${totalCount} 項：`

    return [
      header,
      groupedSummaryLine(groupedSummary),
      formatItems(displayItems, "completed_today"),
      coverageLine(coverage),
    ].join("\n\n")
  }

  if (totalCount === 0) {
    return `你${scopeLabel}目前沒有待處理項目。\n${coverageDescription(coverage, false)}`
  }

  const header = truncated
    ? `📋 你${scopeLabel}手上還有 ${totalCount} 項，我先列最需要注意的 ${displayItems.length} 項：`
    : `📋 你${scopeLabel}手上還有 ${totalCount} 項：`

  return [
    header,
    groupedSummaryLine(groupedSummary),
    formatItems(displayItems, "today_focus"),
    coverageLine(coverage),
  ].join("\n\n")
}

function formatScopeLabel(dayOffset: number, focusStart: Date): string {
  if (dayOffset === 0) return "今天"
  if (dayOffset === 1) return "明天"
  return `${focusStart.getFullYear()}-${String(focusStart.getMonth() + 1).padStart(2, "0")}-${String(focusStart.getDate()).padStart(2, "0")}`
}

function formatItems(
  items: AgentTaskQueryItem[],
  queryType: AgentTaskQueryResult["queryType"],
): string {
  return items
    .map((item, index) => {
      const title = item.title.length > 40 ? item.title.slice(0, 40) + "…" : item.title
      const product = item.productName ? `｜${item.productName}` : ""
      const urgency = queryType === "today_focus" ? formatUrgency(item.urgency) : ""
      const source = queryType === "completed_today" || item.sourceType !== "task"
        ? formatSourceType(item.sourceType)
        : ""
      return `${index + 1}. ${title}${product}${source}${urgency}`
    })
    .join("\n")
}

function formatSourceType(sourceType: AgentTaskQueryItem["sourceType"]): string {
  switch (sourceType) {
    case "sub_task":
      return "・子項"
    case "daily_plan_item":
      return "・日計畫"
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
  return `補充：這次查詢涵蓋 ${covered.join("、") || "無"}`
}

function coverageDescription(coverage: QueryCoverage, completedQuery: boolean): string {
  if (completedQuery) {
    return coverageLine(coverage)
  }
  return coverageLine(coverage)
}

function groupedSummaryLine(groups: QueryGroupSummary[]): string {
  if (groups.length === 0) return "先看重點：目前沒有可補充的分組摘要"
  return `先看重點：${groups.map((group) => `${group.label} ${group.count} 項`).join("、")}`
}

function buildDedupKey(sourceType: AgentTaskQueryItem["sourceType"], id: string): string {
  return `${sourceType}:${id}`
}

function dedupeCompletedItems(items: AgentTaskQueryItem[]): AgentTaskQueryItem[] {
  const seenKeys = new Set<string>()
  const seenTaskIds = new Set<string>()
  const seenSubTaskIds = new Set<string>()
  const deduped: AgentTaskQueryItem[] = []

  for (const item of items) {
    const itemKey = buildDedupKey(item.sourceType, item.id)
    if (seenKeys.has(itemKey)) continue

    if (item.sourceType === "task" && item.relatedTaskId) {
      seenTaskIds.add(item.relatedTaskId)
    }
    if (item.sourceType === "sub_task" && item.relatedSubTaskId) {
      seenSubTaskIds.add(item.relatedSubTaskId)
    }
  }

  for (const item of items) {
    const itemKey = buildDedupKey(item.sourceType, item.id)
    if (seenKeys.has(itemKey)) continue

    if (item.sourceType === "daily_plan_item") {
      if (item.relatedSubTaskId && seenSubTaskIds.has(item.relatedSubTaskId)) continue
      if (!item.relatedSubTaskId && item.relatedTaskId && seenTaskIds.has(item.relatedTaskId)) continue
    }

    seenKeys.add(itemKey)
    deduped.push(item)
  }

  return deduped
}

function buildTodayFocusSubTaskItems(
  rawData: Awaited<ReturnType<IDataCollector["collect"]>>,
  todayStart: Date,
  focusStart: Date,
  focusEnd: Date,
  upcomingEnd: Date,
  blockedTaskIds: Set<string>,
  options?: TodayFocusQueryOptions,
): AgentTaskQueryItem[] {
  const taskMap = new Map(rawData.allTasks.map((task) => [task.id, task]))

  return rawData.allSubTasks
    .filter((subTask) => !subTask.completed && !blockedTaskIds.has(subTask.task_id))
    .map((subTask): AgentTaskQueryItem | null => {
      const parentTask = taskMap.get(subTask.task_id)
      if (!parentTask) return null
      const effectiveDueDate = subTask.due_date ?? parentTask.due_date
      if (!isTodayFocusCandidate(
        effectiveDueDate,
        todayStart,
        focusStart,
        focusEnd,
        upcomingEnd,
        subTask.start_date ?? parentTask.start_date,
        subTask.updated_at,
        options,
      )) {
        return null
      }

      return {
        id: subTask.id,
        title: subTask.content,
        sourceType: "sub_task" as const,
        productName: parentTask.product_name,
        dueDate: effectiveDueDate?.toISOString(),
        urgency: inferUrgency(effectiveDueDate, todayStart),
        relatedTaskId: parentTask.id,
        relatedSubTaskId: subTask.id,
      }
    })
    .filter((item): item is AgentTaskQueryItem => item !== null)
}

function buildTodayFocusTaskItems(
  rawData: Awaited<ReturnType<IDataCollector["collect"]>>,
  todayStart: Date,
  focusStart: Date,
  focusEnd: Date,
  tomorrowEnd: Date,
  upcomingEnd: Date,
  blockedTaskIds: Set<string>,
  options?: TodayFocusQueryOptions,
): AgentTaskQueryItem[] {
  const taskIdsWithOpenSubTasks = new Set(
    rawData.allSubTasks.filter((subTask) => !subTask.completed).map((subTask) => subTask.task_id),
  )

  return rawData.allTasks
    .filter((task) => task.status === "ACTIVE" || task.status === "INBOX")
    .filter((task) => !blockedTaskIds.has(task.id))
    .filter((task) => !taskIdsWithOpenSubTasks.has(task.id))
    .filter((task) => {
      if (options?.strictToday) {
        return isTodayFocusCandidate(
          task.due_date,
          todayStart,
          focusStart,
          focusEnd,
          upcomingEnd,
          task.start_date,
          task.updated_at,
          options,
        )
      }

      if ((options?.dayOffset ?? 0) > 0) {
        return isTodayFocusCandidate(
          task.due_date,
          todayStart,
          focusStart,
          focusEnd,
          upcomingEnd,
          task.start_date,
          task.updated_at,
          options,
        )
      }

      return isTodayFocusCandidate(task.due_date, todayStart, focusStart, focusEnd, upcomingEnd, task.start_date, task.updated_at)
        || (!task.due_date && rawData.unscheduledTasks.some((unscheduledTask) => unscheduledTask.id === task.id))
        || (task.due_date !== null && task.due_date < tomorrowEnd)
    })
    .map((task) => ({
      id: task.id,
      title: task.content,
      sourceType: "task" as const,
      productName: task.product_name,
      dueDate: task.due_date?.toISOString(),
      urgency: inferUrgency(task.due_date, todayStart),
      relatedTaskId: task.id,
    }))
}

function isTodayFocusCandidate(
  dueDate: Date | null,
  todayStart: Date,
  focusStart: Date,
  focusEnd: Date,
  upcomingEnd: Date,
  startDate: Date | null,
  updatedAt: Date,
  options?: TodayFocusQueryOptions,
): boolean {
  if ((options?.dayOffset ?? 0) > 0) {
    if (!dueDate) return false
    return dueDate >= focusStart && dueDate < focusEnd
  }

  if (options?.strictToday) {
    if (!dueDate) return false
    return dueDate < new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  }

  if (dueDate && dueDate < upcomingEnd) return true
  if (startDate && startDate <= todayStart) return true
  return dueDate === null && updatedAt >= todayStart
}

function buildGroupedSummary(
  queryType: AgentTaskQueryResult["queryType"],
  items: AgentTaskQueryItem[],
): QueryGroupSummary[] {
  const counts = new Map<string, number>()

  if (queryType === "completed_today") {
    for (const item of items) {
      const label = sourceLabel(item.sourceType)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
  } else {
    for (const item of items) {
      const label = urgencyLabel(item.urgency)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((lhs, rhs) => groupedSummaryPriority(queryType, lhs.label) - groupedSummaryPriority(queryType, rhs.label))
}

function sourceLabel(sourceType: AgentTaskQueryItem["sourceType"]): string {
  switch (sourceType) {
    case "sub_task":
      return "SubTask"
    case "daily_plan_item":
      return "Daily Plan"
    default:
      return "Task"
  }
}

function urgencyLabel(urgency?: AgentTaskQueryItem["urgency"]): string {
  switch (urgency) {
    case "overdue":
      return "逾期"
    case "today":
      return "今天"
    case "tomorrow":
      return "明天"
    case "upcoming":
      return "近期"
    default:
      return "未排程"
  }
}

function groupedSummaryPriority(
  queryType: AgentTaskQueryResult["queryType"],
  label: string,
): number {
  if (queryType === "completed_today") {
    switch (label) {
      case "Task":
        return 0
      case "SubTask":
        return 1
      case "Daily Plan":
        return 2
      default:
        return 99
    }
  }

  switch (label) {
    case "逾期":
      return 0
    case "今天":
      return 1
    case "明天":
      return 2
    case "近期":
      return 3
    default:
      return 4
  }
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
            id: true,
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
      relatedTaskId: row.task.id,
      relatedSubTaskId: row.id,
    }))
  }

  async getCompletedDailyPlanItems(
    userId: string,
    start: Date,
    end: Date,
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

    return rows.map((row) => ({
      id: row.id,
      title: row.content,
      sourceType: "daily_plan_item",
      productName: row.product_name,
      completedAt: row.completed_at?.toISOString(),
      relatedTaskId: row.task_id,
      relatedSubTaskId: row.sub_task_id ?? undefined,
    }))
  }
}

class PrismaTodayFocusExtraSource implements TodayFocusExtraSource {
  async getTodayFocusDailyPlanItems(userId: string, focusDate: Date): Promise<AgentTaskQueryItem[]> {
    const rows = await prisma.dailyPlanItem.findMany({
      where: {
        completed: false,
        deferred: false,
        plan: {
          user_id: userId,
          plan_date: focusDate,
        },
      },
      orderBy: [
        { pinned: "desc" },
        { order: "asc" },
      ],
      select: {
        id: true,
        content: true,
        product_name: true,
        due_date: true,
        task_id: true,
        sub_task_id: true,
      },
    })

    return rows.map((row) => ({
      id: row.id,
      title: row.content,
      sourceType: "daily_plan_item",
      productName: row.product_name,
      dueDate: row.due_date?.toISOString(),
      urgency: inferUrgency(row.due_date, focusDate),
      relatedTaskId: row.task_id,
      relatedSubTaskId: row.sub_task_id ?? undefined,
    }))
  }
}

function compareTodayFocusItems(lhs: AgentTaskQueryItem, rhs: AgentTaskQueryItem): number {
  const urgencyPriority = urgencyPriorityForTodayFocus(lhs.urgency) - urgencyPriorityForTodayFocus(rhs.urgency)
  if (urgencyPriority !== 0) return urgencyPriority

  const sourcePriority = sourcePriorityForTodayFocus(lhs.sourceType) - sourcePriorityForTodayFocus(rhs.sourceType)
  if (sourcePriority !== 0) return sourcePriority

  const lhsDue = lhs.dueDate ? new Date(lhs.dueDate).getTime() : Number.MAX_SAFE_INTEGER
  const rhsDue = rhs.dueDate ? new Date(rhs.dueDate).getTime() : Number.MAX_SAFE_INTEGER
  return lhsDue - rhsDue
}

function sourcePriorityForTodayFocus(sourceType: AgentTaskQueryItem["sourceType"]): number {
  switch (sourceType) {
    case "daily_plan_item":
      return 0
    case "sub_task":
      return 1
    default:
      return 2
  }
}

function urgencyPriorityForTodayFocus(urgency?: AgentTaskQueryItem["urgency"]): number {
  switch (urgency) {
    case "overdue":
      return 0
    case "today":
      return 1
    case "tomorrow":
      return 2
    case "upcoming":
      return 3
    default:
      return 4
  }
}

export function serializeQueryFacts(result: AgentTaskQueryResult) {
  return {
    queryType: result.queryType,
    scopeLabel: result.scopeLabel,
    timezone: result.timezone,
    coverage: result.coverage,
    totalCount: result.totalCount,
    displayCount: result.displayCount,
    truncated: result.truncated,
    groupedSummary: result.groupedSummary,
    items: result.items,
    presentedEntities: result.items.map((item, index) => ({
      position: index + 1,
      title: item.title,
      entityId: item.id,
      entityType: item.sourceType,
      taskId: item.relatedTaskId,
      subTaskId: item.relatedSubTaskId,
    })),
  }
}

export function serializeQueryToolResult(result: AgentTaskQueryResult): string {
  return serializeFactsSummary(serializeQueryFacts(result), result.summary)
}
