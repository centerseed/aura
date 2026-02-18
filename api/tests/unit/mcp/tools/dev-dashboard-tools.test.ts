/**
 * Dev Dashboard MCP Tool Handlers — Unit Tests
 *
 * Tests the 5 tool handlers: list_tasks, create_task, update_task, list_products, get_plan.
 * BackendApiClient is fully mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BackendApiClient } from '../../../../src/mcp/backend-client/api-client'
import type { AuthContext } from '../../../../src/mcp/types'
import { handleListTasks } from '../../../../src/mcp/tools/list-tasks'
import { handleCreateTask } from '../../../../src/mcp/tools/create-task'
import { handleUpdateTask } from '../../../../src/mcp/tools/update-task'
import { handleListProducts } from '../../../../src/mcp/tools/list-products'
import { handleGetPlan } from '../../../../src/mcp/tools/get-plan'

function mockApiClient(overrides: Partial<BackendApiClient> = {}): BackendApiClient {
  return {
    listTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    listProducts: vi.fn(),
    getPlan: vi.fn(),
    ...overrides,
  } as unknown as BackendApiClient
}

const authContext: AuthContext = {
  userId: 'user-123',
  clientId: 'test-client',
  scopes: ['read:tasks', 'write:inbox'],
  tokenExpiry: Date.now() + 3600_000,
}

describe('handleListTasks', () => {
  it('should slim tasks with area/product/topic names and sub_items_progress', async () => {
    const api = mockApiClient({
      listTasks: vi.fn().mockResolvedValue([
        {
          id: 't1',
          title: 'Fix bug',
          status: 'ACTIVE',
          tag: { area: 'Engineering', product: 'Zentropy', topic: 'Backend' },
          due_date: '2026-02-17',
          sub_items: [
            { id: 's1', content: 'Sub 1', completed: true },
            { id: 's2', content: 'Sub 2', completed: false },
            { id: 's3', content: 'Sub 3', completed: true },
          ],
        },
      ]),
    })

    const result = await handleListTasks(api, authContext, {}, true)

    expect(result).toEqual({
      tasks: [
        {
          id: 't1',
          title: 'Fix bug',
          status: 'ACTIVE',
          area: 'Engineering',
          product: 'Zentropy',
          topic: 'Backend',
          due_date: '2026-02-17',
          sub_items_progress: '2/3',
        },
      ],
      total: 1,
    })
  })

  it('should handle { tasks: [...] } wrapper format', async () => {
    const api = mockApiClient({
      listTasks: vi.fn().mockResolvedValue({ tasks: [{ id: 't2', title: 'Task 2' }] }),
    })

    const result = await handleListTasks(api, authContext, {}, true)
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].id).toBe('t2')
  })

  it('should return empty array when no tasks', async () => {
    const api = mockApiClient({
      listTasks: vi.fn().mockResolvedValue([]),
    })

    const result = await handleListTasks(api, authContext, {}, true)
    expect(result).toEqual({ tasks: [], total: 0 })
  })

  it('should pass product_id parameter to apiClient', async () => {
    const listTasks = vi.fn().mockResolvedValue([
      {
        id: 't1',
        title: 'Task in Product A',
        status: 'ACTIVE',
        product: { id: 'prod-a', name: 'Product A' },
      },
    ])
    const api = mockApiClient({ listTasks })

    await handleListTasks(api, authContext, { product_id: 'prod-a' }, true)

    expect(listTasks).toHaveBeenCalledWith('user-123', {
      status: undefined,
      product_id: 'prod-a',
      topic_id: undefined,
    })
  })

  it('should pass topic_id parameter to apiClient', async () => {
    const listTasks = vi.fn().mockResolvedValue([
      {
        id: 't1',
        title: 'Task in Topic B',
        status: 'ACTIVE',
        topic: { id: 'topic-b', name: 'Topic B' },
      },
    ])
    const api = mockApiClient({ listTasks })

    await handleListTasks(api, authContext, { topic_id: 'topic-b' }, true)

    expect(listTasks).toHaveBeenCalledWith('user-123', {
      status: undefined,
      product_id: undefined,
      topic_id: 'topic-b',
    })
  })

  it('should pass combined filters to apiClient', async () => {
    const listTasks = vi.fn().mockResolvedValue([])
    const api = mockApiClient({ listTasks })

    await handleListTasks(
      api,
      authContext,
      { status: 'ACTIVE', product_id: 'prod-a', topic_id: 'topic-b' },
      true,
    )

    expect(listTasks).toHaveBeenCalledWith('user-123', {
      status: 'ACTIVE',
      product_id: 'prod-a',
      topic_id: 'topic-b',
    })
  })
})

describe('handleCreateTask', () => {
  it('should call apiClient.createTask with correct params', async () => {
    const createTask = vi.fn().mockResolvedValue({ task: { id: 'new-1', title: 'My task', status: 'INBOX' } })
    const api = mockApiClient({ createTask })

    await handleCreateTask(api, authContext, { content: 'My task', product_id: 'p1' }, true)

    expect(createTask).toHaveBeenCalledWith('user-123', {
      content: 'My task',
      product_id: 'p1',
      topic_id: undefined,
      status: undefined,
      due_date: undefined,
    })
  })

  it('should return id/title/status/message', async () => {
    const api = mockApiClient({
      createTask: vi.fn().mockResolvedValue({ task: { id: 'new-1', title: 'My task', status: 'INBOX' }, message: 'Task created successfully' }),
    })

    const result = await handleCreateTask(api, authContext, { content: 'My task' }, true)

    expect(result).toEqual({
      id: 'new-1',
      title: 'My task',
      status: 'INBOX',
      message: 'Task created successfully',
    })
  })
})

describe('handleUpdateTask', () => {
  it('should call apiClient.updateTask with correct params', async () => {
    const updateTask = vi.fn().mockResolvedValue({ task: { id: 't1', title: 'Updated', status: 'ACTIVE' } })
    const api = mockApiClient({ updateTask })

    await handleUpdateTask(api, authContext, { task_id: 't1', status: 'ACTIVE' }, true)

    expect(updateTask).toHaveBeenCalledWith('user-123', {
      task_id: 't1',
      status: 'ACTIVE',
      content: undefined,
    })
  })

  it('should return id/title/status/message', async () => {
    const api = mockApiClient({
      updateTask: vi.fn().mockResolvedValue({ task: { id: 't1', title: 'Updated', status: 'ACTIVE' }, message: 'Task updated successfully' }),
    })

    const result = await handleUpdateTask(api, authContext, { task_id: 't1', status: 'ACTIVE' }, true)

    expect(result).toEqual({
      id: 't1',
      title: 'Updated',
      status: 'ACTIVE',
      message: 'Task updated successfully',
    })
  })
})

describe('handleListProducts', () => {
  it('should slim products with area name and topics', async () => {
    const api = mockApiClient({
      listProducts: vi.fn().mockResolvedValue([
        {
          id: 'p1',
          name: 'Zentropy',
          area: { id: 'a1', name: 'Engineering' },
          status: 'ACTIVE',
          topics: [{ id: 'tp1', name: 'Backend' }, { id: 'tp2', name: 'Frontend' }],
        },
      ]),
    })

    const result = await handleListProducts(api, authContext, {}, true)

    expect(result).toEqual({
      products: [
        {
          id: 'p1',
          name: 'Zentropy',
          area: 'Engineering',
          status: 'ACTIVE',
          topics: [{ id: 'tp1', name: 'Backend' }, { id: 'tp2', name: 'Frontend' }],
        },
      ],
      total: 1,
    })
  })

  it('should handle { products: [...] } wrapper format', async () => {
    const api = mockApiClient({
      listProducts: vi.fn().mockResolvedValue({ products: [{ id: 'p1', name: 'Test' }] }),
    })

    const result = await handleListProducts(api, authContext, {}, true)
    expect(result.products).toHaveLength(1)
    expect(result.products[0].id).toBe('p1')
  })
})

describe('handleGetPlan', () => {
  it('should slim plan items with product name', async () => {
    const api = mockApiClient({
      getPlan: vi.fn().mockResolvedValue({
        date: '2026-02-17',
        coach_message: 'Focus on shipping!',
        items: [
          {
            content: 'Deploy API',
            product: { name: 'Zentropy' },
            estimated_minutes: 30,
            completed: false,
            task_id: 't1',
          },
        ],
      }),
    })

    const result = await handleGetPlan(api, authContext, {}, true)

    expect(result).toEqual({
      date: '2026-02-17',
      coach_message: 'Focus on shipping!',
      items: [
        {
          content: 'Deploy API',
          product: 'Zentropy',
          estimated_minutes: 30,
          completed: false,
          task_id: 't1',
        },
      ],
      total: 1,
    })
  })

  it('should handle empty items without crashing', async () => {
    const api = mockApiClient({
      getPlan: vi.fn().mockResolvedValue({ date: '2026-02-17' }),
    })

    const result = await handleGetPlan(api, authContext, {}, true)

    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
  })
})
