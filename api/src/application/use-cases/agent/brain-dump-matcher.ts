import { hasExplicitCaptureFrame } from "./explicit-capture-frame"

export interface BrainDumpActivation {
  matched: boolean
  mode: "explicit" | null
  reasonCode: string | null
}

export function detectBrainDumpActivation(message: string): BrainDumpActivation {
  const text = message.trim()
  if (!text) {
    return {
      matched: false,
      mode: null,
      reasonCode: null,
    }
  }

  if (hasExplicitCaptureFrame(text)) {
    return {
      matched: true,
      mode: "explicit",
      reasonCode: "explicit_task_capture_pattern",
    }
  }

  return {
    matched: false,
    mode: null,
    reasonCode: null,
  }
}

export function hasExplicitBrainDumpFrame(message: string): boolean {
  return hasExplicitCaptureFrame(message)
}

export function isInterrogativeSpeechAct(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  if (/什麼|哪些|哪個|幾個|多少|幹嘛|幹啥|怎麼|怎樣|如何/.test(text)) return true
  if (/[？?]/.test(text)) return true
  if (/有沒有|是不是|要不要|能不能|可不可以/.test(text)) return true
  if (/[嗎呢]\s*$/.test(text)) return true
  return false
}

export function shouldActivateBrainDump(message: string): boolean {
  return detectBrainDumpActivation(message).matched
}
