import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException, ValidationException } from '@/lib/api-response'
import { GenerateRecurringTaskInstancesUseCase } from '@/application/use-cases/recurring/generate-recurring-task-instances'

// POST /api/recurring-tasks/generate
// 客戶端觸發（App 啟動時呼叫），傳入用戶當地日期
export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const body = await request.json() as any

    const localDate: string = body.local_date
    if (!localDate || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      throw new ValidationException('local_date must be YYYY-MM-DD', 'local_date')
    }

    const useCase = new GenerateRecurringTaskInstancesUseCase()
    const result = await useCase.execute({ userId, localDate })

    return ApiResponseBuilder.success({
      generated: result.generated,
      skipped: result.skipped,
      details: result.details,
    })
  })
}
