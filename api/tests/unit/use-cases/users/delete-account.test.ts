import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteAccountUseCase } from '@/application/use-cases/users/delete-account'
import { ValidationException, NotFoundException } from '@/lib/api-response'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    mcpAccessToken: { deleteMany: vi.fn() },
    mcpRefreshToken: { deleteMany: vi.fn() },
    mcpAuthCode: { deleteMany: vi.fn() },
    oAuthToken: { deleteMany: vi.fn() },
    dailyPlanItem: { deleteMany: vi.fn() },
    dailyPlan: { deleteMany: vi.fn() },
    coachBriefing: { deleteMany: vi.fn() },
    dailyAiUsage: { deleteMany: vi.fn() },
    subTask: { updateMany: vi.fn() },
    task: { updateMany: vi.fn() },
    topic: { updateMany: vi.fn() },
    product: { updateMany: vi.fn() },
    area: { updateMany: vi.fn() },
    milestone: { updateMany: vi.fn() },
    governanceProposal: { updateMany: vi.fn() },
    calendarEvent: { updateMany: vi.fn() },
    reminderConfig: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

describe('DeleteAccountUseCase', () => {
  let useCase: DeleteAccountUseCase

  beforeEach(() => {
    useCase = new DeleteAccountUseCase()
    vi.clearAllMocks()
  })

  describe('驗證邏輯', () => {
    it('應該拋出錯誤當沒有提供 firebaseUid', async () => {
      await expect(
        useCase.execute({ firebaseUid: '' })
      ).rejects.toThrow(ValidationException)
    })
  })

  describe('使用者不存在', () => {
    it('應該拋出 NotFoundException 當使用者不存在', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({ firebaseUid: 'non-existent-uid' })
      ).rejects.toThrow(NotFoundException)
    })

    it('應該拋出 NotFoundException 當使用者已被刪除', async () => {
      // findFirst with deleted_at: null will return null for deleted users
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

      await expect(
        useCase.execute({ firebaseUid: 'deleted-user-uid' })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('成功刪除', () => {
    it('應該在 transaction 中 soft-delete 所有使用者資料', async () => {
      const mockUser = {
        id: 'user-123',
        auth_provider_id: 'firebase-uid-123',
        email: 'test@example.com',
        name: 'Test User',
        deleted_at: null,
      }

      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.$transaction).mockResolvedValue([])

      const result = await useCase.execute({ firebaseUid: 'firebase-uid-123' })

      expect(result.message).toBe('Account deleted successfully')

      // Verify findFirst was called with correct filters
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          auth_provider_id: 'firebase-uid-123',
          deleted_at: null,
        },
      })

      // Verify transaction was called with 18 operations
      // 8 hard-deletes (tokens + daily data) + 9 soft-deletes + 1 user update
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      const transactionArg = vi.mocked(prisma.$transaction).mock.calls[0][0]
      expect(transactionArg).toHaveLength(18)
    })
  })
})
