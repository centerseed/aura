/**
 * Library API Route - 使用 Clean Architecture
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { GetLibraryUseCase } from '@/application/use-cases/library/get-library'

// ============================================================================
// GET /api/library - 獲取用戶的完整層級結構
// Query params:
//   - include_archived: true 時包含 ARCHIVE 狀態的任務(預設排除)
// ============================================================================

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('include_archived') === 'true'

    const useCase = new GetLibraryUseCase()
    const result = await useCase.execute({ userId, includeArchived })

    return ApiResponseBuilder.success({ areas: result.areas }, {})
  })
}
