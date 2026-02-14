/**
 * Scenario A.6: Cursor 自動參考知識庫 + 任務脈絡
 *
 * 用戶在 Cursor 中寫程式，AI 自動讀取：
 * - zentropy://areas 了解用戶的領域結構
 * - zentropy://context/now 了解全局狀態
 *
 * 驗證：
 * 1. areas resource 返回 Area→Product→Topic 階層
 * 2. context/now 返回全局摘要 + open_loops + stalled_items + estimation_bias
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    area: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Taipei' }),
    },
  },
}))

import { GetAreasHierarchyUseCase } from '@/application/use-cases/mcp/get-areas-hierarchy'
import { GetContextNowUseCase } from '@/application/use-cases/mcp/get-context-now'
import { prisma } from '@/lib/db'

const mockAreaFindMany = prisma.area.findMany as any
const mockQueryRaw = prisma.$queryRaw as any

describe('Scenario A.6: Cursor 自動參考知識庫 + 任務脈絡', () => {
  describe('GetAreasHierarchyUseCase — 領域結構', () => {
    let useCase: GetAreasHierarchyUseCase

    beforeEach(() => {
      vi.clearAllMocks()
      useCase = new GetAreasHierarchyUseCase()
    })

    it('應返回 Area→Product→Topic 階層結構', async () => {
      mockAreaFindMany.mockResolvedValue([
        {
          id: 'area-1',
          name: 'Work',
          products: [
            {
              id: 'prod-1',
              name: 'Zentropy',
              status: 'ACTIVE',
              topics: [
                { id: 'topic-1', name: 'Architecture' },
                { id: 'topic-2', name: 'Frontend' },
              ],
              _count: { tasks: 12 },
            },
            {
              id: 'prod-2',
              name: 'Client-A Project',
              status: 'ACTIVE',
              topics: [
                { id: 'topic-3', name: 'API Integration' },
              ],
              _count: { tasks: 5 },
            },
          ],
        },
        {
          id: 'area-2',
          name: 'Personal',
          products: [
            {
              id: 'prod-3',
              name: 'Health',
              status: 'MAINTAIN',
              topics: [
                { id: 'topic-4', name: 'Exercise' },
              ],
              _count: { tasks: 2 },
            },
          ],
        },
      ])

      const result = await useCase.execute({ userId: 'user-1' })

      // Assert: 階層結構
      expect(result.areas).toHaveLength(2)

      // Work area
      const work = result.areas[0]
      expect(work.name).toBe('Work')
      expect(work.products).toHaveLength(2)

      // Zentropy product
      const zentropy = work.products[0]
      expect(zentropy.name).toBe('Zentropy')
      expect(zentropy.topics).toEqual(['Architecture', 'Frontend'])
      expect(zentropy.active_actions).toBe(12)
      expect(zentropy.status).toBe('active')

      // Personal area
      const personal = result.areas[1]
      expect(personal.name).toBe('Personal')
      expect(personal.products[0].name).toBe('Health')
      expect(personal.products[0].status).toBe('maintain')
    })

    it('沒有 area 時回傳空陣列', async () => {
      mockAreaFindMany.mockResolvedValue([])

      const result = await useCase.execute({ userId: 'user-1' })

      expect(result.areas).toEqual([])
    })
  })

  describe('GetContextNowUseCase — 全局狀態', () => {
    let useCase: GetContextNowUseCase

    beforeEach(() => {
      vi.clearAllMocks()
      useCase = new GetContextNowUseCase()
    })

    it('應返回全局狀態摘要', async () => {
      // Mock aggregator queries — the use case uses CoachDataAggregator internally
      // We need to mock the 7 parallel queries
      // For simplicity, mock $queryRaw to return appropriate data per call
      let callCount = 0
      mockQueryRaw.mockImplementation(() => {
        callCount++
        switch (callCount) {
          case 1: // calendar events
            return Promise.resolve([])
          case 2: // overdue tasks
            return Promise.resolve([{
              id: 'task-overdue',
              content: '逾期任務',
              status: 'ACTIVE',
              due_date: new Date('2026-02-10'),
              updated_at: new Date('2026-02-05'),
              area_name: 'Work',
              product_name: 'Zentropy',
              urgency_level: 'high',
              estimated_minutes: 60,
            }])
          case 3: // approaching tasks
            return Promise.resolve([{
              id: 'task-approaching-1',
              content: '即將到期 1',
              status: 'ACTIVE',
              due_date: new Date('2026-02-14'),
              updated_at: new Date('2026-02-12'),
              area_name: 'Work',
              product_name: 'Zentropy',
              urgency_level: 'medium',
              estimated_minutes: 120,
            }, {
              id: 'task-approaching-2',
              content: '即將到期 2',
              status: 'ACTIVE',
              due_date: new Date('2026-02-15'),
              updated_at: new Date('2026-02-12'),
              area_name: 'Work',
              product_name: 'Client-A',
              urgency_level: null,
              estimated_minutes: null,
            }])
          case 4: // completed tasks
            return Promise.resolve([])
          case 5: // remaining tasks (all active)
            return Promise.resolve([
              { id: 't1', content: 'task1', status: 'ACTIVE', due_date: null, updated_at: new Date(), area_name: 'Work', product_name: 'Z', urgency_level: null, estimated_minutes: null },
              { id: 't2', content: 'task2', status: 'ACTIVE', due_date: null, updated_at: new Date(), area_name: 'Work', product_name: 'Z', urgency_level: null, estimated_minutes: null },
              { id: 't3', content: 'task3', status: 'ACTIVE', due_date: null, updated_at: new Date(), area_name: 'Work', product_name: 'Z', urgency_level: null, estimated_minutes: null },
              { id: 't4', content: 'task4', status: 'INBOX', due_date: null, updated_at: new Date(), area_name: 'Personal', product_name: 'H', urgency_level: null, estimated_minutes: null },
              { id: 't5', content: 'task5', status: 'ACTIVE', due_date: null, updated_at: new Date(), area_name: 'Work', product_name: 'Z', urgency_level: null, estimated_minutes: null },
            ])
          case 6: // stagnant products
            return Promise.resolve([{
              id: 'prod-stagnant',
              name: '停滯產品',
              area_name: 'Work',
              last_task_updated_at: new Date('2026-01-20'),
            }])
          case 7: // stuck subtasks
            return Promise.resolve([])
          case 8: // tomorrow preview
            return Promise.resolve([])
          case 9: // calibration data (CoachCalibration.calculate)
            return Promise.resolve([
              { area_name: 'Work', estimated_minutes: 100, actual_minutes: 140 },
              { area_name: 'Work', estimated_minutes: 100, actual_minutes: 140 },
              { area_name: 'Work', estimated_minutes: 100, actual_minutes: 140 },
            ])
          default:
            return Promise.resolve([])
        }
      })

      const result = await useCase.execute({ userId: 'user-1' })

      // Assert: context/now 格式
      expect(result.generated_at).toBeDefined()
      expect(result.open_loops).toBeGreaterThanOrEqual(5)
      expect(result.due_today).toBeGreaterThanOrEqual(0)
      expect(result.overdue).toBe(1)
      expect(result.stalled_items).toBeDefined()
      expect(result.stalled_items.length).toBeGreaterThanOrEqual(0)
      expect(result.estimation_bias).toBeDefined()
      expect(result.estimation_bias.overall).toBeCloseTo(1.4, 1)
    })

    it('全空時回傳安全的預設值', async () => {
      mockQueryRaw.mockResolvedValue([])

      const result = await useCase.execute({ userId: 'user-1' })

      expect(result.generated_at).toBeDefined()
      expect(result.open_loops).toBe(0)
      expect(result.due_today).toBe(0)
      expect(result.overdue).toBe(0)
      expect(result.stalled_items).toEqual([])
      expect(result.estimation_bias.overall).toBe(1.0)
    })
  })
})
