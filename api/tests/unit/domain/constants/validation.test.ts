/**
 * Validation Constants 單元測試
 */

import { describe, it, expect } from 'vitest'
import {
  UUID_PATTERN,
  isValidUUID,
  validateUUID,
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
})
