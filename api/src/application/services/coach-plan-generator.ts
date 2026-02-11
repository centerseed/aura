/**
 * CoachPlanGenerator - AI 每日排序生成器
 *
 * 使用 Gemini + Zod schema 對候選任務進行智慧排序
 */

import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { PlanCandidate, ProductContext } from './plan-candidate-collector'

// ============================================================================
// Zod Schema
// ============================================================================

const DailyPlanOutputSchema = z.object({
  daily_plan: z.array(z.object({
    item_id: z.string().describe('task_id 或 subtask_id'),
    item_type: z.enum(['task', 'subtask']),
    order: z.number().describe('排序位置，1 開始'),
    reasoning: z.string().describe('排序理由（繁體中文）'),
  })).describe('排序後的每日計畫項目'),
  capacity_note: z.string().describe('容量建議（繁體中文），如「今天有 5 小時可用，建議先完成前 3 項」'),
  coach_message: z.string().describe('晨報親切語（繁體中文），2-3 句鼓勵或提醒'),
  overflow_items: z.array(z.object({
    item_id: z.string(),
    suggestion: z.string().describe('建議處理方式（繁體中文）'),
  })).describe('排不進今天的項目'),
})

export type DailyPlanOutput = z.infer<typeof DailyPlanOutputSchema>

// ============================================================================
// Generator
// ============================================================================

export class CoachPlanGenerator {
  async generate(
    candidates: PlanCandidate[],
    productContexts: ProductContext[],
    availableMinutes: number,
    meetingMinutes: number,
  ): Promise<DailyPlanOutput> {
    if (candidates.length === 0) {
      return {
        daily_plan: [],
        capacity_note: '今天沒有待處理的任務，可以專注在長期規劃上。',
        coach_message: '今天行程很寬裕！不妨回顧一下整體方向，或處理一些平時沒時間做的事。',
        overflow_items: [],
      }
    }

    const prompt = this.buildPrompt(candidates, productContexts, availableMinutes, meetingMinutes)

    const { object } = await generateObject({
      model: google('gemini-2.5-flash-lite'),
      schema: DailyPlanOutputSchema,
      prompt,
    })

    return object
  }

  // ============================================================================
  // Prompt
  // ============================================================================

  private buildPrompt(
    candidates: PlanCandidate[],
    productContexts: ProductContext[],
    availableMinutes: number,
    meetingMinutes: number,
  ): string {
    const sections: string[] = []

    sections.push('你是 Zentropy 的營運教練（Coach Agent）。請為用戶排定今天的工作計畫。')
    sections.push('')
    sections.push('## 排序原則')
    sections.push('1. 逾期任務最優先')
    sections.push('2. 今日到期 > 即將到期')
    sections.push('3. 同一 Product 下的相關任務盡量排在一起（減少上下文切換）')
    sections.push('4. 考慮任務的 estimated_minutes，盡量在可用時間內安排')
    sections.push('5. 超出容量的任務放入 overflow_items')
    sections.push('')

    // Capacity
    sections.push('## 今日容量')
    sections.push(`- 會議時間: ${meetingMinutes} 分鐘`)
    sections.push(`- 可用工作時間: ${availableMinutes} 分鐘 (${(availableMinutes / 60).toFixed(1)} 小時)`)
    sections.push('')

    // Product contexts
    if (productContexts.length > 0) {
      sections.push('## Product 上下文')
      for (const ctx of productContexts) {
        sections.push(`### ${ctx.areaName} / ${ctx.productName}`)
        if (ctx.productDescription) {
          sections.push(`描述: ${ctx.productDescription}`)
        }
        sections.push(`相關任務 (${ctx.taskSummaries.length}):`)
        for (const ts of ctx.taskSummaries.slice(0, 10)) {
          sections.push(`  - ${ts.content}${ts.dueDate ? ` (到期: ${ts.dueDate})` : ''} [${ts.status}]`)
        }
        sections.push('')
      }
    }

    // Candidates
    sections.push('## 候選項目（需排序）')
    for (const c of candidates) {
      const id = c.subTaskId || c.taskId
      const est = c.estimatedMinutes ?? 60
      let urgency = ''
      if (c.daysOverdue) urgency = `⚠️ 逾期 ${c.daysOverdue} 天`
      else if (c.daysRemaining !== null && c.daysRemaining <= 0) urgency = '⚠️ 今日到期'
      else if (c.daysRemaining !== null) urgency = `剩 ${c.daysRemaining} 天`

      sections.push(
        `- [${c.itemType}] id=${id} | ${c.productName}: ${c.content} | est=${est}min | ${urgency || '無期限'}${c.daysStagnant > 3 ? ` | 停滯${c.daysStagnant}天` : ''}`
      )
    }
    sections.push('')

    sections.push('## 回應要求')
    sections.push('1. daily_plan: 按建議執行順序排列所有候選項目')
    sections.push('2. 超出可用時間的項目放入 overflow_items')
    sections.push('3. capacity_note: 說明容量分配')
    sections.push('4. coach_message: 2-3 句親切的開場語')

    return sections.join('\n')
  }
}
