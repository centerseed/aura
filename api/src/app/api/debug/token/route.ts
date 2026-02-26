/**
 * Debug Token API - 僅供開發測試使用
 * 為固定測試用戶生成 Firebase custom token
 * 需設定環境變數 DEBUG_TOKEN_ALLOWED=true 才會開啟
 */

import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/firebase-admin'

const DEBUG_USER_ID = 'HXa5Pnojnqe6z2eL80tGwkNZA5I3'

export async function GET() {
  // 雙重防護：必須同時滿足 非 production 環境 + 明確開啟 DEBUG_TOKEN_ALLOWED
  // deploy-api.sh 永遠設 NODE_ENV=production，所以 Cloud Run 上此 endpoint 永遠是 404
  if (process.env.NODE_ENV === 'production' || process.env.DEBUG_TOKEN_ALLOWED !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const token = await getAuth().createCustomToken(DEBUG_USER_ID)
  return NextResponse.json({ token })
}
