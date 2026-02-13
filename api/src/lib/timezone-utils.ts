/**
 * 時區工具函式 — 共用的日期/時區處理
 */

import { prisma } from '@/lib/db'

/**
 * 取得指定時區某日期的 00:00:00 UTC 時間
 */
export function getStartOfDay(date: Date, timezone: string): Date {
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone })
  const midnight = new Date(`${dateStr}T00:00:00`)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  })
  const parts = formatter.formatToParts(midnight)
  const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+00:00'
  const offset = offsetStr.replace('GMT', '')
  return new Date(`${dateStr}T00:00:00.000${offset}`)
}

/**
 * 取得指定時區某日期的隔日 00:00:00 UTC 時間
 */
export function getEndOfDay(date: Date, timezone: string): Date {
  const start = getStartOfDay(date, timezone)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}

/**
 * 將日期轉為該時區的 date-only（YYYY-MM-DD 00:00:00 UTC）
 */
export function toDateOnly(date: Date, timezone: string): Date {
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone })
  return new Date(dateStr + 'T00:00:00.000Z')
}

/**
 * 從 request 或 user profile 解析時區
 */
export async function resolveTimezone(userId: string, timezone?: string): Promise<string> {
  if (timezone) return timezone

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  })

  return user?.timezone || 'Asia/Taipei'
}
