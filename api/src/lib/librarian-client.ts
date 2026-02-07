/**
 * Librarian Service HTTP Client
 *
 * 非同步推送用戶修正到 Librarian Service，用於學習分類規則。
 * 設計原則：失敗不影響主流程（fire-and-forget）
 */

const LIBRARIAN_URL = process.env.LIBRARIAN_URL
const LIBRARIAN_API_KEY = process.env.LIBRARIAN_API_KEY

export interface LibrarianRule {
  id: string
  pattern: string
  correction: string
  confidence: number
}

interface RecallResponse {
  rules: LibrarianRule[]
}

export async function librarianObserve(params: {
  userId: string
  taskContent: string
  originalProduct: string
  correctedProduct: string
  originalTopic?: string | null
  correctedTopic?: string | null
}): Promise<void> {
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

export async function librarianRecall(params: {
  userId: string
  input: string
}): Promise<LibrarianRule[]> {
  if (!LIBRARIAN_URL || !LIBRARIAN_API_KEY) {
    return []
  }

  try {
    const response = await fetch(`${LIBRARIAN_URL}/api/recall`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LIBRARIAN_API_KEY,
      },
      body: JSON.stringify({
        userId: params.userId,
        domain: 'naruvia',
        input: params.input,
      }),
    })

    if (!response.ok) {
      console.warn(`[librarian] recall failed: ${response.status} ${response.statusText}`)
      return []
    }

    const data = (await response.json()) as RecallResponse
    return data.rules ?? []
  } catch (error) {
    console.warn('[librarian] recall error:', error instanceof Error ? error.message : error)
    return []
  }
}
