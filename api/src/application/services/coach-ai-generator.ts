/**
 * CoachAIGenerator - 教練 AI 摘要生成器
 *
 * 使用 Gemini + Zod schema 生成晨報/晚報的 AI 摘要與建議
 */

import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import type {
  BriefingType,
  CalendarEventSummary,
  TaskSummary,
  ConflictItem,
  StagnationItem,
  Recommendation,
  DeferSuggestion,
} from '@/domain/entities/coach-briefing.entity'

// ============================================================================
// Zod Schemas
// ============================================================================

const RecommendationSchema = z.object({
  priority: z.number().min(1).max(3).describe('優先級 1=最高 2=中 3=低'),
  action: z.string().describe('具體可執行的建議（繁體中文）'),
  reasoning: z.string().describe('為什麼建議這樣做（繁體中文）'),
  related_task_id: z.string().nullable().describe('相關任務 ID，沒有則 null'),
})

const MorningBriefingSchema = z.object({
  summary: z.string().describe('2-4 句繁體中文摘要，概述今日重點'),
  recommendations: z
    .array(RecommendationSchema)
    .min(1)
    .max(3)
    .describe('Top 1-3 建議'),
})

const EveningBriefingSchema = z.object({
  summary: z.string().describe('2-4 句繁體中文摘要，回顧今日成果'),
  recommendations: z
    .array(RecommendationSchema)
    .min(1)
    .max(3)
    .describe('Top 1-3 明日建議'),
  defer_suggestions: z
    .array(
      z.object({
        task_id: z.string().describe('任務 ID'),
        task_content: z.string().describe('任務內容'),
        suggested_action: z.enum(['defer', 'archive', 'delegate']).describe('建議動作'),
        reasoning: z.string().describe('為什麼建議這樣做（繁體中文）'),
      }),
    )
    .max(5)
    .describe('建議延後/歸檔/委派的任務'),
})

// ============================================================================
// Input Types
// ============================================================================

export interface DailyPlanForBriefing {
  items: Array<{ order: number; content: string; areaName: string; productName: string; estimatedMinutes: number | null; reasoning: string | null }>
  coachMessage: string | null
  capacityNote: string | null
  overflowItems: Array<{ itemId: string; suggestion: string }>
}

export interface CoachAIInput {
  type: BriefingType
  calendarEvents: CalendarEventSummary[]
  overdueTasks: TaskSummary[]
  approachingTasks: TaskSummary[]
  conflicts: ConflictItem[]
  stagnations: StagnationItem[]
  completedTasks: TaskSummary[]
  remainingTasks: TaskSummary[]
  tomorrowPreview: CalendarEventSummary[]
  dailyPlan?: DailyPlanForBriefing
}

export interface CoachAIOutput {
  summary: string
  recommendations: Recommendation[]
  deferSuggestions: DeferSuggestion[]
}

// ============================================================================
// Generator
// ============================================================================

export class CoachAIGenerator {
  async generate(input: CoachAIInput): Promise<CoachAIOutput> {
    const prompt = this.buildPrompt(input)
    const schema = input.type === 'MORNING' ? MorningBriefingSchema : EveningBriefingSchema

    const { object } = await generateObject({
      model: google('gemini-2.5-flash-lite'),
      schema,
      prompt,
    })

    return {
      summary: object.summary,
      recommendations: object.recommendations as Recommendation[],
      deferSuggestions: 'defer_suggestions' in object
        ? (object.defer_suggestions as DeferSuggestion[])
        : [],
    }
  }

  // ============================================================================
  // Prompt 建構
  // ============================================================================

  private buildPrompt(input: CoachAIInput): string {
    return input.type === 'MORNING'
      ? this.buildMorningPrompt(input)
      : this.buildEveningPrompt(input)
  }

  // ============================================================================
  // 晨報 Prompt — 前瞻性，聚焦今日戰場
  // ============================================================================

  private buildMorningPrompt(input: CoachAIInput): string {
    const sections: string[] = []

    sections.push('你是 Zentropy 的營運教練（Coach Agent）。語氣溫暖但有效率，像一位經驗豐富的營運長在為創業者做晨間簡報。')
    sections.push('')
    sections.push('## 任務：生成晨報摘要')
    sections.push('幫助用戶掌握今日重點，提供具體可執行的建議。')
    sections.push('')
    sections.push('---')
    sections.push('')

    // 行事曆
    if (input.calendarEvents.length > 0) {
      sections.push('## 今日行事曆')
      for (const evt of input.calendarEvents) {
        const startTime = new Date(evt.start_date_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
        const endTime = new Date(evt.end_date_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
        sections.push(`- ${startTime}-${endTime} ${evt.summary}${evt.attendees.length > 0 ? ` (${evt.attendees.length} 人)` : ''}`)
      }
      sections.push('')
    }

    // 逾期任務
    if (input.overdueTasks.length > 0) {
      sections.push('## 逾期任務（需優先處理）')
      for (const task of input.overdueTasks) {
        sections.push(`- [${task.area_name}/${task.product_name}] ${task.content}（逾期 ${task.days_overdue} 天）[id: ${task.id}]`)
      }
      sections.push('')
    }

    // 即將到期
    if (input.approachingTasks.length > 0) {
      sections.push('## 即將到期（3 天內）')
      for (const task of input.approachingTasks) {
        sections.push(`- [${task.area_name}/${task.product_name}] ${task.content}（剩 ${task.days_remaining} 天）[id: ${task.id}]`)
      }
      sections.push('')
    }

    // 衝突
    if (input.conflicts.length > 0) {
      sections.push('## 偵測到的衝突')
      for (const conflict of input.conflicts) {
        sections.push(`- [${conflict.severity}] ${conflict.description}`)
      }
      sections.push('')
    }

    // 停滯
    if (input.stagnations.length > 0) {
      const taskStagnations = input.stagnations.filter(s => s.type !== 'stuck_subtask')
      const subtaskStagnations = input.stagnations.filter(s => s.type === 'stuck_subtask')

      if (taskStagnations.length > 0) {
        sections.push('## 停滯警告')
        for (const stag of taskStagnations) {
          sections.push(`- [${stag.area_name}] ${stag.entity_name}（${stag.days_inactive} 天未更新）`)
        }
        sections.push('')
      }

      if (subtaskStagnations.length > 0) {
        sections.push('## 停滯子任務（超過 3 天未完成）')
        for (const stag of subtaskStagnations) {
          sections.push(`- [${stag.area_name}] 父任務: "${stag.parent_task_content}" → 子任務: "${stag.entity_name}"（已開始 ${stag.days_inactive} 天）`)
        }
        sections.push('')
      }
    }

    // 明日預覽
    if (input.tomorrowPreview.length > 0) {
      sections.push('## 明日行事曆預覽')
      for (const evt of input.tomorrowPreview) {
        const startTime = new Date(evt.start_date_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
        sections.push(`- ${startTime} ${evt.summary}`)
      }
      sections.push('')
    }

    // 今日計畫
    if (input.dailyPlan) {
      const plan = input.dailyPlan
      sections.push('## 今日計畫（已排序）')
      if (plan.capacityNote) {
        sections.push(`容量概況：${plan.capacityNote}`)
      }
      sections.push('')
      if (plan.items.length > 0) {
        for (const item of plan.items) {
          const time = item.estimatedMinutes ? `（${item.estimatedMinutes} 分鐘）` : ''
          sections.push(`${item.order}. [${item.areaName}/${item.productName}] ${item.content}${time}`)
        }
      } else {
        sections.push('（今天沒有排定的任務）')
      }
      sections.push('')
      if (plan.overflowItems.length > 0) {
        sections.push('### 排不進今天的項目')
        for (const overflow of plan.overflowItems) {
          sections.push(`- ${overflow.suggestion}`)
        }
        sections.push('')
      }
      if (plan.coachMessage) {
        sections.push(`教練備註：${plan.coachMessage}`)
        sections.push('')
      }
    } else {
      sections.push('## 今日計畫')
      sections.push('系統已同步生成每日行動計畫（「今日計畫」頁面），請在 summary 中提醒用戶查看。')
      sections.push('')
    }

    sections.push('---')
    sections.push('')
    sections.push('## 回應要求')
    if (input.dailyPlan && input.dailyPlan.items.length > 0) {
      sections.push('1. summary：用 2-4 句繁體中文概述今日重點。你已經有一份排好的今日計畫，summary 應圍繞計畫重點來說明，而非逐條複述衝突或逾期資料。用洞察而非摘要，例如「今天排了 5 項任務，建議先處理 X 因為它阻塞了 Y」而非「您有 3 個逾期任務」。如有衝突或逾期仍需提及，但應融入計畫脈絡中。')
      sections.push('2. recommendations：1-3 個具體可執行的建議，基於計畫的排序邏輯，給出具體的第一步行動（「先完成 X 再處理 Y」而非「整理任務」）')
    } else {
      sections.push('1. summary：用 2-4 句繁體中文概述重點（如果有衝突或逾期必須提到）')
      sections.push('2. recommendations：1-3 個具體可執行的建議（「先完成 X 再處理 Y」而非「整理任務」）')
    }

    return sections.join('\n')
  }

  // ============================================================================
  // 晚報 Prompt — 回顧性，聚焦今日成就，讓用戶安心入睡
  // ============================================================================

  private buildEveningPrompt(input: CoachAIInput): string {
    const sections: string[] = []

    sections.push('你是 Zentropy 的營運教練（Coach Agent）。你正在為創業者做晚間回顧。')
    sections.push('語氣溫暖、肯定、像一位值得信賴的夥伴在一天結束時跟用戶說「今天辛苦了」。')
    sections.push('你的首要目標是讓用戶帶著成就感和安心感入睡，而不是帶著焦慮。')
    sections.push('')
    sections.push('## 任務：生成晚報摘要')
    sections.push('肯定今日的付出與成果。未完成的事情交給明天的晨報處理，今晚不需要擔心。')
    sections.push('')
    sections.push('---')
    sections.push('')

    // 今日完成（最重要的區塊，放最前面）
    if (input.completedTasks.length > 0) {
      sections.push('## 今日完成')
      for (const task of input.completedTasks) {
        sections.push(`- [${task.area_name}/${task.product_name}] ${task.content}`)
      }
      sections.push('')
    }

    // 今日行事曆（用戶今天參與了什麼，也是一種付出）
    if (input.calendarEvents.length > 0) {
      sections.push('## 今日參與的會議與活動')
      for (const evt of input.calendarEvents) {
        const startTime = new Date(evt.start_date_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
        const endTime = new Date(evt.end_date_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
        sections.push(`- ${startTime}-${endTime} ${evt.summary}`)
      }
      sections.push('')
    }

    // 明日預覽（輕量，讓用戶知道明天有底就好）
    if (input.tomorrowPreview.length > 0) {
      sections.push('## 明天的行程（已安排好，不用操心）')
      for (const evt of input.tomorrowPreview) {
        const startTime = new Date(evt.start_date_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
        sections.push(`- ${startTime} ${evt.summary}`)
      }
      sections.push('')
    }

    // 提供 remaining tasks 給 AI 作為 defer_suggestions 的來源，但不要求 AI 列出
    // 只在有逾期或大量任務時才提供，讓 AI 有素材產生延後建議
    const tasksForDeferContext = input.remainingTasks.filter(
      t => (t.days_overdue != null && t.days_overdue > 0) || (t.days_stagnant != null && t.days_stagnant > 7)
    )
    if (tasksForDeferContext.length > 0) {
      sections.push('## 背景資料（僅供生成 defer_suggestions 參考，不要在 summary 中提及這些任務）')
      for (const task of tasksForDeferContext.slice(0, 10)) {
        sections.push(`- [${task.area_name}/${task.product_name}] ${task.content}${task.days_overdue ? `（逾期 ${task.days_overdue} 天）` : `（${task.days_stagnant} 天未更新）`} [id: ${task.id}]`)
      }
      sections.push('')
    }

    sections.push('---')
    sections.push('')
    sections.push('## 回應要求')
    sections.push('1. summary：用 2-4 句繁體中文回顧今日成果。')
    sections.push('   - 聚焦在「完成了什麼」和「今天的付出」，語氣正面溫暖')
    sections.push('   - 如果完成了任務，具體肯定（「今天完成了 X 和 Y，特別是 X 很重要因為…」）')
    sections.push('   - 如果沒有完成任務但有會議，肯定會議的投入（「今天有 N 場會議，這些溝通對推進 X 很重要」）')
    sections.push('   - 如果今天什麼都沒做，也不要責備，溫和地說「今天是休息日也很好，明天再出發」')
    sections.push('   - 絕對不要提及逾期、停滯、未完成的數量。那些是明天晨報的事。')
    sections.push('2. recommendations：1-3 個面向明天的輕量建議')
    sections.push('   - 語氣是「明天可以…」而非「你還沒做…」')
    sections.push('   - 例如：「明天早上可以先處理 X，趁精神好的時候搞定」')
    sections.push('3. defer_suggestions：如果背景資料中有長期逾期或停滯的任務，可以建議延後/歸檔/委派（必須附上 task_id 和 task_content）。如果沒有就給空陣列。')

    return sections.join('\n')
  }
}
