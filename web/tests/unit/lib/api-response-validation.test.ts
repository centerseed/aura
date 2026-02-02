/**
 * API Response Validation Tests
 *
 * 測試目的：確保 API 回應格式正確，防止 runtime 錯誤
 *
 * 這些測試會抓到：
 * - libraryData.map is not a function (因為 libraryData 不是 array)
 * - milestones.filter is not a function (因為 milestones 不是 array)
 * - areas.some is not a function (因為 areas 不是 array)
 */

import { describe, it, expect } from 'vitest'
import { ApiSchemas } from '@/lib/api-schemas'

describe('API Response Format Validation', () => {
  describe('/api/library 回應格式', () => {
    it('✅ 正確格式：{ areas: [...] }', () => {
      const validResponse = {
        areas: [
          {
            id: 'area-1',
            name: 'Test Area',
            products: [],
          },
        ],
      }

      const result = ApiSchemas.library.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it('❌ 錯誤格式：直接是 array（會導致 libraryData.map error）', () => {
      const invalidResponse = [
        {
          id: 'area-1',
          name: 'Test Area',
          products: [],
        },
      ]

      const result = ApiSchemas.library.safeParse(invalidResponse)
      expect(result.success).toBe(false)
      if (!result.success) {
        console.log('Expected error:', result.error.issues[0].message)
      }
    })

    it('❌ 錯誤格式：areas 不是 array', () => {
      const invalidResponse = {
        areas: null,
      }

      const result = ApiSchemas.library.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('✅ areas 是空 array', () => {
      const validResponse = {
        areas: [],
      }

      const result = ApiSchemas.library.safeParse(validResponse)
      expect(result.success).toBe(true)
    })
  })

  describe('/api/milestones 回應格式', () => {
    it('✅ 正確格式：{ milestones: [...] }', () => {
      const validResponse = {
        milestones: [
          {
            id: 'milestone-1',
            name: 'Test Milestone',
            target_date: '2026-03-01',
            status: 'active',
          },
        ],
      }

      const result = ApiSchemas.milestones.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it('❌ 錯誤格式：直接是 array（會導致 milestones.filter error）', () => {
      const invalidResponse = [
        {
          id: 'milestone-1',
          name: 'Test Milestone',
          target_date: '2026-03-01',
          status: 'active',
        },
      ]

      const result = ApiSchemas.milestones.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('❌ 錯誤格式：milestones 不是 array', () => {
      const invalidResponse = {
        milestones: null,
      }

      const result = ApiSchemas.milestones.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })

  describe('/api/tasks 回應格式', () => {
    it('✅ 正確格式：{ tasks: [...] }', () => {
      const validResponse = {
        tasks: [
          {
            id: 'task-1',
            title: 'Test Task',
            drawer: 'ACTIVE' as const,
            product_id: 'product-1',
            due_date: null,
            completed_at: null,
          },
        ],
      }

      const result = ApiSchemas.tasks.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it('❌ 錯誤格式：直接是 array', () => {
      const invalidResponse = [
        {
          id: 'task-1',
          title: 'Test Task',
          drawer: 'ACTIVE',
          product_id: 'product-1',
          due_date: null,
          completed_at: null,
        },
      ]

      const result = ApiSchemas.tasks.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })

  describe('嵌套資料結構驗證', () => {
    it('✅ Area 包含 Products 包含 Tasks', () => {
      const validResponse = {
        areas: [
          {
            id: 'area-1',
            name: 'Test Area',
            products: [
              {
                id: 'product-1',
                name: 'Test Product',
                description: null,
                lifecycle: 'FINITE' as const,
                status: 'active',
                tasks: [
                  {
                    id: 'task-1',
                    title: 'Test Task',
                    drawer: 'ACTIVE' as const,
                    product_id: 'product-1',
                    due_date: null,
                    completed_at: null,
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = ApiSchemas.library.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it('❌ Products 不是 array（會導致 products.map error）', () => {
      const invalidResponse = {
        areas: [
          {
            id: 'area-1',
            name: 'Test Area',
            products: null, // 錯誤：不是 array
          },
        ],
      }

      const result = ApiSchemas.library.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('❌ Tasks 不是 array（會導致 tasks.filter error）', () => {
      const invalidResponse = {
        areas: [
          {
            id: 'area-1',
            name: 'Test Area',
            products: [
              {
                id: 'product-1',
                name: 'Test Product',
                lifecycle: 'FINITE',
                status: 'active',
                tasks: null, // 錯誤：不是 array
              },
            ],
          },
        ],
      }

      const result = ApiSchemas.library.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })

  describe('實際使用情境：前端代碼會這樣用', () => {
    it('✅ 正確：libraryData.areas.map(...)', () => {
      const response = {
        areas: [
          { id: 'area-1', name: 'Area 1', products: [] },
          { id: 'area-2', name: 'Area 2', products: [] },
        ],
      }

      const result = ApiSchemas.library.safeParse(response)
      expect(result.success).toBe(true)

      if (result.success) {
        // 這是前端實際會做的操作
        const areaNames = result.data.areas.map((a) => a.name)
        expect(areaNames).toEqual(['Area 1', 'Area 2'])
      }
    })

    it('✅ 正確：milestones.filter(...)', () => {
      const response = {
        milestones: [
          {
            id: 'm1',
            name: 'Milestone 1',
            target_date: '2026-03-01',
            status: 'active',
          },
          {
            id: 'm2',
            name: 'Milestone 2',
            target_date: '2026-04-01',
            status: 'completed',
          },
        ],
      }

      const result = ApiSchemas.milestones.safeParse(response)
      expect(result.success).toBe(true)

      if (result.success) {
        // 這是前端實際會做的操作
        const activeMilestones = result.data.milestones.filter((m) => m.status === 'active')
        expect(activeMilestones).toHaveLength(1)
      }
    })
  })
})
