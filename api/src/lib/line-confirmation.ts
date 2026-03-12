const AFFIRMATIVE_CONFIRMATIONS = new Set([
  "確認",
  "確認調整",
  "confirm",
  "ok",
  "okay",
  "yes",
  "y",
  "好",
  "好的",
  "好啊",
  "是",
  "是的",
  "是啊",
  "對",
  "對啊",
  "對的",
  "沒錯",
  "可以",
  "行",
  "嗯",
  "嗯嗯",
])

const REJECTION_PHRASES = new Set([
  "不要",
  "不",
  "算了",
  "取消",
  "cancel",
  "no",
  "n",
  "不是",
  "不用",
  "不用了",
  "先不要",
  "我再想想",
  "不確定",
  "放棄",
  "不做了",
])

const BRAIN_DUMP_CONFIRMATION_PATTERNS = [
  /你想要我記錄[「『"]([^」』"\n]+)[」』"]嗎/u,
  /你想要我幫你記下[「『"]([^」』"\n]+)[」』"](?:這件事)?嗎/u,
  /要幫你記下[「『"]([^」』"\n]+)[」』"]嗎/u,
  /你想要我記錄[「『"]([^」』"\n]+)[」』"]嗎？請確認是否要建立新的任務/u,
  /你想要我記錄[「『"]([^」』"\n]+)[」』"]嗎？請說[「『"]?記錄[:：]/u,
] as const

export function isLineSessionConfirmation(text: string): boolean {
  return AFFIRMATIVE_CONFIRMATIONS.has(text.trim().toLowerCase())
}

/**
 * 在 pending session 存在的情況下，判定用戶回覆的意圖：
 * - "confirm"：肯定確認（執行操作）
 * - "reject"：明確拒絕（取消操作）
 * - "override"：新意圖輸入（清除 session，進入正常 agent 流程）
 */
export function classifyConfirmationDisposition(text: string): "confirm" | "reject" | "override" {
  const normalized = text.trim().toLowerCase()
  if (AFFIRMATIVE_CONFIRMATIONS.has(normalized)) return "confirm"
  if (REJECTION_PHRASES.has(normalized)) return "reject"
  return "override"
}

export function extractBrainDumpConfirmationTarget(text: string): string | null {
  for (const pattern of BRAIN_DUMP_CONFIRMATION_PATTERNS) {
    const match = text.match(pattern)
    const candidate = match?.[1]?.trim()
    if (candidate) return candidate
  }
  return null
}

export function parseOrdinalSelection(text: string, candidateCount: number): number | null {
  const normalized = text.trim()
  if (!normalized || candidateCount <= 0) return null

  if (/^最後一個$/u.test(normalized)) {
    return candidateCount
  }

  const numericMatch = normalized.match(/^(?:選)?\s*(\d+)\s*$/u)
    ?? normalized.match(/^第\s*(\d+)\s*個$/u)
  if (numericMatch) {
    const position = Number(numericMatch[1])
    return position >= 1 && position <= candidateCount ? position : null
  }

  const chineseOrdinalPatterns = [
    { pattern: /^第一個$/u, position: 1 },
    { pattern: /^第二個$/u, position: 2 },
    { pattern: /^第三個$/u, position: 3 },
    { pattern: /^第四個$/u, position: 4 },
    { pattern: /^第五個$/u, position: 5 },
  ]

  for (const candidate of chineseOrdinalPatterns) {
    if (candidate.pattern.test(normalized) && candidate.position <= candidateCount) {
      return candidate.position
    }
  }

  return null
}
