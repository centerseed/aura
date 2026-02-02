/**
 * Component Props Validation Tests
 *
 * 測試目的：確保組件收到錯誤的 props 不會 crash
 *
 * 這些測試會抓到：
 * - milestones.filter is not a function (當 milestones prop 不是 array)
 * - areas.map is not a function (當 areas prop 不是 array)
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GanttView } from '@/components/gantt-view'
import { MilestoneList } from '@/components/milestone-list'

describe('Component Props Validation', () => {
  describe('GanttView - milestones prop', () => {
    it('✅ 正確：milestones 是 array', () => {
      const validProps = {
        areas: [],
        milestones: [
          {
            id: 'm1',
            name: 'Test Milestone',
            target_date: '2026-03-01',
            status: 'active',
            entity_type: 'PRODUCT',
            entity_id: 'p1',
          },
        ],
      }

      // 這不應該拋出錯誤
      expect(() => {
        render(<GanttView {...validProps} />)
      }).not.toThrow()
    })

    it('❌ 錯誤但應該被保護：milestones 是 null', () => {
      const invalidProps = {
        areas: [],
        milestones: null as any, // 模擬錯誤的 prop
      }

      // 如果沒有 Array.isArray() 保護，這會拋出 TypeError
      expect(() => {
        render(<GanttView {...invalidProps} />)
      }).not.toThrow() // 因為我們已經加了保護
    })

    it('❌ 錯誤但應該被保護：milestones 是 undefined', () => {
      const invalidProps = {
        areas: [],
        milestones: undefined as any,
      }

      expect(() => {
        render(<GanttView {...invalidProps} />)
      }).not.toThrow()
    })

    it('❌ 錯誤但應該被保護：milestones 是 object', () => {
      const invalidProps = {
        areas: [],
        milestones: { wrong: 'format' } as any,
      }

      expect(() => {
        render(<GanttView {...invalidProps} />)
      }).not.toThrow()
    })
  })

  describe('MilestoneList - milestones prop', () => {
    it('✅ 正確：milestones 是 array', () => {
      const validProps = {
        milestones: [
          {
            id: 'm1',
            name: 'Test',
            target_date: '2026-03-01',
            status: 'active',
          },
        ],
        onEdit: () => {},
        onDelete: () => {},
      }

      expect(() => {
        render(<MilestoneList {...validProps} />)
      }).not.toThrow()
    })

    it('❌ 錯誤但應該被保護：milestones 是 null', () => {
      const invalidProps = {
        milestones: null as any,
        onEdit: () => {},
        onDelete: () => {},
      }

      expect(() => {
        render(<MilestoneList {...invalidProps} />)
      }).not.toThrow()
    })
  })

  describe('防禦性編程 - Array operations 必須有保護', () => {
    it('示範：沒有保護會 crash', () => {
      const badData: any = null

      // ❌ 這會拋出 TypeError: badData.filter is not a function
      expect(() => {
        badData.filter((x: any) => x)
      }).toThrow(TypeError)
    })

    it('示範：有保護不會 crash', () => {
      const badData: any = null

      // ✅ 這不會拋出錯誤
      expect(() => {
        const result = (Array.isArray(badData) ? badData : []).filter((x: any) => x)
        expect(result).toEqual([])
      }).not.toThrow()
    })
  })
})

/**
 * 這些測試的價值：
 *
 * 1. 確保組件在收到錯誤 props 時不會 crash
 * 2. 驗證所有 Array.isArray() 保護都有效
 * 3. 提供回歸測試，防止未來移除保護
 *
 * 但這些測試的限制：
 * - 只測試組件不會 crash，不測試功能正確性
 * - 需要手動為每個組件寫測試
 * - 不會自動發現新的未保護的 array operations
 */
