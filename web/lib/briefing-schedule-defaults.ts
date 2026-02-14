/**
 * 晨報/晚報時間窗口預設值
 */

import { BriefingSchedule } from '@/domain/entities/user.entity'

export const DEFAULT_BRIEFING_SCHEDULE: BriefingSchedule = {
  morning: {
    enabled: true,
    windowStart: 7,
    windowEnd: 14,
  },
  evening: {
    enabled: true,
    windowStart: 19,
    windowEnd: 24,
  },
}
