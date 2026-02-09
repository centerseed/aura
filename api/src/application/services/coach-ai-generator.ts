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
    const isMorning = input.type === 'MORNING'
    const sections: string[] = []

    sections.push(`你是 Zentropy 的營運教練（Coach Agent）。語氣溫暖但有效率，像一位經驗豐富的營運長在為創業者做${isMorning ? '晨間' : '晚間'}簡報。`)
    sections.push('')

    if (isMorning) {
      sections.push('## 任務：生成晨報摘要')
      sections.push('幫助用戶掌握今日重點，提供具體可執行的建議。')
    } else {
      sections.push('## 任務：生成晚報摘要')
      sections.push('回顧今日成果，提醒未完成事項，並建議哪些任務可以延後處理。')
    }

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
      sections.push('## 停滯警告')
      for (const stag of input.stagnations) {
        sections.push(`- [${stag.area_name}] ${stag.entity_name}（${stag.days_inactive} 天未更新）`)
      }
      sections.push('')
    }

    // 晚報額外資訊
    if (!isMorning) {
      if (input.completedTasks.length > 0) {
        sections.push('## 今日完成')
        for (const task of input.completedTasks) {
          sections.push(`- [${task.area_name}/${task.product_name}] ${task.content}`)
        }
        sections.push('')
      }

      if (input.remainingTasks.length > 0) {
        sections.push('## 尚未完成的活躍任務')
        for (const task of input.remainingTasks.slice(0, 20)) { // 最多 20 個
          sections.push(`- [${task.area_name}/${task.product_name}] ${task.content}${task.due_date ? `（到期: ${task.due_date}）` : ''}${task.days_stagnant && task.days_stagnant > 3 ? `（${task.days_stagnant} 天未更新）` : ''} [id: ${task.id}]`)
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

    sections.push('---')
    sections.push('')
    sections.push('## 回應要求')
    sections.push('1. summary：用 2-4 句繁體中文概述重點（如果有衝突或逾期必須提到）')
    sections.push('2. recommendations：1-3 個具體可執行的建議（「先完成 X 再處理 Y」而非「整理任務」）')
    if (!isMorning) {
      sections.push('3. defer_suggestions：建議延後/歸檔/委派的任務（必須附上 task_id 和 task_content）')
    }

    return sections.join('\n')
  }
}
