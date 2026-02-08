/**
 * POST /api/oauth/disconnect
 *
 * 撤銷 OAuth 授權（解除連接）
 *
 * Request Body:
 * {
 *   "provider": "google_calendar"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Authorization revoked successfully"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { OAuthService } from '@/lib/oauth-service'
import { prisma } from '@/lib/db'
import { catchDomainException, ValidationException } from '@/lib/api-response'

export async function POST(request: NextRequest) {
  return catchDomainException(async () => {
    // 認證
    const userId = await authenticateRequest(request, prisma)

    // 解析 Request Body
    const body = await request.json() as { provider?: string }
    const { provider: providerParam } = body

    if (!providerParam) {
      throw new ValidationException('Missing provider in request body', 'provider')
    }

    // 轉換為大寫並驗證
    const provider = providerParam.toUpperCase().replace(/-/g, '_')
    const validProviders = ['GOOGLE_CALENDAR', 'GOOGLE_DRIVE', 'ZOOM']

    if (!validProviders.includes(provider)) {
      throw new ValidationException(`Invalid provider: ${providerParam}`, 'provider')
    }

    const oauthService = new OAuthService(prisma)

    // 撤銷授權
    await oauthService.revokeAuthorization(userId, provider as any)

    return NextResponse.json({
      success: true,
      data: { message: 'Authorization revoked successfully' },
    })
  })
}
