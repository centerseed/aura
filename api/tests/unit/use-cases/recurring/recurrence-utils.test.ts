import { describe, it, expect } from 'vitest'
import {
  computeNextOccurrence,
  computeNextOccurrenceAfter,
} from '@/application/use-cases/recurring/recurrence-utils'
import type { RecurrenceRule } from '@/domain/interfaces/recurring-task-repository'

function utcDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

describe('computeNextOccurrence', () => {
  describe('DAILY', () => {
    const base: RecurrenceRule = {
      frequency: 'DAILY',
      interval: 1,
      timezone: 'Asia/Taipei',
      startDate: '2026-01-01',
    }

    it('interval=1：fromDate 本身就是有效日', () => {
      expect(computeNextOccurrence(base, utcDate('2026-03-05'))).toEqual(utcDate('2026-03-05'))
    })

    it('interval=2：fromDate 對齊時直接返回', () => {
      // daysDiff(2026-01-05 - 2026-01-01) = 4, 4%2 = 0
      const rule: RecurrenceRule = { ...base, interval: 2 }
      expect(computeNextOccurrence(rule, utcDate('2026-01-05'))).toEqual(utcDate('2026-01-05'))
    })

    it('interval=2：fromDate 不對齊時跳到下一個對齊日', () => {
      // daysDiff = 5, 5%2 = 1 → add (2-1)=1 day → 2026-01-07
      const rule: RecurrenceRule = { ...base, interval: 2 }
      expect(computeNextOccurrence(rule, utcDate('2026-01-06'))).toEqual(utcDate('2026-01-07'))
    })

    it('fromDate 早於 startDate 時使用 startDate', () => {
      expect(computeNextOccurrence(base, utcDate('2025-12-20'))).toEqual(utcDate('2026-01-01'))
    })

    it('candidate 超過 endDate 時返回 null', () => {
      const rule: RecurrenceRule = { ...base, interval: 2, endDate: '2026-01-10' }
      // fromDate=2026-01-11 > endDate → null at initial guard
      expect(computeNextOccurrence(rule, utcDate('2026-01-11'))).toBeNull()
    })

    it('interval 為 0 時拋出錯誤', () => {
      const rule: RecurrenceRule = { ...base, interval: 0 }
      expect(() => computeNextOccurrence(rule, new Date())).toThrow('Invalid recurrence interval')
    })

    it('interval 為 366 時拋出錯誤', () => {
      const rule: RecurrenceRule = { ...base, interval: 366 }
      expect(() => computeNextOccurrence(rule, new Date())).toThrow('Invalid recurrence interval')
    })

    it('interval 為小數時向下取整後正常運作', () => {
      const rule: RecurrenceRule = { ...base, interval: 2.9 }
      // floor(2.9) = 2，daysDiff(2026-01-05)=4, 4%2=0
      expect(computeNextOccurrence(rule, utcDate('2026-01-05'))).toEqual(utcDate('2026-01-05'))
    })
  })

  describe('WEEKLY', () => {
    const base: RecurrenceRule = {
      frequency: 'WEEKLY',
      interval: 1,
      daysOfWeek: [1], // 週一
      timezone: 'Asia/Taipei',
      startDate: '2026-03-02', // 週一
    }

    it('找到下一個符合的星期幾', () => {
      // 2026-03-05 是週四，下一個週一 = 2026-03-09
      expect(computeNextOccurrence(base, utcDate('2026-03-05'))).toEqual(utcDate('2026-03-09'))
    })

    it('fromDate 本身就是符合的星期幾時直接返回', () => {
      // 2026-03-02 是週一
      expect(computeNextOccurrence(base, utcDate('2026-03-02'))).toEqual(utcDate('2026-03-02'))
    })

    it('多個 daysOfWeek：返回最近的一個', () => {
      // 2026-03-05 是週四，週六(6)=2026-03-07，週日(0)=2026-03-08 → 返回 2026-03-07
      const rule: RecurrenceRule = { ...base, daysOfWeek: [0, 6] }
      expect(computeNextOccurrence(rule, utcDate('2026-03-05'))).toEqual(utcDate('2026-03-07'))
    })

    it('interval=2：跳過不對齊的週', () => {
      // startDate=2026-03-02(週一), fromDate=2026-03-05(週四)
      // 2026-03-09(週一) weeksDiff=1, 1%2≠0 → skip
      // 2026-03-16(週一) weeksDiff=2, 2%2=0 → valid
      const rule: RecurrenceRule = { ...base, interval: 2 }
      expect(computeNextOccurrence(rule, utcDate('2026-03-05'))).toEqual(utcDate('2026-03-16'))
    })

    it('daysOfWeek 為空時返回 null', () => {
      const rule: RecurrenceRule = { ...base, daysOfWeek: [] }
      expect(computeNextOccurrence(rule, utcDate('2026-03-05'))).toBeNull()
    })

    it('endDate 之前找不到有效日期時返回 null', () => {
      // 下一個週一 = 2026-03-09，endDate = 2026-03-06 → null
      const rule: RecurrenceRule = { ...base, endDate: '2026-03-06' }
      expect(computeNextOccurrence(rule, utcDate('2026-03-05'))).toBeNull()
    })
  })

  describe('MONTHLY', () => {
    const base: RecurrenceRule = {
      frequency: 'MONTHLY',
      interval: 1,
      dayOfMonth: 15,
      timezone: 'Asia/Taipei',
      startDate: '2026-01-15',
    }

    it('fromDate 在當月指定日之前：返回本月的日期', () => {
      expect(computeNextOccurrence(base, utcDate('2026-03-10'))).toEqual(utcDate('2026-03-15'))
    })

    it('fromDate 在當月指定日之後：返回下個月的日期', () => {
      expect(computeNextOccurrence(base, utcDate('2026-03-20'))).toEqual(utcDate('2026-04-15'))
    })

    it('dayOfMonth 超過當月天數時使用月末', () => {
      // Feb 2026 有 28 天
      const rule: RecurrenceRule = { ...base, dayOfMonth: 31, startDate: '2026-01-31' }
      expect(computeNextOccurrence(rule, utcDate('2026-02-01'))).toEqual(utcDate('2026-02-28'))
    })

    it('interval=2：跳過不對齊的月份', () => {
      // startDate=Jan, Feb monthsDiff=1, 1%2≠0 → skip; Mar monthsDiff=2, 2%2=0 → valid
      const rule: RecurrenceRule = { ...base, interval: 2 }
      expect(computeNextOccurrence(rule, utcDate('2026-02-01'))).toEqual(utcDate('2026-03-15'))
    })

    it('endDate 後找不到有效日期時返回 null', () => {
      const rule: RecurrenceRule = { ...base, endDate: '2026-03-14' }
      // fromDate=2026-03-10, candidate=2026-03-15 > endDate → null
      expect(computeNextOccurrence(rule, utcDate('2026-03-10'))).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('未知 frequency 返回 null', () => {
      const rule = {
        frequency: 'HOURLY' as any,
        interval: 1,
        timezone: 'Asia/Taipei',
        startDate: '2026-01-01',
      }
      expect(computeNextOccurrence(rule, new Date())).toBeNull()
    })
  })
})

describe('computeNextOccurrenceAfter', () => {
  it('DAILY interval=1：返回隔天', () => {
    const rule: RecurrenceRule = {
      frequency: 'DAILY',
      interval: 1,
      timezone: 'Asia/Taipei',
      startDate: '2026-01-01',
    }
    expect(computeNextOccurrenceAfter(rule, utcDate('2026-03-05'))).toEqual(utcDate('2026-03-06'))
  })

  it('WEEKLY：跳到下一個符合的星期', () => {
    const rule: RecurrenceRule = {
      frequency: 'WEEKLY',
      interval: 1,
      daysOfWeek: [1], // 週一
      timezone: 'Asia/Taipei',
      startDate: '2026-03-02',
    }
    // After 2026-03-09(週一), next Monday = 2026-03-16
    expect(computeNextOccurrenceAfter(rule, utcDate('2026-03-09'))).toEqual(utcDate('2026-03-16'))
  })

  it('超過 endDate 後返回 null', () => {
    const rule: RecurrenceRule = {
      frequency: 'DAILY',
      interval: 1,
      timezone: 'Asia/Taipei',
      startDate: '2026-01-01',
      endDate: '2026-03-05',
    }
    // currentOccurrence=2026-03-05, fromDate=2026-03-06 > endDate → null
    expect(computeNextOccurrenceAfter(rule, utcDate('2026-03-05'))).toBeNull()
  })
})
