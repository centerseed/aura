import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenerateRecurringTaskInstancesUseCase } from '@/application/use-cases/recurring/generate-recurring-task-instances'
import type { RecurringTaskData } from '@/domain/interfaces/recurring-task-repository'
import { VALID_USER_ID, VALID_PRODUCT_ID } from '../../../helpers/test-uuids'

// vi.mock 會被 hoist 到頂部，需用 vi.hoisted() 確保變數在工廠函數執行前初始化
const { mockQueryRaw, mockProductFindFirst } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockProductFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    product: { findFirst: mockProductFindFirst },
  },
}))

const mockRecurringRepo = {
  findPendingForUser: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  softDelete: vi.fn(),
}

const mockTaskRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findMany: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

// 2026-03-05 UTC
const TODAY_UTC = new Date(Date.UTC(2026, 2, 5))
const LOCAL_DATE = '2026-03-05'

function makeTemplate(overrides: Partial<RecurringTaskData> = {}): RecurringTaskData {
  return {
    id: 'recurring-1',
    userId: VALID_USER_ID,
    title: '每日例行',
    status: 'ACTIVE',
    recurrenceRule: {
      frequency: 'DAILY',
      interval: 1,
      timezone: 'Asia/Taipei',
      startDate: '2026-01-01',
    },
    leadDays: 1,
    productId: VALID_PRODUCT_ID,
    topicId: null,
    estimatedDurationHours: null,
    nextOccurrenceAt: TODAY_UTC,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('GenerateRecurringTaskInstancesUseCase', () => {
  let useCase: GenerateRecurringTaskInstancesUseCase

  beforeEach(() => {
    useCase = new GenerateRecurringTaskInstancesUseCase(
      mockRecurringRepo as any,
      mockTaskRepo as any
    )
    vi.clearAllMocks()
    mockQueryRaw.mockResolvedValue([])
    mockTaskRepo.create.mockResolvedValue({ id: 'new-task-1' })
    mockRecurringRepo.update.mockResolvedValue({})
  })

  it('無待處理模板時直接返回空結果', async () => {
    mockRecurringRepo.findPendingForUser.mockResolvedValue([])

    const result = await useCase.execute({ userId: VALID_USER_ID, localDate: LOCAL_DATE })

    expect(result.generated).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.details).toHaveLength(0)
  })

  it('occurrence 在今天（含）時建立 task 並推進', async () => {
    mockRecurringRepo.findPendingForUser.mockResolvedValue([makeTemplate()])

    const result = await useCase.execute({ userId: VALID_USER_ID, localDate: LOCAL_DATE })

    expect(result.generated).toBe(1)
    expect(result.skipped).toBe(0)
    expect(mockTaskRepo.create).toHaveBeenCalledOnce()
    expect(mockRecurringRepo.update).toHaveBeenCalledOnce()
    expect(result.details[0].taskId).toBe('new-task-1')
  })

  it('occurrence 早於 cutoff（today-1）時略過並推進', async () => {
    const oldDate = new Date(Date.UTC(2026, 2, 3)) // 2026-03-03，比 cutoff=Mar4 更早
    mockRecurringRepo.findPendingForUser.mockResolvedValue([
      makeTemplate({ nextOccurrenceAt: oldDate }),
    ])

    const result = await useCase.execute({ userId: VALID_USER_ID, localDate: LOCAL_DATE })

    expect(result.skipped).toBe(1)
    expect(mockTaskRepo.create).not.toHaveBeenCalled()
    expect(mockRecurringRepo.update).toHaveBeenCalledOnce() // 仍要推進
  })

  it('occurrence 超過 leadDays 閾值時靜默跳過（不推進）', async () => {
    // leadDays=1, threshold=Mar6; occurrence=Mar10 超過閾值
    const futureDate = new Date(Date.UTC(2026, 2, 10))
    mockRecurringRepo.findPendingForUser.mockResolvedValue([
      makeTemplate({ nextOccurrenceAt: futureDate, leadDays: 1 }),
    ])

    const result = await useCase.execute({ userId: VALID_USER_ID, localDate: LOCAL_DATE })

    expect(result.generated).toBe(0)
    expect(result.skipped).toBe(0)
    expect(mockTaskRepo.create).not.toHaveBeenCalled()
    expect(mockRecurringRepo.update).not.toHaveBeenCalled()
  })

  it('重複任務已存在時略過並推進', async () => {
    mockRecurringRepo.findPendingForUser.mockResolvedValue([makeTemplate()])
    mockQueryRaw.mockResolvedValue([{ id: 'existing-task-id' }])

    const result = await useCase.execute({ userId: VALID_USER_ID, localDate: LOCAL_DATE })

    expect(result.skipped).toBe(1)
    expect(result.details[0].taskId).toBe('existing-task-id')
    expect(mockTaskRepo.create).not.toHaveBeenCalled()
    expect(mockRecurringRepo.update).toHaveBeenCalledOnce()
  })

  it('template.productId 為 null 時跳過不建立任務', async () => {
    mockRecurringRepo.findPendingForUser.mockResolvedValue([
      makeTemplate({ productId: null }),
    ])

    const result = await useCase.execute({ userId: VALID_USER_ID, localDate: LOCAL_DATE })

    expect(mockTaskRepo.create).not.toHaveBeenCalled()
    expect(result.generated).toBe(0)
    expect(result.skipped).toBe(1)
  })

  it('多個 productId=null 的模板時全部跳過', async () => {
    const t1 = makeTemplate({ id: 'r1', productId: null })
    const t2 = makeTemplate({ id: 'r2', productId: null })
    mockRecurringRepo.findPendingForUser.mockResolvedValue([t1, t2])

    const result = await useCase.execute({ userId: VALID_USER_ID, localDate: LOCAL_DATE })

    expect(mockTaskRepo.create).not.toHaveBeenCalled()
    expect(result.generated).toBe(0)
    expect(result.skipped).toBe(2)
  })

  it('template.nextOccurrenceAt 為 null 時略過', async () => {
    mockRecurringRepo.findPendingForUser.mockResolvedValue([
      makeTemplate({ nextOccurrenceAt: null }),
    ])

    const result = await useCase.execute({ userId: VALID_USER_ID, localDate: LOCAL_DATE })

    expect(result.generated).toBe(0)
    expect(result.skipped).toBe(0)
  })

  it('建立的 task 含正確的 recurringTaskId、dueDate、dateSource', async () => {
    mockRecurringRepo.findPendingForUser.mockResolvedValue([makeTemplate()])

    await useCase.execute({ userId: VALID_USER_ID, localDate: LOCAL_DATE })

    expect(mockTaskRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recurringTaskId: 'recurring-1',
        dueDate: TODAY_UTC,
        dateSource: 'recurring',
        content: '每日例行',
      })
    )
  })

  it('details 正確記錄每個模板的結果', async () => {
    mockRecurringRepo.findPendingForUser.mockResolvedValue([makeTemplate()])
    mockTaskRepo.create.mockResolvedValue({ id: 'created-task-99' })

    const result = await useCase.execute({ userId: VALID_USER_ID, localDate: LOCAL_DATE })

    expect(result.details).toHaveLength(1)
    expect(result.details[0]).toMatchObject({
      recurringTaskId: 'recurring-1',
      title: '每日例行',
      dueDate: LOCAL_DATE,
      taskId: 'created-task-99',
    })
  })
})
