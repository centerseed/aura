/**
 * CoachAIGenerator - 教練 AI 摘要生成器
 *
 * 使用 Gemini + Zod schema 生成晨報/晚報的 AI 摘要與建議
 */

import { google } from '@ai-sdk/google'
import { resilientGenerateObject } from '@/lib/ai-resilient'
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
import type { AiTokenUsage } from '@/lib/ai-rate-limit'

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
  summary: z.string().describe('2-4 句繁體中文摘要，概述今日重點。嚴禁包含 UUID 或 id 字串，只能用任務或專案名稱'),
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
    .min(0)
    .max(1)
    .describe('0-1 個收心建議，讓用戶安心入睡'),
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

export interface FocusDriftData {
  detected: boolean
  lowPriorityRatio: number
  stagnantHighPriorityProducts: Array<{ id: string; name: string; priority: string }>
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
  focusDrift?: FocusDriftData
}

export interface CoachAIOutput {
  summary: string
  recommendations: Recommendation[]
  deferSuggestions: DeferSuggestion[]
  usage?: AiTokenUsage
}

// ============================================================================
// Generator
// ============================================================================

export class CoachAIGenerator {
  async generate(input: CoachAIInput): Promise<CoachAIOutput> {
    const prompt = this.buildPrompt(input)
    const schema = input.type === 'MORNING' ? MorningBriefingSchema : EveningBriefingSchema

    const start = Date.now()
    const { object, usage } = await resilientGenerateObject({
      model: google('gemini-2.5-flash-lite'),
      schema,
      prompt,
    })
    const aiTime = Date.now() - start
    console.log(`[AIGenerator] ${input.type} AI call:`, aiTime, 'ms, prompt length:', prompt.length, 'chars')
    console.log(`[AIGenerator] ${input.type} PROMPT:\n`, prompt)
    console.log(`[AIGenerator] ${input.type} RESPONSE:`, JSON.stringify(object, null, 2))

    return {
      summary: object.summary,
      recommendations: object.recommendations as Recommendation[],
      deferSuggestions: 'defer_suggestions' in object
        ? (object.defer_suggestions as DeferSuggestion[])
        : [],
      usage,
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
        sections.push(`- [${task.area_name}/${task.product_name}] ${task.content}（逾期 ${task.days_overdue} 天）`)
      }
      sections.push('')
    }

    // 即將到期
    if (input.approachingTasks.length > 0) {
      sections.push('## 即將到期（3 天內）')
      for (const task of input.approachingTasks) {
        sections.push(`- [${task.area_name}/${task.product_name}] ${task.content}（剩 ${task.days_remaining} 天）`)
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

    // 焦點偏差警告
    if (input.focusDrift?.detected) {
      const { lowPriorityRatio, stagnantHighPriorityProducts } = input.focusDrift
      sections.push('## ⚠️ 焦點偏差警告（Focus Drift）')
      sections.push(`過去 7 天，有 ${Math.round(lowPriorityRatio * 100)}% 的完成任務屬於低優先度（P2/P3）。`)
      if (stagnantHighPriorityProducts.length > 0) {
        const names = stagnantHighPriorityProducts.map(p => `${p.name}（${p.priority}）`).join('、')
        sections.push(`高優先度專案已停滯超過 5 天：${names}`)
      }
      sections.push('請在建議中明確質詢用戶：是否有意識地暫緩高優先度專案？還是不知不覺在做「安全任務」？')
      sections.push('')
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
      const totalMinutes = input.dailyPlan.items.reduce((sum, i) => sum + (i.estimatedMinutes || 0), 0)
      const itemCount = input.dailyPlan.items.length
      sections.push(`1. summary：用 2-4 句繁體中文概述今日重點。你已有一份排好的計畫（${itemCount} 項任務，約 ${totalMinutes} 分鐘）。`)
      sections.push('   - 用洞察而非摘要，例如「今天排了 5 項任務，建議先處理 X 因為它阻塞了 Y」')
      sections.push('   - 如果有逾期/衝突，融入計畫脈絡中說明，而非單純列出數字')
      sections.push('   - 如果計畫容量滿載，提醒用戶專注優先項目')
      sections.push('2. recommendations：1-3 個具體可執行的第一步行動')
      sections.push('   - 必須是具體動作（「先完成報告初稿再開會」），禁止空泛建議（「查看計畫」「整理任務」）')
      sections.push('   - 基於計畫排序和任務間的依賴關係給建議')
    } else if (input.overdueTasks.length > 0 || input.approachingTasks.length > 0) {
      sections.push('1. summary：用 2-4 句繁體中文概述今日重點，必須提及逾期或即將到期的任務')
      sections.push('2. recommendations：1-3 個具體可執行的建議')
      sections.push('   - 必須是具體動作，禁止「查看計畫」「整理任務」這類空話')
    } else if (input.calendarEvents.length > 0) {
      sections.push('1. summary：用 2-4 句繁體中文概述今日重點。今天沒有逾期壓力，結合行事曆給出建議。')
      sections.push(`   - 例如「今天有 ${input.calendarEvents.length} 場會議，空檔時間適合推進 X」`)
      sections.push('2. recommendations：1-3 個具體可執行的建議，結合會議時間和任務安排')
    } else {
      sections.push('1. summary：用 2-4 句繁體中文概述今日重點。今天沒有逾期壓力，是專注推進工作的好時機。')
      sections.push('2. recommendations：1-3 個具體可執行的建議')
      sections.push('   - 從即將到期或停滯的任務中挑選值得推進的項目')
      sections.push('   - 必須是具體動作，禁止「查看計畫」「整理任務」這類空話')
    }
    sections.push('**格式限制**：summary 與 recommendations 的文字中嚴禁包含任何 UUID 或 id 字串（如 `[id: ...]`、`id=xxx`），只能使用任務名稱、專案名稱或 Area 名稱。related_task_id 欄位才能放 UUID。')

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

    if (input.completedTasks.length === 0 && input.calendarEvents.length === 0) {
      sections.push('【重要】今天沒有任何完成的任務或行事曆記錄。')
      sections.push('你的 summary 必須是：「今天是好好充電的一天，辛苦了！」')
      sections.push('嚴禁使用任何其他句子或提及任何任務名稱。')
      sections.push('')
    }

    sections.push('---')
    sections.push('')
    sections.push('## 回應要求（嚴格遵守）')
    sections.push('1. summary：用 2-4 句繁體中文回顧今日成果。')
    sections.push('   - **嚴禁幻覺**：你只能提及上方「今日完成」和「今日參與的會議與活動」中明確列出的項目。')
    sections.push('   - **嚴禁改寫名稱**：引用任務或會議時，必須使用上方資料中的原文名稱，不得自行改寫、概括或替換。')
    sections.push('   - 如果上方「今日完成」區段為空或不存在，就說「今天是休息日也很好」，絕對不要編造任務。')
    sections.push('   - 如果上方「今日參與的會議與活動」區段為空或不存在，就不要提及任何會議。')
    sections.push('   - 語氣正面溫暖，聚焦「完成了什麼」和「今天的付出」')
    sections.push('   - 絕對不要提及逾期、停滯、未完成的數量。那些是明天晨報的事。')
    sections.push('2. recommendations：0-1 個收心建議（可以是空陣列）')
    sections.push('   - 今晚的重點是讓用戶安心入睡，不是規劃明天')
    sections.push('   - 如果明天有早會或重要行程，可以提醒「明天有早會，記得設鬧鐘」')
    sections.push('   - 除此之外，不要列待辦事項。明天的事交給明天的晨報。')
    sections.push('   - 語氣是「今天辛苦了，好好休息」而非「明天還有很多事要做」')
    sections.push('3. defer_suggestions：給空陣列 []。延後建議由系統規則生成，不需要 AI 處理。')

    return sections.join('\n')
  }
}
