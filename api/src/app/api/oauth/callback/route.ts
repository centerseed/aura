/**
 * GET /api/oauth/callback
 *
 * OAuth Callback Handler（處理 OAuth Provider 的回調）
 *
 * Query Parameters:
 * - code: Authorization Code
 * - state: State 參數（用於 CSRF 防護）
 * - error: 錯誤訊息（如果授權失敗）
 *
 * Response:
 * - 成功：重定向到前端（帶上 success 參數）
 * - 失敗：重定向到前端（帶上 error 參數）
 */

import { NextRequest, NextResponse } from 'next/server'
import { OAuthService } from '@/lib/oauth-service'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // 前端 URL（從環境變數讀取）
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'

    // 如果使用者拒絕授權
    if (error) {
      console.error(`OAuth error: ${error}`)
      return NextResponse.redirect(
        `${frontendUrl}/settings?oauth_error=${encodeURIComponent(error)}`
      )
    }

    // 驗證參數
    if (!code || !state) {
      return NextResponse.redirect(
        `${frontendUrl}/settings?oauth_error=missing_parameters`
      )
    }

    const oauthService = new OAuthService(prisma)

    // 處理 Callback（用 code 換取 token）
    const tokenRecord = await oauthService.handleCallback(code, state)

    console.log(`✅ OAuth callback success for user ${tokenRecord.user_id}, provider ${tokenRecord.provider}`)

    // 重定向回前端（成功）
    return NextResponse.redirect(
      `${frontendUrl}/settings?oauth_success=true&provider=${tokenRecord.provider.toLowerCase()}`
    )
  } catch (error: any) {
    console.error('OAuth callback error:', error)

    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'
    return NextResponse.redirect(
      `${frontendUrl}/settings?oauth_error=${encodeURIComponent(error.message || 'unknown_error')}`
    )
  }
}
