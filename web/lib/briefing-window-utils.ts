/**
 * 晨報/晚報時間窗口判斷工具
 */

import { BriefingSchedule } from '@/domain/entities/user.entity'
import { DEFAULT_BRIEFING_SCHEDULE } from './briefing-schedule-defaults'

/**
 * 判斷當前時間是否在晨報/晚報的觀看窗口內
 * @param type - 簡報類型（'MORNING' 或 'EVENING'）
 * @param schedule - 用戶的晨報/晚報設定（undefined 時使用預設值）
 * @param currentHour - 當前用戶當地時間的小時數（0-23）
 * @returns 是否在時間窗口內
 */
export function isInBriefingWindow(
  type: 'MORNING' | 'EVENING',
  schedule: BriefingSchedule | undefined,
  currentHour: number
): boolean {
  const defaultSchedule = DEFAULT_BRIEFING_SCHEDULE
  const config =
    type === 'MORNING'
      ? schedule?.morning ?? defaultSchedule.morning
      : schedule?.evening ?? defaultSchedule.evening

  if (!config || !config.enabled) return false

  const { windowStart, windowEnd } = config

  // 處理跨日情況（例如晚報 22:00-02:00）
  if (windowEnd <= windowStart) {
    // 跨日：currentHour >= windowStart（今天晚上）或 currentHour < windowEnd（明天凌晨）
    return currentHour >= windowStart || currentHour < windowEnd
  }

  // 正常情況：windowStart <= currentHour < windowEnd
  return currentHour >= windowStart && currentHour < windowEnd
}

/**
 * 計算用戶當地時間的小時數
 * @param timezone - 用戶時區（例如 'Asia/Taipei'）
 * @returns 當前小時數（0-23）
 */
export function getCurrentLocalHour(timezone: string): number {
  return parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hourCycle: 'h23',
    }),
    10
  )
}
