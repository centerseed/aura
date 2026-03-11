import { normalizeCompletionInputText } from "./core"

const COMPLETION_QUERY_REGEX = /^(.*?)(做完|完成|搞定|弄完|處理完|解決|結束|收工|繳掉|好了|完|done)\s*(了|啦|囉|喔|哦|欸)?$/i
const COMPLETION_FRAME_PATTERNS = [
  /(?:幫我|請|麻煩)/gu,
  /(?:把|將)/gu,
  /(?:標記(?:成|為)?完成|設成完成|改成完成|勾掉|done)/giu,
]
const LEADING_FILLERS = ["我今天已經", "我已經", "今天已經", "我剛剛", "我剛才", "我剛", "剛剛", "剛才", "剛", "我把", "我要把", "想把", "幫我把", "幫我", "請把", "請幫我把", "請幫我", "把", "將", "這個", "那個", "這項", "那項"]
const TRAILING_FILLERS = ["這個", "那個", "這項", "那項", "我"]
const COMPLETION_TRAILING_PARTICLES = /(?:吧|呢|喔|哦|啊|呀)$/u

function stripLeadingFillers(text: string): string {
  let value = text.trim()
  let changed = true

  while (changed) {
    changed = false
    for (const filler of LEADING_FILLERS) {
      if (value.startsWith(filler)) {
        value = value.slice(filler.length).trim()
        changed = true
      }
    }
  }

  return value
}

function stripTrailingFillers(text: string): string {
  let value = text.trim()
  let changed = true

  while (changed) {
    changed = false
    for (const filler of TRAILING_FILLERS) {
      if (value.endsWith(filler)) {
        value = value.slice(0, value.length - filler.length).trim()
        changed = true
      }
    }
  }

  return value
}

function trimRepeatedLeadingStem(text: string): string {
  if (text.length < 3) return text
  const chars = Array.from(text)
  const first = chars[0]
  const last = chars.at(-1)
  if (!first || first !== last) return text
  return chars.slice(0, -1).join("").trim()
}

export function normalizeCompletionQueryZhTw(text: string): string {
  let normalized = normalizeCompletionInputText(text)
  if (!normalized) return ""

  for (const pattern of COMPLETION_FRAME_PATTERNS) {
    normalized = normalized.replace(pattern, " ")
  }

  normalized = normalized
    .replace(/[，、。！？!?]/g, " ")
    .replace(COMPLETION_TRAILING_PARTICLES, "")
    .replace(/[「」"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  let previous = ""
  while (normalized !== previous) {
    previous = normalized
    const completionMatch = normalized.match(COMPLETION_QUERY_REGEX)
    if (completionMatch) {
      normalized = completionMatch[1]?.trim() ?? ""
    }

    const objectCompletionMatch = normalized.match(/^(.{1,4})完(.{1,20})了?$/u)
    if (objectCompletionMatch?.[1] && objectCompletionMatch?.[2]) {
      normalized = `${objectCompletionMatch[1]}${objectCompletionMatch[2]}`.trim()
    }

    normalized = stripLeadingFillers(normalized)
    normalized = stripTrailingFillers(normalized)
    normalized = trimRepeatedLeadingStem(normalized)
    normalized = normalized.replace(/了$/u, "").trim()
  }

  normalized = normalized.replace(/^(?:這件事|這個任務|這個|那個|剛剛那個|剛才那個|上一個|上個)$/u, "").trim()
  return normalizeCompletionInputText(normalized)
}
