/**
 * 晨報/晚報時間窗口判斷測試
 */

import { describe, it, expect } from 'vitest'
import { isInBriefingWindow } from '@/lib/briefing-window-utils'
import { BriefingSchedule } from '@/domain/entities/user.entity'

describe('isInBriefingWindow', () => {
  describe('晨報窗口（正常情況）', () => {
    const schedule: BriefingSchedule = {
      morning: {
        enabled: true,
        windowStart: 7,
        windowEnd: 14,
      },
    }

    it('應該在窗口內返回 true（8:00）', () => {
      expect(isInBriefingWindow('MORNING', schedule, 8)).toBe(true)
    })

    it('應該在窗口開始時返回 true（7:00）', () => {
      expect(isInBriefingWindow('MORNING', schedule, 7)).toBe(true)
    })

    it('應該在窗口結束前返回 true（13:00）', () => {
      expect(isInBriefingWindow('MORNING', schedule, 13)).toBe(true)
    })

    it('應該在窗口結束時返回 false（14:00）', () => {
      expect(isInBriefingWindow('MORNING', schedule, 14)).toBe(false)
    })

    it('應該在窗口外返回 false（15:00）', () => {
      expect(isInBriefingWindow('MORNING', schedule, 15)).toBe(false)
    })

    it('應該在窗口外返回 false（6:00）', () => {
      expect(isInBriefingWindow('MORNING', schedule, 6)).toBe(false)
    })
  })

  describe('晚報窗口（正常情況）', () => {
    const schedule: BriefingSchedule = {
      evening: {
        enabled: true,
        windowStart: 19,
        windowEnd: 24,
      },
    }

    it('應該在窗口內返回 true（20:00）', () => {
      expect(isInBriefingWindow('EVENING', schedule, 20)).toBe(true)
    })

    it('應該在窗口開始時返回 true（19:00）', () => {
      expect(isInBriefingWindow('EVENING', schedule, 19)).toBe(true)
    })

    it('應該在窗口結束前返回 true（23:00）', () => {
      expect(isInBriefingWindow('EVENING', schedule, 23)).toBe(true)
    })

    it('應該在窗口外返回 false（0:00）', () => {
      expect(isInBriefingWindow('EVENING', schedule, 0)).toBe(false)
    })

    it('應該在窗口外返回 false（18:00）', () => {
      expect(isInBriefingWindow('EVENING', schedule, 18)).toBe(false)
    })
  })

  describe('跨日窗口（晚報 22:00-02:00）', () => {
    const schedule: BriefingSchedule = {
      evening: {
        enabled: true,
        windowStart: 22,
        windowEnd: 2,
      },
    }

    it('應該在今天晚上窗口內返回 true（22:00）', () => {
      expect(isInBriefingWindow('EVENING', schedule, 22)).toBe(true)
    })

    it('應該在今天晚上窗口內返回 true（23:00）', () => {
      expect(isInBriefingWindow('EVENING', schedule, 23)).toBe(true)
    })

    it('應該在明天凌晨窗口內返回 true（0:00）', () => {
      expect(isInBriefingWindow('EVENING', schedule, 0)).toBe(true)
    })

    it('應該在明天凌晨窗口內返回 true（1:00）', () => {
      expect(isInBriefingWindow('EVENING', schedule, 1)).toBe(true)
    })

    it('應該在窗口結束時返回 false（2:00）', () => {
      expect(isInBriefingWindow('EVENING', schedule, 2)).toBe(false)
    })

    it('應該在窗口外返回 false（3:00）', () => {
      expect(isInBriefingWindow('EVENING', schedule, 3)).toBe(false)
    })

    it('應該在窗口外返回 false（21:00）', () => {
      expect(isInBriefingWindow('EVENING', schedule, 21)).toBe(false)
    })
  })

  describe('停用功能', () => {
    const disabledSchedule: BriefingSchedule = {
      morning: {
        enabled: false,
        windowStart: 7,
        windowEnd: 14,
      },
    }

    it('停用時應該返回 false（即使在窗口內）', () => {
      expect(isInBriefingWindow('MORNING', disabledSchedule, 10)).toBe(false)
    })
  })

  describe('無設定（使用預設值）', () => {
    it('應該使用預設晨報窗口（7-14）', () => {
      expect(isInBriefingWindow('MORNING', undefined, 8)).toBe(true)
      expect(isInBriefingWindow('MORNING', undefined, 15)).toBe(false)
    })

    it('應該使用預設晚報窗口（19-24）', () => {
      expect(isInBriefingWindow('EVENING', undefined, 20)).toBe(true)
      expect(isInBriefingWindow('EVENING', undefined, 0)).toBe(false)
    })
  })

  describe('邊界條件', () => {
    it('windowStart = 0, windowEnd = 24（全天開啟）', () => {
      const allDaySchedule: BriefingSchedule = {
        morning: {
          enabled: true,
          windowStart: 0,
          windowEnd: 24,
        },
      }
      expect(isInBriefingWindow('MORNING', allDaySchedule, 0)).toBe(true)
      expect(isInBriefingWindow('MORNING', allDaySchedule, 12)).toBe(true)
      expect(isInBriefingWindow('MORNING', allDaySchedule, 23)).toBe(true)
    })

    it('windowStart = windowEnd（視為跨日全天）', () => {
      const sameSchedule: BriefingSchedule = {
        evening: {
          enabled: true,
          windowStart: 10,
          windowEnd: 10,
        },
      }
      // windowEnd <= windowStart，視為跨日
      expect(isInBriefingWindow('EVENING', sameSchedule, 11)).toBe(true)
      expect(isInBriefingWindow('EVENING', sameSchedule, 9)).toBe(true)
    })
  })
})
