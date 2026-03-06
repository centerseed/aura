/**
 * GET /api/coach/magic-moment
 *
 * 偵測用戶是否存在「動能轉移」：P0 Project 停滯 + 非 P0 Project 爆發完成。
 * 回傳結果供前端顯示重對齊 Banner。
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { ApiResponseBuilder, catchDomainException } from '@/lib/api-response'
import { detectMagicMoment } from '@/application/use-cases/coach/detect-magic-moment'

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma)
    const result = await detectMagicMoment(userId, prisma)
    return ApiResponseBuilder.success(result)
  })
}
