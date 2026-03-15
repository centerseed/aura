import { normalizeCompletionInputText } from "./core"

const COMPLETION_CUE_PATTERN = /(完成|做完|搞定|done|好了)/i

// Interrogative patterns that rule out "status statement" intent
const INTERROGATIVE_PATTERN = /(?:什麼|哪個|哪一個|哪件|哪些|了什麼|的是什麼|\?|？)/u

// Command/imperative patterns — these are requests to the agent, not status reports
const COMMAND_PATTERN = /(?:幫我|請|麻煩|標記|幫.*完成|改到|移到|換到|放到)/u

// Temporal referential expressions that merely reference context, not report completion
const CONTEXT_REFERENCE_PATTERN = /^(?:剛剛|剛才)/u

export function hasCompletionCueZhTw(text: string): boolean {
  return COMPLETION_CUE_PATTERN.test(normalizeCompletionInputText(text))
}

export function isCompletionStatusStatementZhTw(text: string): boolean {
  const normalized = normalizeCompletionInputText(text)
  if (!normalized) return false
  // Interrogative queries are never status statements
  if (INTERROGATIVE_PATTERN.test(normalized)) return false
  // Commands to the agent are never status statements
  if (COMMAND_PATTERN.test(normalized)) return false
  // Pure context reference (starts with 剛剛/剛才 but is about referencing, not reporting)
  if (CONTEXT_REFERENCE_PATTERN.test(normalized) && /(?:那個|這個|改到|移到|放到)/u.test(normalized)) return false
  // Explicit past tense "已經" → reporting completion
  const hasPastTense = /已經/.test(normalized)
  if (hasPastTense) return true
  // Tense "剛" (immediate past) → reporting completion (e.g., "剛把書桌整理完了", "牛奶剛買回來了")
  const hasImmediatePast = /剛/.test(normalized) && /(了|啦|囉|喔|哦|欸|完|好)/.test(normalized)
  if (hasImmediatePast) return true
  // Completion keyword at end of statement (e.g., "買牛奶完成了", "做完了")
  // But NOT "X 前完成" (deadline phrasing) or "X 要完成" (goal phrasing)
  const DEADLINE_COMPLETION_PATTERN = /(?:前|要|需要|得|應該|月底|週[一二三四五六日]|周[一二三四五六日])\s*(?:完成|做完|搞定|done|好了)(?:了|啦|囉|喔|哦|欸)?$/i
  if (DEADLINE_COMPLETION_PATTERN.test(normalized)) return false
  const hasCompletionAtEnd = /(完成|做完|搞定|done|好了)(?:了|啦|囉|喔|哦|欸)?$/i.test(normalized)
  return hasCompletionAtEnd
}
