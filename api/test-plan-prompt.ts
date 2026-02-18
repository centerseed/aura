/**
 * 測試腳本：直接呼叫 CoachPlanGenerator，檢查 prompt 內容與 AI 決策
 * 執行：npx tsx test-plan-prompt.ts
 */

import { CoachPlanGenerator } from './src/application/services/coach-plan-generator'
import type { PlanCandidate, WeeklyDayInfo } from './src/domain/entities/plan-candidate.entity'

const today = new Date('2026-02-18T12:00:00')
const todayStr = '2026-02-18'

// Mock 候選任務（模擬真實情況：1 逾期 + 多個有截止日的任務）
const candidates: PlanCandidate[] = [
  {
    itemType: 'subtask',
    taskId: 'task-1',
    subTaskId: 'sub-1',
    content: '定義技術選型',
    taskContent: '定義脈輪服務POC目標',
    areaName: '事業',
    productName: '身心靈脈輪系統',
    productDescription: null,
    subTaskOrder: 1,
    estimatedMinutes: 60,
    dueDate: new Date('2026-02-17'), // 逾期
    startDate: null,
    daysOverdue: 1,
    daysRemaining: null,
    daysStagnant: 2,
    milestoneId: null,
    dateSource: 'manual',
  },
  {
    itemType: 'task',
    taskId: 'task-2',
    subTaskId: null,
    content: '去看辦公室',
    taskContent: '去看辦公室',
    areaName: '事業',
    productName: '事業',
    productDescription: null,
    subTaskOrder: null,
    estimatedMinutes: 60,
    dueDate: new Date('2026-02-18'), // 今天到期
    startDate: null,
    daysOverdue: null,
    daysRemaining: 0,
    daysStagnant: 1,
    milestoneId: null,
    dateSource: 'manual',
  },
  {
    itemType: 'task',
    taskId: 'task-3',
    subTaskId: null,
    content: '爬蟲 - 爬競品相關的文案',
    taskContent: '爬蟲 - 爬競品相關的文案',
    areaName: '事業',
    productName: '原心生技專案',
    productDescription: null,
    subTaskOrder: null,
    estimatedMinutes: 60,
    dueDate: new Date('2026-02-22'),
    startDate: new Date('2026-02-18'),
    daysOverdue: null,
    daysRemaining: 4,
    daysStagnant: 5,
    milestoneId: null,
    dateSource: 'manual',
  },
  {
    itemType: 'task',
    taskId: 'task-4',
    subTaskId: null,
    content: '規劃付費服務功能',
    taskContent: '規劃付費服務功能',
    areaName: '事業',
    productName: 'Zentropy',
    productDescription: null,
    subTaskOrder: null,
    estimatedMinutes: 90,
    dueDate: new Date('2026-02-22'),
    startDate: new Date('2026-02-18'),
    daysOverdue: null,
    daysRemaining: 4,
    daysStagnant: 8,
    milestoneId: null,
    dateSource: 'manual',
  },
  {
    itemType: 'task',
    taskId: 'task-5',
    subTaskId: null,
    content: '建立付費服務架構',
    taskContent: '建立付費服務架構',
    areaName: '事業',
    productName: 'Zentropy',
    productDescription: null,
    subTaskOrder: null,
    estimatedMinutes: 120,
    dueDate: new Date('2026-02-24'),
    startDate: new Date('2026-02-18'),
    daysOverdue: null,
    daysRemaining: 6,
    daysStagnant: 10,
    milestoneId: null,
    dateSource: 'manual',
  },
  {
    itemType: 'task',
    taskId: 'task-6',
    subTaskId: null,
    content: '串接金流',
    taskContent: '串接金流',
    areaName: '事業',
    productName: 'Zentropy',
    productDescription: null,
    subTaskOrder: null,
    estimatedMinutes: 120,
    dueDate: new Date('2026-02-25'),
    startDate: new Date('2026-02-18'),
    daysOverdue: null,
    daysRemaining: 7,
    daysStagnant: 12,
    milestoneId: null,
    dateSource: 'manual',
  },
  {
    itemType: 'task',
    taskId: 'task-7',
    subTaskId: null,
    content: '產品資料RAG',
    taskContent: '產品資料RAG',
    areaName: '事業',
    productName: '原心生技專案',
    productDescription: null,
    subTaskOrder: null,
    estimatedMinutes: 90,
    dueDate: new Date('2026-02-26'),
    startDate: new Date('2026-02-18'),
    daysOverdue: null,
    daysRemaining: 8,
    daysStagnant: 15,
    milestoneId: null,
    dateSource: 'manual',
  },
]

// Mock 週表（今天很空，未來幾天也空）
const weeklyOverview: WeeklyDayInfo[] = [
  { date: '2026-02-18', dayOfWeek: '星期二', meetingMinutes: 0, availableMinutes: 480, tasksDue: 2, totalEstimatedMinutes: 120 },
  { date: '2026-02-19', dayOfWeek: '星期三', meetingMinutes: 0, availableMinutes: 480, tasksDue: 0, totalEstimatedMinutes: 0 },
  { date: '2026-02-20', dayOfWeek: '星期四', meetingMinutes: 60, availableMinutes: 420, tasksDue: 1, totalEstimatedMinutes: 60 },
  { date: '2026-02-21', dayOfWeek: '星期五', meetingMinutes: 0, availableMinutes: 480, tasksDue: 0, totalEstimatedMinutes: 0 },
  { date: '2026-02-22', dayOfWeek: '星期六', meetingMinutes: 0, availableMinutes: 480, tasksDue: 2, totalEstimatedMinutes: 150 },
  { date: '2026-02-23', dayOfWeek: '星期日', meetingMinutes: 0, availableMinutes: 480, tasksDue: 0, totalEstimatedMinutes: 0 },
  { date: '2026-02-24', dayOfWeek: '星期一', meetingMinutes: 0, availableMinutes: 480, tasksDue: 1, totalEstimatedMinutes: 120 },
  { date: '2026-02-25', dayOfWeek: '星期二', meetingMinutes: 0, availableMinutes: 480, tasksDue: 1, totalEstimatedMinutes: 120 },
  { date: '2026-02-26', dayOfWeek: '星期三', meetingMinutes: 0, availableMinutes: 480, tasksDue: 1, totalEstimatedMinutes: 90 },
  { date: '2026-02-27', dayOfWeek: '星期四', meetingMinutes: 0, availableMinutes: 480, tasksDue: 0, totalEstimatedMinutes: 0 },
]

async function main() {
  const generator = new CoachPlanGenerator()

  console.log('=== 生成每日計畫 ===\n')
  console.log(`候選任務數量: ${candidates.length} 項`)
  console.log(`今日可用: 480 分鐘 (目標 60-80% = 288-384 分鐘)\n`)

  const { output, prompt } = await generator.generate(
    candidates,
    480,   // availableMinutes
    0,     // meetingMinutes
    undefined,
    [],
    [],
    weeklyOverview,
    today,
    'Asia/Taipei',
  )

  console.log('=== AI 決策結果 ===\n')
  console.log(`daily_plan: ${output.daily_plan.length} 項`)
  for (const item of output.daily_plan) {
    console.log(`  ${item.order}. [${item.item_type}] ${item.item_id} - ${item.estimated_minutes}m`)
    console.log(`     理由: ${item.reasoning}`)
  }

  const totalMinutes = output.daily_plan.reduce((sum, i) => sum + i.estimated_minutes, 0)
  console.log(`\n總排程時間: ${totalMinutes} 分鐘 (目標: 288-384 分鐘)`)
  console.log(`容量利用率: ${Math.round(totalMinutes / 480 * 100)}%`)

  console.log(`\noverflow: ${output.overflow_items.length} 項`)
  for (const item of output.overflow_items) {
    console.log(`  - ${item.item_id}: ${item.suggestion}`)
  }

  console.log('\n=== coach_message ===')
  console.log(output.coach_message)

  console.log('\n=== PROMPT（排序原則部分）===')
  const promptLines = prompt.split('\n')
  const principleStart = promptLines.findIndex(l => l.includes('排序原則'))
  const principleEnd = promptLines.findIndex(l => l.includes('估時指引'))
  console.log(promptLines.slice(principleStart, principleEnd).join('\n'))
}

main().catch(console.error)
