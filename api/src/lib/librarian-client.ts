/**
 * Librarian Service Client
 *
 * - observe: 非同步 HTTP 推送用戶修正到 Librarian Service（fire-and-forget）
 * - recall: 直接查 Neon DB poc_librarian.rules 表（避免 Cloud Run cold start）
 */

import { prisma } from "@/lib/db"
import { isValidUUID } from "@/domain/constants/validation"

// 在函數內讀取，避免 Next.js build 時固定為 undefined
function getLibrarianConfig() {
  return {
    url: process.env.LIBRARIAN_URL,
    apiKey: process.env.LIBRARIAN_API_KEY,
  }
}

export interface LibrarianRule {
  id: string
  pattern: string
  correction: string
  confidence: number
}

export async function librarianObserve(params: {
  userId: string
  taskContent: string
  originalProduct: string
  correctedProduct: string
  originalTopic?: string | null
  correctedTopic?: string | null
}): Promise<void> {
  if (isValidUUID(params.originalProduct) || isValidUUID(params.correctedProduct)) {
    console.warn('[librarian] skipping observe: product looks like UUID, expected name', {
      originalProduct: params.originalProduct,
      correctedProduct: params.correctedProduct,
    })
    return
  }

  const { url: LIBRARIAN_URL, apiKey: LIBRARIAN_API_KEY } = getLibrarianConfig()
  if (!LIBRARIAN_URL || !LIBRARIAN_API_KEY) {
    return
  }

  try {
    const body: Record<string, unknown> = {
      userId: params.userId,
      domain: 'naruvia',
      input: params.taskContent,
      aiPrediction: params.originalProduct,
      userCorrection: params.correctedProduct,
    }

    if (params.originalTopic !== undefined || params.correctedTopic !== undefined) {
      body.originalTopic = params.originalTopic ?? null
      body.correctedTopic = params.correctedTopic ?? null
    }

    const response = await fetch(`${LIBRARIAN_URL}/api/observe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LIBRARIAN_API_KEY,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.warn(`[librarian] observe failed: ${response.status} ${response.statusText}`)
      console.warn(`[librarian] payload:`, JSON.stringify(body, null, 2))
    } else {
      console.log(`[librarian] ✅ observe success`)
      console.log(`  userId: ${params.userId}`)
      console.log(`  task: "${params.taskContent}"`)
      console.log(`  correction: ${params.originalProduct} → ${params.correctedProduct}`)
    }
  } catch (error) {
    console.warn('[librarian] observe error:', error instanceof Error ? error.message : error)
  }
}

/**
 * 直接查 Neon DB poc_librarian.rules 取得用戶的 active 規則
 * 避免走 HTTP 到 librarian-service（cold start 3-5s）
 */
export async function librarianRecall(params: {
  userId: string
}): Promise<LibrarianRule[]> {
  try {
    const rows = await prisma.$queryRaw<Array<{
      id: string
      description: string
      result_action: { field: string; value: string }
      confidence: number
    }>>`
      SELECT id, description, result_action, confidence
      FROM poc_librarian.rules
      WHERE user_id = ${params.userId}
        AND domain = 'naruvia'
        AND is_active = true
      ORDER BY confidence DESC
      LIMIT 20
    `

    return rows.map(row => ({
      id: row.id,
      pattern: row.description,
      correction: `${row.result_action.field}: ${row.result_action.value}`,
      confidence: row.confidence,
    }))
  } catch (error) {
    console.warn('[librarian] recall error:', error instanceof Error ? error.message : error)
    return []
  }
}
