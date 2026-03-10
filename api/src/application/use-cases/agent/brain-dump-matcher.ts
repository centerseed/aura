export interface BrainDumpActivation {
  matched: boolean
  mode: "explicit" | "implicit" | null
  reasonCode: string | null
}

const NON_BRAIN_DUMP_PATTERNS: RegExp[] = [
  /今天.*(有哪些|有什麼|要做什麼|任務|待辦|代辦)/i,
  /(有哪些|有什麼).*(任務|待辦|代辦)/i,
  /(我剛才|我剛剛).*(說了什麼|問了什麼|記了什麼)/i,
  /(你是誰|你可以做什麼|可以做什麼)/i,
  /(完成了什麼|做了什麼)/i,
  /(查詢|列出|顯示).*(任務|待辦|代辦)/i,
  /(還剩什麼|剩下什麼)/i,
]

const EXPLICIT_BRAIN_DUMP_PATTERNS: RegExp[] = [
  /(記下|記一下|幫我記|幫我加|新增任務|待辦|todo)/i,
  /(再加一個|再加|補一個|另外一個)/i,
]

const IMPLICIT_BRAIN_DUMP_PATTERNS: RegExp[] = [
  /(明天|今天|下週).*(要|需|得|去)/i,
  /(要|需要|得|去).*(完成|處理|準備|回覆|提交|安排)/i,
]

export function detectBrainDumpActivation(message: string): BrainDumpActivation {
  const text = message.trim()
  if (!text) {
    return {
      matched: false,
      mode: null,
      reasonCode: null,
    }
  }

  if (NON_BRAIN_DUMP_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      matched: false,
      mode: null,
      reasonCode: null,
    }
  }

  if (EXPLICIT_BRAIN_DUMP_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      matched: true,
      mode: "explicit",
      reasonCode: "explicit_task_capture_pattern",
    }
  }

  if (IMPLICIT_BRAIN_DUMP_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      matched: true,
      mode: "implicit",
      reasonCode: "implicit_task_capture_pattern",
    }
  }

  return {
    matched: false,
    mode: null,
    reasonCode: null,
  }
}

export function hasExplicitBrainDumpFrame(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return EXPLICIT_BRAIN_DUMP_PATTERNS.some((pattern) => pattern.test(text))
}

export function shouldActivateBrainDump(message: string): boolean {
  return detectBrainDumpActivation(message).matched
}
