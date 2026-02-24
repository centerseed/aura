/**
 * DeleteAccountUseCase - Soft-delete all user data
 *
 * App Store Guideline 5.1.1(v) requires account deletion functionality.
 * This use case soft-deletes all user-owned data in a single transaction.
 */

import { prisma } from '@/lib/db'
import { NotFoundException, ValidationException } from '@/lib/api-response'

export interface DeleteAccountRequest {
  firebaseUid: string
}

export interface DeleteAccountResponse {
  message: string
}

export class DeleteAccountUseCase {
  async execute(request: DeleteAccountRequest): Promise<DeleteAccountResponse> {
    this.validateRequest(request)

    // Find user by Firebase UID
    const user = await prisma.user.findFirst({
      where: {
        auth_provider_id: request.firebaseUid,
        deleted_at: null,
      },
    })

    if (!user) {
      throw new NotFoundException('User')
    }

    const now = new Date()
    const userId = user.id

    // Delete all user data in a single transaction
    // Models without deleted_at use hard-delete (deleteMany);
    // models with deleted_at use soft-delete (updateMany).
    await prisma.$transaction([
      // --- Hard-delete: security-sensitive tokens (no deleted_at) ---

      // 1. MCP tokens (depends on User)
      prisma.mcpAccessToken.deleteMany({ where: { user_id: userId } }),
      prisma.mcpRefreshToken.deleteMany({ where: { user_id: userId } }),
      prisma.mcpAuthCode.deleteMany({ where: { user_id: userId } }),

      // 2. OAuth tokens (Google Calendar access/refresh tokens)
      prisma.oAuthToken.deleteMany({ where: { user_id: userId } }),

      // --- Hard-delete: no deleted_at field ---

      // 3. DailyPlanItem (no user_id, linked via DailyPlan)
      prisma.dailyPlanItem.deleteMany({
        where: { plan: { user_id: userId } },
      }),

      // 4. DailyPlan
      prisma.dailyPlan.deleteMany({ where: { user_id: userId } }),

      // 5. CoachBriefing
      prisma.coachBriefing.deleteMany({ where: { user_id: userId } }),

      // 6. DailyAiUsage
      prisma.dailyAiUsage.deleteMany({ where: { user_id: userId } }),

      // --- Soft-delete: models with deleted_at ---

      // 7. SubTasks (depends on Task)
      prisma.subTask.updateMany({
        where: { user_id: userId, deleted_at: null },
        data: { deleted_at: now },
      }),

      // 8. Tasks (depends on Topic, Product)
      prisma.task.updateMany({
        where: { user_id: userId, deleted_at: null },
        data: { deleted_at: now },
      }),

      // 9. Topics (depends on Product)
      prisma.topic.updateMany({
        where: { user_id: userId, deleted_at: null },
        data: { deleted_at: now },
      }),

      // 10. Products (depends on Area)
      prisma.product.updateMany({
        where: { user_id: userId, deleted_at: null },
        data: { deleted_at: now },
      }),

      // 11. Areas
      prisma.area.updateMany({
        where: { user_id: userId, deleted_at: null },
        data: { deleted_at: now },
      }),

      // 12. Milestones
      prisma.milestone.updateMany({
        where: { user_id: userId, deleted_at: null },
        data: { deleted_at: now },
      }),

      // 13. Governance Proposals
      prisma.governanceProposal.updateMany({
        where: { user_id: userId, deleted_at: null },
        data: { deleted_at: now },
      }),

      // 14. Calendar Events
      prisma.calendarEvent.updateMany({
        where: { user_id: userId, deleted_at: null },
        data: { deleted_at: now },
      }),

      // 15. Reminder Configs
      prisma.reminderConfig.updateMany({
        where: { user_id: userId, deleted_at: null },
        data: { deleted_at: now },
      }),

      // 16. User (last)
      prisma.user.update({
        where: { id: userId },
        data: { deleted_at: now },
      }),
    ])

    return { message: 'Account deleted successfully' }
  }

  private validateRequest(request: DeleteAccountRequest): void {
    if (!request.firebaseUid) {
      throw new ValidationException('Firebase UID is required', 'firebaseUid')
    }
  }
}
