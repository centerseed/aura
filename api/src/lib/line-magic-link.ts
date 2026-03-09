import crypto from "crypto"
import { prisma } from "@/lib/db"

const TTL_MS = 15 * 60 * 1000 // 15 分鐘
const RATE_LIMIT_MS = 60 * 1000 // 60 秒內不重複建立
const WEB_APP_URL = process.env.WEB_APP_URL ?? "https://app.zentropy.cc"

export interface MagicLinkResult {
  token: string
  url: string
  isReused: boolean
}

/**
 * 為指定 LINE user 建立（或重用）一次性 magic link。
 * Rate limit：60 秒內若已有未過期、未使用的 link，直接回傳同一條。
 */
export async function generateLineMagicLink(lineUserId: string): Promise<MagicLinkResult> {
  const now = new Date()
  const rateLimitBefore = new Date(now.getTime() - RATE_LIMIT_MS)

  // Rate limit 檢查：同 LINE user 60 秒內已有未過期、未使用的 link
  const existing = await prisma.lineMagicLink.findFirst({
    where: {
      line_user_id: lineUserId,
      used_at: null,
      expires_at: { gt: now },
      created_at: { gt: rateLimitBefore },
    },
    orderBy: { created_at: "desc" },
  })

  if (existing) {
    return {
      token: existing.token,
      url: `${WEB_APP_URL}/line-bind?t=${existing.token}`,
      isReused: true,
    }
  }

  const token = crypto.randomBytes(32).toString("hex") // 256-bit
  const expiresAt = new Date(now.getTime() + TTL_MS)

  await prisma.lineMagicLink.create({
    data: {
      token,
      line_user_id: lineUserId,
      expires_at: expiresAt,
    },
  })

  return {
    token,
    url: `${WEB_APP_URL}/line-bind?t=${token}`,
    isReused: false,
  }
}
