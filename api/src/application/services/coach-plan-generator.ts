/**
 * CoachPlanGenerator - AI 每日排序生成器
 *
 * 使用 Gemini + Zod schema 對候選任務進行智慧排序
 */

import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { PlanCandidate, MilestoneContext, WeeklyDayInfo } from '@/domain/entities/plan-candidate.entity'

// ============================================================================
// Zod Schema
// ============================================================================

const DailyPlanOutputSchema = z.object({
  daily_plan: z.array(z.object({
    item_id: z.string().describe('task_id 或 subtask_id'),
    item_type: z.enum(['task', 'subtask']),
    order: z.number().describe('排序位置，1 開始'),
    estimated_minutes: z.number().describe('預估完成時間（分鐘），根據任務內容與複雜度估計'),
    reasoning: z.string().describe('排序理由（繁體中文）'),
  })).describe('排序後的每日計畫項目'),
  coach_message: z.string().describe('晨報親切語（繁體中文），2-3 句鼓勵或提醒'),
  overflow_items: z.array(z.object({
    item_id: z.string(),
    suggestion: z.string().describe('建議處理方式（繁體中文）'),
  })).describe('排不進今天的項目'),
  scheduling: z.array(z.object({
    task_id: z.string(),
    suggested_start_date: z.string().describe('YYYY-MM-DD'),
    suggested_due_date: z.string().nullable().describe('YYYY-MM-DD，已有 due_date 則回傳 null'),
    reasoning: z.string().describe('排程理由（繁體中文，1句）'),
  })).describe('為缺少日期的待排程任務建議 start_date / due_date'),
})

export type DailyPlanOutput = z.infer<typeof DailyPlanOutputSchema>

// ============================================================================
// Generator
// ============================================================================

export class CoachPlanGenerator {
  async generate(
    candidates: PlanCandidate[],
    availableMinutes: number,
    meetingMinutes: number,
    calibrationNote?: string,
    unscheduledTasks?: PlanCandidate[],
    milestones?: MilestoneContext[],
    weeklyOverview?: WeeklyDayInfo[],
  ): Promise<{ output: DailyPlanOutput; prompt: string }> {
    if (candidates.length === 0 && (!unscheduledTasks || unscheduledTasks.length === 0)) {
      return {
        output: {
          daily_plan: [],
          coach_message: '今天行程很寬裕！不妨回顧一下整體方向，或處理一些平時沒時間做的事。',
          overflow_items: [],
          scheduling: [],
        },
        prompt: '(no candidates)',
      }
    }

    const prompt = this.buildPrompt(candidates, availableMinutes, meetingMinutes, calibrationNote, unscheduledTasks, milestones, weeklyOverview)

    const start = Date.now()
    const { object } = await generateObject({
      model: google('gemini-2.5-flash-lite'),
      schema: DailyPlanOutputSchema,
      prompt,
    })
    const aiTime = Date.now() - start
    console.log('[PlanGenerator] AI call:', aiTime, 'ms, prompt length:', prompt.length, 'chars')

    return { output: object, prompt }
  }

  // ============================================================================
  // Prompt
  // ============================================================================

  private buildPrompt(
    candidates: PlanCandidate[],
    availableMinutes: number,
    meetingMinutes: number,
    calibrationNote?: string,
    unscheduledTasks?: PlanCandidate[],
    milestones?: MilestoneContext[],
    weeklyOverview?: WeeklyDayInfo[],
  ): string {
    const sections: string[] = []

    // 日期上下文
    const now = new Date()
    const dayNames = ['日', '一', '二', '三', '四', '五', '六']
    const dayOfWeek = dayNames[now.getDay()]
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const isWeekend = now.getDay() === 0 || now.getDay() === 6

    sections.push('你是 Zentropy 的營運教練（Coach Agent）。請為用戶排定今天的工作計畫。')
    sections.push('')
    sections.push(`## 今日資訊`)
    sections.push(`- 日期: ${dateStr}（星期${dayOfWeek}）`)
    if (isWeekend) {
      sections.push(`- ⚠️ 今天是週末，請注意：`)
      sections.push(`  - 政府機關（區役所、公所、市政府等）週末不開放`)
      sections.push(`  - 銀行、郵局等公家機關週末不營業`)
      sections.push(`  - 與他人開會或討論的任務可能不適合排在週末`)
      sections.push(`  - 優先安排可以獨自完成的工作任務`)
    }
    sections.push('')
    sections.push('## 排序原則（嚴格遵守）')
    sections.push('1. 逾期任務最優先')
    sections.push('2. 今日到期必須排入')
    sections.push('3. **看週表決定**：如果某天負荷率 > 80%，提前拉部分任務到前面較空的日子')
    sections.push('4. **如果某天很空（負荷率 < 30%），可以從後面拉任務過來填充**')
    sections.push('5. daily_plan 控制在 3-5 項，overflow 的 suggestion 說明建議哪天做（如「建議週三做，當天負荷較低」）')
    sections.push('6. 容量上限 80%，留 20% 緩衝給意外事務')
    sections.push('7. 同 Product 任務排一起減少上下文切換')
    sections.push('8. 考慮任務的現實可行性（需要到特定地點、需要他人配合的任務是否今天能做）')
    sections.push('9. 寧可少排確保完成，也不要塞太多全部做不完。**少即是多**')
    sections.push('')
    sections.push('## 估時指引')
    sections.push('- 為每個項目估計完成時間（分鐘），填入 estimated_minutes')
    sections.push('- 考慮任務複雜度、上下文切換成本')
    sections.push('- 已有 est 值的項目可作為參考，但你可以根據判斷調整')
    sections.push('- 最小單位 15 分鐘，一般任務 30-120 分鐘')
    if (calibrationNote) {
      sections.push('')
      sections.push('## 個人校準資訊')
      sections.push(calibrationNote)
    }
    sections.push('')

    // Capacity
    sections.push('## 今日容量')
    sections.push(`- 會議時間: ${meetingMinutes} 分鐘`)
    sections.push(`- 可用工作時間: ${availableMinutes} 分鐘 (${(availableMinutes / 60).toFixed(1)} 小時)`)
    if (availableMinutes <= 180) {
      sections.push(`- ⚠️ 今天可用時間很少，請只排最緊急、最重要的 1-3 項任務`)
    }
    sections.push('')

    // Weekly overview
    if (weeklyOverview && weeklyOverview.length > 0) {
      sections.push('## 本週容量與負荷（週視野）')
      sections.push('')
      sections.push('| 日期 | 星期 | 可用時間 | 會議 | 到期任務 | 任務估時 | 負荷率 |')
      sections.push('|------|------|---------|------|---------|---------|-------|')
      for (let i = 0; i < weeklyOverview.length; i++) {
        const d = weeklyOverview[i]
        const availHours = (d.availableMinutes / 60).toFixed(1)
        const meetHours = (d.meetingMinutes / 60).toFixed(1)
        const estHours = (d.totalEstimatedMinutes / 60).toFixed(1)
        const loadRate = d.availableMinutes > 0
          ? Math.round((d.totalEstimatedMinutes / d.availableMinutes) * 100)
          : 0
        const marker = i === 0 ? ' ← 今天' : ''
        sections.push(`| ${d.date} | ${d.dayOfWeek} | ${availHours}h | ${meetHours}h | ${d.tasksDue} 項 | ${estHours}h | ${loadRate}% |${marker}`)
      }
      sections.push('')

      // Generate insights
      const insights: string[] = []
      for (let i = 1; i < weeklyOverview.length; i++) {
        const d = weeklyOverview[i]
        const loadRate = d.availableMinutes > 0
          ? (d.totalEstimatedMinutes / d.availableMinutes) * 100
          : 0
        if (loadRate > 80) {
          insights.push(`⚠️ ${d.date}（${d.dayOfWeek}）負荷率 ${Math.round(loadRate)}%，建議今天提前處理部分該日任務`)
        }
      }
      for (let i = 1; i < weeklyOverview.length; i++) {
        const d = weeklyOverview[i]
        const loadRate = d.availableMinutes > 0
          ? (d.totalEstimatedMinutes / d.availableMinutes) * 100
          : 0
        if (loadRate < 30) {
          insights.push(`✅ ${d.date}（${d.dayOfWeek}）較空，非緊急任務可安排到該天`)
        }
      }
      for (const insight of insights) {
        sections.push(insight)
      }
      if (insights.length > 0) sections.push('')
    }

    // Candidates
    sections.push('## 候選項目（需排序）')
    for (const c of candidates) {
      const id = c.subTaskId || c.taskId
      const est = c.estimatedMinutes ? `est=${c.estimatedMinutes}min` : '未估時'
      let urgency = ''
      if (c.daysOverdue) urgency = `⚠️ 逾期 ${c.daysOverdue} 天`
      else if (c.daysRemaining !== null && c.daysRemaining <= 0) urgency = '⚠️ 今日到期'
      else if (c.daysRemaining !== null && c.daysRemaining <= 3) urgency = `🔶 剩 ${c.daysRemaining} 天`
      else if (c.daysRemaining !== null) urgency = `剩 ${c.daysRemaining} 天`

      const parentInfo = c.itemType === 'subtask' && c.taskContent !== c.content
        ? ` (父任務: ${c.taskContent}, 第${c.subTaskOrder ?? '?'}步)`
        : ''

      sections.push(
        `- [${c.itemType}] id=${id} | ${c.productName}: ${c.content}${parentInfo} | ${est} | ${urgency || '無期限'}${c.daysStagnant > 3 ? ` | 停滯${c.daysStagnant}天` : ''}`
      )
    }
    sections.push('')

    // Milestones
    if (milestones && milestones.length > 0) {
      sections.push('## 里程碑（排程參考）')
      for (const m of milestones) {
        const targetStr = new Date(m.targetDate).toISOString().substring(0, 10)
        sections.push(`- [${m.entityType}] ${m.entityName}: "${m.name}" target=${targetStr} priority=${m.priority}`)
      }
      sections.push('')
    }

    // Unscheduled tasks
    if (unscheduledTasks && unscheduledTasks.length > 0) {
      const today = new Date().toISOString().substring(0, 10)
      sections.push('## 待排程任務（需建議日期）')
      for (const t of unscheduledTasks) {
        const dueStr = t.dueDate ? `due=${new Date(t.dueDate).toISOString().substring(0, 10)}` : '無日期'
        sections.push(`- id=${t.taskId} | ${t.productName}: ${t.content} | ${dueStr} | milestone=${t.milestoneId ?? '無'}`)
      }
      sections.push('')
      sections.push('排程原則：')
      sections.push('1. 有里程碑的任務 → due_date 必須在里程碑 target_date 之前')
      sections.push('2. 有 due_date 無 start_date → 根據估時反推（due - estimated_days = start）')
      sections.push('3. 無任何日期 → 根據優先級分散到未來 1-2 週，避免同天過多')
      sections.push('4. 任務內容含時間線索（「下週二」「月底前」）→ 必須據此設定')
      sections.push(`5. 今天是 ${today}，start_date 不早於今天`)
      sections.push('')
    }

    sections.push('## 回應要求')
    sections.push('1. daily_plan: 只放今天真正適合且來得及做的項目，按建議執行順序排列')
    sections.push('2. overflow_items: 不適合今天做的項目（太遠、週末限制、容量不足），suggestion 說明建議何時做')
    sections.push('3. coach_message: 2-3 句親切的開場語，考慮今天是什麼日子')
    if (unscheduledTasks && unscheduledTasks.length > 0) {
      sections.push('4. scheduling: 為每個待排程任務建議 start_date 和 due_date')
    }

    return sections.join('\n')
  }
}
