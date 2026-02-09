/**
 * Validation Constants 單元測試
 */

import { describe, it, expect } from 'vitest'
import {
  UUID_PATTERN,
  isValidUUID,
  validateUUID,
  sanitizeText,
} from '@/domain/constants/validation'

describe('Validation Constants', () => {
  describe('UUID_PATTERN', () => {
    it('應該匹配有效的 UUID v4', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '550e8400-e29b-41d4-a716-446655440000',
      ]

      validUUIDs.forEach((uuid) => {
        expect(UUID_PATTERN.test(uuid)).toBe(true)
      })
    })

    it('應該拒絕無效的 UUID 格式', () => {
      const invalidUUIDs = [
        'invalid-uuid',
        '123',
        '',
        'not-a-uuid-at-all',
        '123e4567-e89b-12d3-a456', // 太短
        '123e4567-e89b-12d3-a456-426614174000-extra', // 太長
      ]

      invalidUUIDs.forEach((uuid) => {
        expect(UUID_PATTERN.test(uuid)).toBe(false)
      })
    })
  })

  describe('isValidUUID', () => {
    it('應該返回 true 對於有效的 UUID', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '550e8400-e29b-41d4-a716-446655440000',
      ]

      validUUIDs.forEach((uuid) => {
        expect(isValidUUID(uuid)).toBe(true)
      })
    })

    it('應該返回 false 對於無效的 UUID', () => {
      const invalidUUIDs = [
        'invalid-uuid',
        '123',
        '',
        'not-a-uuid-at-all',
      ]

      invalidUUIDs.forEach((uuid) => {
        expect(isValidUUID(uuid)).toBe(false)
      })
    })

    it('應該不區分大小寫', () => {
      const uuid = '123E4567-E89B-12D3-A456-426614174000'
      expect(isValidUUID(uuid)).toBe(true)
      expect(isValidUUID(uuid.toLowerCase())).toBe(true)
    })
  })

  describe('validateUUID', () => {
    it('應該不拋出錯誤對於有效的 UUID', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000'
      expect(() => validateUUID(validUUID)).not.toThrow()
    })

    it('應該拋出錯誤對於無效的 UUID', () => {
      const invalidUUID = 'invalid-uuid'
      expect(() => validateUUID(invalidUUID)).toThrow('Invalid id: must be a valid UUID')
    })

    it('應該使用自訂欄位名稱在錯誤訊息中', () => {
      const invalidUUID = 'invalid-uuid'
      expect(() => validateUUID(invalidUUID, 'taskId')).toThrow(
        'Invalid taskId: must be a valid UUID'
      )
      expect(() => validateUUID(invalidUUID, 'productId')).toThrow(
        'Invalid productId: must be a valid UUID'
      )
    })

    it('應該預設使用 "id" 作為欄位名稱', () => {
      const invalidUUID = 'invalid-uuid'
      expect(() => validateUUID(invalidUUID)).toThrow(
        'Invalid id: must be a valid UUID'
      )
    })
  })

  describe('sanitizeText', () => {
    describe('正常路徑', () => {
      it('應該返回清理後的文字', () => {
        expect(sanitizeText('買牛奶')).toBe('買牛奶')
      })

      it('應該 trim 前後空白', () => {
        expect(sanitizeText('  買牛奶  ')).toBe('買牛奶')
      })

      it('應該保留換行和 tab', () => {
        expect(sanitizeText('第一行\n第二行\t項目')).toBe('第一行\n第二行\t項目')
      })

      it('應該允許含有 null 的長文字（如 "null pointer exception 修復"）', () => {
        expect(sanitizeText('null pointer exception 修復')).toBe('null pointer exception 修復')
      })
    })

    describe('型別驗證', () => {
      it('應該拒絕 null', () => {
        expect(() => sanitizeText(null)).toThrow('text is required')
      })

      it('應該拒絕 undefined', () => {
        expect(() => sanitizeText(undefined)).toThrow('text is required')
      })

      it('應該拒絕數字', () => {
        expect(() => sanitizeText(123)).toThrow('text must be a string')
      })

      it('應該拒絕物件', () => {
        expect(() => sanitizeText({ text: 'hello' })).toThrow('text must be a string')
      })

      it('當 required=false 時允許 null 返回空字串', () => {
        expect(sanitizeText(null, { required: false })).toBe('')
        expect(sanitizeText(undefined, { required: false })).toBe('')
      })
    })

    describe('無意義值過濾', () => {
      it('應該拒絕字串 "null"', () => {
        expect(() => sanitizeText('null')).toThrow('無效的輸入內容')
      })

      it('應該拒絕字串 "undefined"', () => {
        expect(() => sanitizeText('undefined')).toThrow('無效的輸入內容')
      })

      it('應該拒絕字串 "NaN"（不分大小寫）', () => {
        expect(() => sanitizeText('NaN')).toThrow('無效的輸入內容')
        expect(() => sanitizeText('nan')).toThrow('無效的輸入內容')
      })

      it('應該拒絕字串 "[object Object]"', () => {
        expect(() => sanitizeText('[object Object]')).toThrow('無效的輸入內容')
      })

      it('應該拒絕字串 "true" 和 "false"', () => {
        expect(() => sanitizeText('true')).toThrow('無效的輸入內容')
        expect(() => sanitizeText('false')).toThrow('無效的輸入內容')
      })

      it('應該拒絕字串 "NULL"（大寫）', () => {
        expect(() => sanitizeText('NULL')).toThrow('無效的輸入內容')
      })
    })

    describe('控制字元清理', () => {
      it('應該移除零寬字元', () => {
        expect(sanitizeText('買\u200B牛\u200B奶')).toBe('買牛奶')
      })

      it('應該移除 NUL 字元', () => {
        expect(sanitizeText('買\x00牛奶')).toBe('買牛奶')
      })

      it('應該移除 BOM', () => {
        expect(sanitizeText('\uFEFF買牛奶')).toBe('買牛奶')
      })

      it('清理後若為空白應拒絕', () => {
        expect(() => sanitizeText('\u200B\u200B')).toThrow('text is required')
      })
    })

    describe('長度限制', () => {
      it('應該接受小於預設長度的文字', () => {
        const text = '買牛奶'.repeat(100)
        expect(sanitizeText(text)).toBe(text)
      })

      it('應該拒絕超過預設長度限制的文字', () => {
        const text = 'a'.repeat(2001)
        expect(() => sanitizeText(text)).toThrow('字元限制')
      })

      it('應該支持自訂長度限制', () => {
        expect(() => sanitizeText('abcdef', { maxLength: 5 })).toThrow('字元限制')
        expect(sanitizeText('abcde', { maxLength: 5 })).toBe('abcde')
      })
    })

    describe('自訂欄位名稱', () => {
      it('應該在錯誤訊息中使用自訂欄位名稱', () => {
        expect(() => sanitizeText(null, { fieldName: 'content' })).toThrow('content is required')
        expect(() => sanitizeText(123, { fieldName: 'content' })).toThrow('content must be a string')
      })
    })
  })
})
