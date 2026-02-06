/**
 * date-utils 單元測試
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { safeToISOString, safeToISOStringRequired } from '@/lib/date-utils'

describe('safeToISOString', () => {
  // 用於捕捉 console.warn 的 spy
  let consoleWarnSpy: any

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  describe('正常路徑', () => {
    it('應該正確轉換有效日期為 ISO 字串', () => {
      const date = new Date('2025-01-15T10:30:00.000Z')
      const result = safeToISOString(date)

      expect(result).toBe('2025-01-15T10:30:00.000Z')
    })

    it('應該處理不同的有效日期', () => {
      const date1 = new Date('2020-12-31T23:59:59.999Z')
      const date2 = new Date('1970-01-01T00:00:00.000Z')

      expect(safeToISOString(date1)).toBe('2020-12-31T23:59:59.999Z')
      expect(safeToISOString(date2)).toBe('1970-01-01T00:00:00.000Z')
    })
  })

  describe('邊界條件', () => {
    it('應該返回 null 當 date 為 null', () => {
      const result = safeToISOString(null)
      expect(result).toBeNull()
    })

    it('應該返回 null 當 date 為 undefined', () => {
      const result = safeToISOString(undefined)
      expect(result).toBeNull()
    })

    it('應該返回 null 當 date 無效（Invalid Date）', () => {
      const invalidDate = new Date('invalid-date-string')
      const result = safeToISOString(invalidDate)

      expect(result).toBeNull()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[date-utils] Invalid date detected:',
        invalidDate
      )
    })
  })

  describe('錯誤處理', () => {
    it('應該記錄 console.warn 當日期無效', () => {
      const invalidDate = new Date('not a date')
      safeToISOString(invalidDate)

      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('[date-utils] Invalid date detected')
    })

    it('應該捕捉 toISOString() 拋出的異常並返回 null', () => {
      // 建立一個會讓 toISOString() 拋出異常的物件
      const fakeDate = {
        getTime: () => 1234567890,
        toISOString: () => {
          throw new Error('Simulated toISOString error')
        },
      } as unknown as Date

      const result = safeToISOString(fakeDate)

      expect(result).toBeNull()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[date-utils] Error converting date:',
        expect.any(Error)
      )
    })
  })
})

describe('safeToISOStringRequired', () => {
  let consoleWarnSpy: any

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  describe('正常路徑', () => {
    it('應該正確轉換有效日期為 ISO 字串', () => {
      const date = new Date('2025-01-15T10:30:00.000Z')
      const result = safeToISOStringRequired(date)

      expect(result).toBe('2025-01-15T10:30:00.000Z')
    })
  })

  describe('Fallback 邏輯', () => {
    it('應該返回當前時間（而非 null）當 date 為 null', () => {
      const beforeCall = new Date().toISOString()
      // @ts-expect-error - 測試型別不匹配情況
      const result = safeToISOStringRequired(null)
      const afterCall = new Date().toISOString()

      expect(result).not.toBeNull()
      expect(result).toBeTruthy()
      // 驗證返回的時間在測試執行期間
      expect(result >= beforeCall && result <= afterCall).toBe(true)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[date-utils] Missing required date, using current time'
      )
    })

    it('應該返回當前時間當 date 無效', () => {
      const invalidDate = new Date('invalid-date-string')
      const beforeCall = new Date().toISOString()
      const result = safeToISOStringRequired(invalidDate)
      const afterCall = new Date().toISOString()

      expect(result).not.toBeNull()
      expect(result).toBeTruthy()
      expect(result >= beforeCall && result <= afterCall).toBe(true)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[date-utils] Invalid required date detected, using current time:',
        invalidDate
      )
    })

    it('應該返回當前時間當 toISOString() 拋出異常', () => {
      const fakeDate = {
        getTime: () => 1234567890,
        toISOString: () => {
          throw new Error('Simulated toISOString error')
        },
      } as unknown as Date

      const beforeCall = new Date().toISOString()
      const result = safeToISOStringRequired(fakeDate)
      const afterCall = new Date().toISOString()

      expect(result).not.toBeNull()
      expect(result >= beforeCall && result <= afterCall).toBe(true)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[date-utils] Error converting required date:',
        expect.any(Error)
      )
    })
  })

  describe('驗證永遠有返回值', () => {
    it('應該永遠返回有效的 ISO 字串（不為 null）', () => {
      const validDate = new Date('2025-01-15T10:30:00.000Z')
      const invalidDate = new Date('invalid')
      // @ts-expect-error - 測試型別不匹配情況
      const nullDate = null

      const result1 = safeToISOStringRequired(validDate)
      const result2 = safeToISOStringRequired(invalidDate)
      const result3 = safeToISOStringRequired(nullDate)

      expect(result1).not.toBeNull()
      expect(result2).not.toBeNull()
      expect(result3).not.toBeNull()

      // 驗證都是有效的 ISO 字串格式
      expect(() => new Date(result1)).not.toThrow()
      expect(() => new Date(result2)).not.toThrow()
      expect(() => new Date(result3)).not.toThrow()

      expect(new Date(result1).toISOString()).toBe(result1)
      expect(new Date(result2).toISOString()).toBe(result2)
      expect(new Date(result3).toISOString()).toBe(result3)
    })
  })
})
