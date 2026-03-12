/**
 * LINE Messaging API 封裝
 *
 * 提供 Reply / Push 訊息發送能力，以及 Signature 驗證
 */

import { messagingApi } from "@line/bot-sdk"
import crypto from "crypto"
import type { CoachBriefingData } from "@/domain/interfaces/coach-briefing-repository"
import type { DailyPlanData } from "@/domain/interfaces/daily-plan-repository"

// ============================================================================
// Client Singleton
// ============================================================================

let _client: messagingApi.MessagingApiClient | null = null

export function getLineClient(): messagingApi.MessagingApiClient {
  if (!_client) {
    _client = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
    })
  }
  return _client
}

// ============================================================================
// Signature 驗證
// ============================================================================

export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return false
  const hash = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64")
  return hash === signature
}

// ============================================================================
// 晨報格式化（LINE 限 5000 chars）
// ============================================================================

export function formatMorningBriefing(briefing: CoachBriefingData): string {
  const dateStr = briefing.briefingDate.toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  })
  const lines: string[] = [`☀️ 早安！今天 ${dateStr}`]

  if (briefing.overdueTasks?.length) {
    lines.push(`\n⚠️ 逾期任務（${briefing.overdueTasks.length}項）`)
    briefing.overdueTasks.slice(0, 3).forEach((t) => {
      lines.push(`・${t.content}`)
    })
  }

  if (briefing.approachingTasks?.length) {
    lines.push(`\n🎯 今日重點（${briefing.approachingTasks.length}項）`)
    briefing.approachingTasks.slice(0, 5).forEach((t) => {
      lines.push(`・${t.content}`)
    })
  }

  if (briefing.summary) {
    lines.push(`\n📝 ${briefing.summary}`)
  }

  if (briefing.recommendations?.length) {
    lines.push(`\n💡 ${briefing.recommendations[0].action}`)
  }

  lines.push("\n—\n在 Zentropy App 查看完整計畫")

  const result = lines.join("\n")
  // LINE 單訊息上限 5000 chars
  return result.length > 4900 ? result.slice(0, 4900) + "…" : result
}

export function formatMorningBriefingPush(
  briefing: CoachBriefingData,
  plan: DailyPlanData | null,
): string {
  const dateStr = briefing.briefingDate.toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Taipei",
  })

  const lines: string[] = [`☀️ 早安！今天 ${dateStr}`]

  if (briefing.summary) {
    lines.push("", briefing.summary.trim())
  }

  const firstRecommendation = briefing.recommendations?.[0]?.action?.trim()
  if (firstRecommendation) {
    lines.push("", `💡 建議先做：${firstRecommendation}`)
  }

  lines.push("", "📋 今日任務")

  const todayItems = (plan?.items ?? [])
    .filter((item) => item.status === "today")
    .sort((a, b) => a.order - b.order)
    .slice(0, 5)

  if (todayItems.length === 0) {
    lines.push("今天沒有排定任務")
  } else {
    for (const item of todayItems) {
      const duration = item.estimatedMinutes ? `（${item.estimatedMinutes} 分鐘）` : ""
      lines.push(`${item.order}. ${item.content}${duration}`)
    }
  }

  lines.push("", "—", "在 Zentropy App 查看完整晨報與計畫")

  const result = lines.join("\n")
  return result.length > 4900 ? result.slice(0, 4900) + "…" : result
}

export type LinePostbackPayload =
  | { action: "confirm_pending" }
  | { action: "reject_pending" }
  | { action: "select_completion_candidate"; position: number }

interface QuickReplyPostbackOption {
  label: string
  displayText: string
  payload: LinePostbackPayload
}

interface CompletionCandidateOption {
  position: number
  label: string
}

export function encodeLinePostbackPayload(payload: LinePostbackPayload): string {
  if (payload.action === "select_completion_candidate") {
    return `a=select_completion_candidate&p=${payload.position}`
  }

  return `a=${payload.action}`
}

export function decodeLinePostbackPayload(data: string): LinePostbackPayload | null {
  const params = new URLSearchParams(data)
  const action = params.get("a")

  if (action === "confirm_pending") {
    return { action: "confirm_pending" }
  }

  if (action === "reject_pending") {
    return { action: "reject_pending" }
  }

  if (action === "select_completion_candidate") {
    const rawPosition = params.get("p")
    const position = rawPosition ? Number(rawPosition) : NaN
    if (Number.isInteger(position) && position >= 1) {
      return { action: "select_completion_candidate", position }
    }
  }

  return null
}

export function buildQuickReplyTextMessage(
  text: string,
  options: QuickReplyPostbackOption[],
): messagingApi.TextMessage {
  return {
    type: "text",
    text,
    quickReply: {
      items: options.map((option) => ({
        type: "action",
        action: {
          type: "postback",
          label: truncateQuickReplyLabel(option.label),
          displayText: option.displayText,
          data: encodeLinePostbackPayload(option.payload),
        },
      })),
    },
  }
}

export function buildPendingConfirmationMessage(
  text: string,
  confirmLabel = "確認",
  rejectLabel = "取消",
): messagingApi.TextMessage {
  return buildQuickReplyTextMessage(text, [
    {
      label: confirmLabel,
      displayText: confirmLabel,
      payload: { action: "confirm_pending" },
    },
    {
      label: rejectLabel,
      displayText: rejectLabel,
      payload: { action: "reject_pending" },
    },
  ])
}

export function buildCompletionCandidateMessage(
  text: string,
  candidates: CompletionCandidateOption[],
): messagingApi.TextMessage {
  return buildQuickReplyTextMessage(text, [
    ...candidates.map((candidate) => ({
      label: candidate.label,
      displayText: candidate.label,
      payload: { action: "select_completion_candidate", position: candidate.position } as const,
    })),
    {
      label: "取消",
      displayText: "取消",
      payload: { action: "reject_pending" } as const,
    },
  ])
}

export function ensureLineMessages(
  message: messagingApi.Message | messagingApi.Message[],
): messagingApi.Message[] {
  return Array.isArray(message) ? message : [message]
}

function truncateQuickReplyLabel(label: string): string {
  const trimmed = label.trim()
  if (trimmed.length <= 20) return trimmed
  return `${trimmed.slice(0, 19)}…`
}
