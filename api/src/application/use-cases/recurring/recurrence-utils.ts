import type { RecurrenceRule } from '@/domain/interfaces/recurring-task-repository'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

function toMidnightUTC(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function normalizeToUTCDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * 計算在 fromDate（含）之後的第一個符合 rule 的發生日期
 * 若無符合日期（超過 endDate）則回傳 null
 */
export function computeNextOccurrence(rule: RecurrenceRule, fromDate: Date): Date | null {
  const intervalRaw = rule.interval
  if (!Number.isFinite(intervalRaw) || intervalRaw < 1 || intervalRaw > 365) {
    throw new Error(`Invalid recurrence interval: ${intervalRaw}`)
  }

  const startDate = toMidnightUTC(rule.startDate)
  const endDate = rule.endDate ? toMidnightUTC(rule.endDate) : null
  const interval = Math.floor(intervalRaw)

  // 以 UTC 日期為基準
  let candidate = normalizeToUTCDate(fromDate)
  if (candidate < startDate) candidate = startDate
  if (endDate && candidate > endDate) return null

  switch (rule.frequency) {
    case 'DAILY': {
      const daysDiff = Math.round((candidate.getTime() - startDate.getTime()) / MS_PER_DAY)
      const remainder = daysDiff % interval
      if (remainder !== 0) {
        candidate = addDays(candidate, interval - remainder)
      }
      break
    }

    case 'WEEKLY': {
      const dows = rule.daysOfWeek || []
      if (dows.length === 0) return null

      let found: Date | null = null
      // 最多搜尋 14 週
      for (let i = 0; i < 7 * 14; i++) {
        const dow = candidate.getUTCDay()
        if (dows.includes(dow)) {
          if (interval === 1) {
            found = candidate
            break
          }
          // 計算從 startDate 算起第幾週（以週一為準，取 floor）
          const weeksDiff = Math.floor(
            (candidate.getTime() - startDate.getTime()) / (7 * MS_PER_DAY)
          )
          if (weeksDiff % interval === 0) {
            found = candidate
            break
          }
        }
        candidate = addDays(candidate, 1)
      }
      if (!found) return null
      candidate = found
      break
    }

    case 'MONTHLY': {
      const dom = rule.dayOfMonth || 1
      let year = candidate.getUTCFullYear()
      let month = candidate.getUTCMonth()

      let found: Date | null = null
      for (let attempts = 0; attempts < 24; attempts++) {
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
        const actualDom = Math.min(dom, daysInMonth)
        const tryDate = new Date(Date.UTC(year, month, actualDom))

        if (tryDate >= candidate) {
          // 檢查月份間隔對齊
          const startMonthDate = toMidnightUTC(rule.startDate)
          const monthsDiff =
            (year - startMonthDate.getUTCFullYear()) * 12 +
            (month - startMonthDate.getUTCMonth())

          if (monthsDiff % interval === 0) {
            found = tryDate
            break
          }
        }

        // 移到下一個月
        month++
        if (month > 11) {
          month = 0
          year++
        }
      }
      if (!found) return null
      candidate = found
      break
    }

    default:
      return null
  }

  if (endDate && candidate > endDate) return null
  return candidate
}

/**
 * 計算 currentOccurrence 之後的下一次發生日期
 */
export function computeNextOccurrenceAfter(
  rule: RecurrenceRule,
  currentOccurrence: Date
): Date | null {
  return computeNextOccurrence(rule, addDays(currentOccurrence, 1))
}
