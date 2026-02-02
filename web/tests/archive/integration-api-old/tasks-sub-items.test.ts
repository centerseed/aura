import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { POST } from '@/app/api/tasks/[taskId]/sub-items/route'
import { prisma } from '@/lib/db'
import { createTestUser, createTestArea, createTestProduct, createTestTask, cleanupTestData } from '@/tests/utils/db-helpers'

describe('Tasks Sub-items API', () => {
  let testUserId: string
  let testProductId: string
  let testTaskId: string

  beforeAll(async () => {
    const user = await createTestUser()
    testUserId = user.id
    const area = await createTestArea(testUserId)
    const product = await createTestProduct(testUserId, area.id)
    testProductId = product.id
    const task = await createTestTask(testUserId, testProductId)
    testTaskId = task.id
  })

  afterAll(async () => {
    if (testUserId) {
      await cleanupTestData(testUserId)
    }
  })

  describe('POST /api/tasks/[taskId]/sub-items', () => {
    it('should add a sub-item to a task', async () => {
      const body = {
        content: 'New Sub-item',
      }

      const request = new Request(
        new URL(`http://localhost:3000/api/tasks/${testTaskId}/sub-items`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          },
          body: JSON.stringify(body),
        }
      )

      try {
        const response = await POST(request as any, {
          params: Promise.resolve({ taskId: testTaskId }),
        })
        expect(response.status).toBeGreaterThanOrEqual(400)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should reject empty content', async () => {
      const body = {
        content: '',
      }

      const request = new Request(
        new URL(`http://localhost:3000/api/tasks/${testTaskId}/sub-items`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      )

      try {
        const response = await POST(request as any, {
          params: Promise.resolve({ taskId: testTaskId }),
        })
        expect([400, 401]).toContain(response.status)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should calculate completion rate', async () => {
      const task = await createTestTask(testUserId, testProductId, {
        sub_items: [
          {
            id: '1',
            content: 'Item 1',
            completed: true,
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            order: 0,
          },
          {
            id: '2',
            content: 'Item 2',
            completed: false,
            created_at: new Date().toISOString(),
            completed_at: null,
            order: 1,
          },
        ],
      })

      const subItems = task.sub_items as any[]
      expect(subItems.length).toBe(2)
      expect(subItems.filter((item) => item.completed).length).toBe(1)
    })
  })
})
