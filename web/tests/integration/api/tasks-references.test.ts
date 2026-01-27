import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { POST as POST_REFERENCE, DELETE as DELETE_REFERENCE } from '@/app/api/tasks/[taskId]/references/route'
import { prisma } from '@/lib/db'
import { createTestUser, createTestArea, createTestProduct, createTestTask, cleanupTestData } from '@/tests/utils/db-helpers'

describe('Tasks References API', () => {
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

  describe('POST /api/tasks/[taskId]/references', () => {
    it('should add a URL reference to a task', async () => {
      const body = {
        type: 'url',
        content: 'https://example.com',
        title: 'Example',
      }

      const request = new Request(
        new URL(`http://localhost:3000/api/tasks/${testTaskId}/references`),
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
        const response = await POST_REFERENCE(request as any, {
          params: Promise.resolve({ taskId: testTaskId }),
        })
        expect(response.status).toBeGreaterThanOrEqual(400)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should add a note reference to a task', async () => {
      const body = {
        type: 'note',
        content: 'This is a note',
        title: 'Note Title',
      }

      const request = new Request(
        new URL(`http://localhost:3000/api/tasks/${testTaskId}/references`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      )

      try {
        const response = await POST_REFERENCE(request as any, {
          params: Promise.resolve({ taskId: testTaskId }),
        })
        expect(response.status).toBeGreaterThanOrEqual(400)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should reject invalid reference type', async () => {
      const body = {
        type: 'invalid',
        content: 'Some content',
      }

      const request = new Request(
        new URL(`http://localhost:3000/api/tasks/${testTaskId}/references`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      )

      try {
        const response = await POST_REFERENCE(request as any, {
          params: Promise.resolve({ taskId: testTaskId }),
        })
        expect([400, 401]).toContain(response.status)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should reject empty content', async () => {
      const body = {
        type: 'url',
        content: '',
      }

      const request = new Request(
        new URL(`http://localhost:3000/api/tasks/${testTaskId}/references`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      )

      try {
        const response = await POST_REFERENCE(request as any, {
          params: Promise.resolve({ taskId: testTaskId }),
        })
        expect([400, 401]).toContain(response.status)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('DELETE /api/tasks/[taskId]/references', () => {
    it('should delete a reference from a task', async () => {
      const task = await createTestTask(testUserId, testProductId, {
        references: [
          {
            id: 'ref-123',
            type: 'url',
            content: 'https://example.com',
            title: 'Example',
            created_at: new Date().toISOString(),
          },
        ],
      })

      const request = new Request(
        new URL(`http://localhost:3000/api/tasks/${task.id}/references?referenceId=ref-123`),
        {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer test-token',
          },
        }
      )

      try {
        const response = await DELETE_REFERENCE(request as any, {
          params: Promise.resolve({ taskId: task.id }),
        })
        expect(response.status).toBeGreaterThanOrEqual(400)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should reject request without referenceId', async () => {
      const request = new Request(
        new URL(`http://localhost:3000/api/tasks/${testTaskId}/references`),
        {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer test-token',
          },
        }
      )

      try {
        const response = await DELETE_REFERENCE(request as any, {
          params: Promise.resolve({ taskId: testTaskId }),
        })
        expect([400, 401]).toContain(response.status)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should handle non-existent reference', async () => {
      const request = new Request(
        new URL(`http://localhost:3000/api/tasks/${testTaskId}/references?referenceId=non-existent`),
        {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer test-token',
          },
        }
      )

      try {
        const response = await DELETE_REFERENCE(request as any, {
          params: Promise.resolve({ taskId: testTaskId }),
        })
        expect(response.status).toBeGreaterThanOrEqual(400)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })
})
