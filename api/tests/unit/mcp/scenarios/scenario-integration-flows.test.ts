/**
 * 跨情境整合測試 — 驗證 MCP functions 達成設計文件描述的使用情境
 *
 * 設計文件: docs/02_Plan/004_MCP_Functions_Design.md (Appendix A)
 *
 * 現有的 scenario-a{N} 測試驗證了單一 use case 的邏輯正確性。
 * 本測試驗證三個更高層次的面向：
 *
 * 1. MCP Handler 路由 — tool/resource 是否正確委派到 use case
 * 2. 跨情境數據流 — A 的輸出能否作為 B 的輸入
 * 3. 回饋迴路閉環 — report_done → bias 更新 → 下次 handoff 的 coach_notes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    task: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    dailyPlan: {
      findFirst: vi.fn(),
    },
    dailyPlanItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    subTask: {
      create: vi.fn(),
    },
    area: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'Asia/Taipei' }),
    },
  },
}))

// Use cases
import { GetHandoffReadyUseCase } from '@/application/use-cases/mcp/get-handoff-ready'
import { CaptureUseCase } from '@/application/use-cases/mcp/capture'
import { ReportDoneUseCase } from '@/application/use-cases/mcp/report-done'
import { GetMemoryBiasUseCase } from '@/application/use-cases/mcp/get-memory-bias'
import { GetContextNowUseCase } from '@/application/use-cases/mcp/get-context-now'
import { GetAreasHierarchyUseCase } from '@/application/use-cases/mcp/get-areas-hierarchy'

// MCP handlers
import { handleCapture } from '@/mcp/tools/capture'
import { handleReportDone } from '@/mcp/tools/report-done'
import { readHandoffReady } from '@/mcp/resources/handoff-ready'
import { readMemoryBias } from '@/mcp/resources/memory-bias'
import { readAreasHierarchy } from '@/mcp/resources/areas-hierarchy'

import type { BackendApiClient } from '@/mcp/backend-client/api-client'
import type { AuthContext } from '@/mcp/types'
import { prisma } from '@/lib/db'

// ─── Mock References ─────────────────────────────────────────────
const mockQueryRaw = prisma.$queryRaw as any
const mockTransaction = prisma.$transaction as any
const mockTaskFindFirst = prisma.task.findFirst as any
const mockDailyPlanFindFirst = (prisma as any).dailyPlan.findFirst as any
const mockDailyPlanItemFindMany = (prisma as any).dailyPlanItem.findMany as any
const mockDailyPlanItemFindFirst = prisma.dailyPlanItem.findFirst as any
const mockDailyPlanItemUpdate = prisma.dailyPlanItem.update as any
const mockAreaFindMany = (prisma as any).area.findMany as any

const userId = 'user-integration-1'

// ─── Shared Fixtures ─────────────────────────────────────────────

const taskFixture = {
  id: 'task-auth-refactor',
  user_id: userId,
  content: '重構 auth 模組',
  status: 'ACTIVE',
  due_date: new Date('2026-02-14'),
  product: {
    id: 'prod-zentropy',
    name: 'Zentropy',
    area: { id: 'area-work', name: 'Work' },
  },
  sub_tasks: [],
}

const planFixture = {
  id: 'plan-today',
  user_id: userId,
  plan_date: new Date('2026-02-13'),
}

const planItemFixture = {
  id: 'item-1',
  plan_id: 'plan-today',
  task_id: 'task-auth-refactor',
  order: 1,
  estimated_minutes: 240,
  actual_minutes: null,
  completed: false,
  deferred: false,
  reasoning: 'P95 latency > 2s，同步呼叫是瓶頸',
  task: taskFixture,
}

// Work area: 3 samples, each actual/estimated = 1.8x
const calibrationBias180 = [
  { area_name: 'Work', estimated_minutes: 100, actual_minutes: 180 },
  { area_name: 'Work', estimated_minutes: 100, actual_minutes: 180 },
  { area_name: 'Work', estimated_minutes: 100, actual_minutes: 180 },
]

// ═══════════════════════════════════════════════════════════════════
// MCP Handler 路由驗證
// ═══════════════════════════════════════════════════════════════════

describe('MCP Handler 路由驗證 — tool/resource 正確委派到 handler/use case', () => {
  const mockApiClient = {
    captureThought: vi.fn(),
  } as unknown as BackendApiClient

  const authContext: AuthContext = {
    userId,
    clientId: 'client-1',
    scopes: ['write:inbox', 'read:tasks', 'read:profile'],
    tokenExpiry: Date.now() + 3600000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('capture tool: thought mode → apiClient.captureThought（brain-dump pipeline）', async () => {
    (mockApiClient.captureThought as any).mockResolvedValue({
      id: 'bd-123',
      status: 'completed',
    })

    const result = await handleCapture(mockApiClient, authContext, {
      content: '需要重構 auth',
      source: 'Claude Desktop',
      mode: 'thought',
    }, false)

    expect(mockApiClient.captureThought).toHaveBeenCalledWith(userId, expect.objectContaining({
      content: '需要重構 auth',
    }))
    expect(result.classified_as).toBe('thought')
    // ID 來自 brain-dump pipeline 而非本地生成
    expect(result.id).toBe('bd-123')
  })

  it('capture tool: execution_plan mode → CaptureUseCase（直接 DB 寫入，不走 apiClient）', async () => {
    mockTaskFindFirst.mockResolvedValue(taskFixture)
    mockTransaction.mockImplementation(async (fn: any) => {
      const fakeTx = { subTask: { create: vi.fn().mockResolvedValue({ id: 'st-1' }) } }
      return fn(fakeTx)
    })

    const result = await handleCapture(mockApiClient, authContext, {
      content: JSON.stringify({ sub_items: [{ title: 'Step 1', estimated_minutes: 30 }] }),
      source: 'Claude Code',
      mode: 'execution_plan',
      parent_id: 'task-auth-refactor',
    }, false)

    // execution_plan 不應呼叫 apiClient
    expect(mockApiClient.captureThought).not.toHaveBeenCalled()
    expect(result.classified_as).toBe('execution_plan')
    expect(result.parent_id).toBe('task-auth-refactor')
  })

  it('capture tool: result mode → CaptureUseCase（含 DB 持久化）', async () => {
    mockTaskFindFirst.mockResolvedValue(taskFixture)
    mockDailyPlanItemFindFirst.mockResolvedValue({
      id: 'item-1', task_id: 'task-auth-refactor', estimated_minutes: 240,
    })
    mockDailyPlanItemUpdate.mockResolvedValue({})

    const result = await handleCapture(mockApiClient, authContext, {
      content: JSON.stringify({ actual_duration_minutes: 300 }),
      source: 'Claude Code',
      mode: 'result',
      parent_id: 'task-auth-refactor',
    }, false)

    expect(mockApiClient.captureThought).not.toHaveBeenCalled()
    expect(result.classified_as).toBe('result')
    // 驗證 actual_minutes 已持久化
    expect(mockDailyPlanItemUpdate).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { actual_minutes: 300 },
    })
  })

  it('report_done tool → ReportDoneUseCase', async () => {
    mockTaskFindFirst.mockResolvedValue(taskFixture)
    mockDailyPlanItemFindFirst.mockResolvedValue(planItemFixture)
    mockTransaction.mockImplementation(async (fn: any) => {
      const fakeTx = {
        task: { update: vi.fn().mockResolvedValue({}) },
        dailyPlanItem: { update: vi.fn().mockResolvedValue({}) },
      }
      return fn(fakeTx)
    })
    mockQueryRaw.mockResolvedValue([])

    const result = await handleReportDone(mockApiClient, authContext, {
      action_id: 'task-auth-refactor',
      actual_duration_minutes: 300,
      outcome: 'completed',
    }, false)

    expect(result.action_id).toBe('task-auth-refactor')
    expect(result.status).toBe('completed')
    expect(result.deviation).toBeDefined()
  })

  it('resource handlers 正確委派到 use cases', async () => {
    // handoff/ready → GetHandoffReadyUseCase
    mockDailyPlanFindFirst.mockResolvedValue(null)
    mockQueryRaw.mockResolvedValue([])
    const handoff = await readHandoffReady(userId)
    expect(handoff.handoff_items).toEqual([])

    // memory/bias → GetMemoryBiasUseCase
    mockQueryRaw.mockResolvedValue([])
    const bias = await readMemoryBias(userId)
    expect(bias.overall_bias_ratio).toBe(1.0)

    // areas → GetAreasHierarchyUseCase
    mockAreaFindMany.mockResolvedValue([])
    const areas = await readAreasHierarchy(userId)
    expect(areas.areas).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════
// 情境 A.1→A.2: 讀取任務 → 拆子任務回流
//
// 設計文件描述：
//   User: "我要開始做 auth 重構，先幫我拆任務"
//   Claude Code 自動讀 handoff/ready → 拿到 task + context
//   Claude Code 分析 codebase → 拆出 5 個子任務
//   呼叫 capture(mode=execution_plan, parent_id=handoff item ID)
//   → 下次打開 Zentropy App，該 task 下已有 5 個 sub-items
// ═══════════════════════════════════════════════════════════════════

describe('情境 A.1→A.2: Claude Code 讀任務 → 拆子任務回流到 Zentropy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handoff item 的 task ID 可直接作為 capture(execution_plan) 的 parent_id', async () => {
    // ─── Step 1: A.1 — 讀取 handoff/ready ─────────────
    mockDailyPlanFindFirst.mockResolvedValue(planFixture)
    mockDailyPlanItemFindMany.mockResolvedValue([planItemFixture])
    mockQueryRaw.mockResolvedValue(calibrationBias180)

    const handoffUseCase = new GetHandoffReadyUseCase()
    const handoff = await handoffUseCase.execute({ userId })

    // 驗證：拿到了任務，包含完整 context_package
    expect(handoff.handoff_items).toHaveLength(1)
    const item = handoff.handoff_items[0]
    expect(item.id).toBe('task-auth-refactor')
    expect(item.intent).toBe('重構 auth 模組')
    expect(item.context_package.why).toBe('P95 latency > 2s，同步呼叫是瓶頸')
    expect(item.context_package.coach_notes).toContain('1.80x')
    // Coach 建議的調整時間
    expect(item.context_package.coach_notes).toContain('suggest')

    // ─── Step 2: A.2 — 用 handoff item ID 拆子任務 ─────
    mockTaskFindFirst.mockResolvedValue(taskFixture)
    const createdSubTasks: any[] = []
    mockTransaction.mockImplementation(async (fn: any) => {
      const fakeTx = {
        subTask: {
          create: vi.fn().mockImplementation((args: any) => {
            createdSubTasks.push(args.data)
            return Promise.resolve({ id: `st-${createdSubTasks.length}` })
          }),
        },
      }
      return fn(fakeTx)
    })

    const captureUseCase = new CaptureUseCase()
    const captureResult = await captureUseCase.execute({
      userId,
      content: JSON.stringify({
        sub_items: [
          { title: '將 auth.ts middleware 改為 async', estimated_minutes: 60 },
          { title: '更新 3 個 route handlers', estimated_minutes: 90 },
          { title: '修改測試 mock', estimated_minutes: 45 },
        ],
        total_estimated_minutes: 195,
        codebase_context: 'auth.ts + 3 route files + test/',
      }),
      source: 'Claude Code',
      mode: 'execution_plan',
      parent_id: item.id, // ← 使用 A.1 的輸出 ID
    })

    // 驗證：數據合約相容 — parent_id 匹配
    expect(captureResult.parent_id).toBe(item.id)
    expect(captureResult.classified_as).toBe('execution_plan')
    expect(captureResult.filed_to.area).toBe('Work')
    expect(captureResult.filed_to.product).toBe('Zentropy')

    // 驗證：3 個子任務實際寫入 DB（transaction callback 被執行）
    expect(createdSubTasks).toHaveLength(3)
    expect(createdSubTasks[0].content).toBe('將 auth.ts middleware 改為 async')
    expect(createdSubTasks[0].task_id).toBe(item.id)
    expect(createdSubTasks[0].estimated_minutes).toBe(60)
    expect(createdSubTasks[1].content).toBe('更新 3 個 route handlers')
    expect(createdSubTasks[2].order).toBe(3)

    // 驗證：agent_actions 記錄了操作
    expect(captureResult.agent_actions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('created 3 sub-items'),
        expect.stringContaining('total estimated 195min'),
      ]),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════
// 情境 A.2→A.5: 記錄結果 → 報告完成 → 偏差學習
//
// 設計文件描述：
//   User (做完後): "Auth refactor 做完了，花了大概 5 小時"
//   capture(mode=result) → 記錄 actual_duration
//   report_done → Coach 計算偏差 (estimated 4h vs actual 5h = 1.25x)
//   Coach 回饋: "比你的重構歷史平均 1.8x 好多了！"
// ═══════════════════════════════════════════════════════════════════

describe('情境 A.2→A.5: capture(result) → report_done → 偏差計算 + 回饋', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('capture 記錄 actual_duration → report_done 計算偏差 → Coach 生成歷史比較回饋', async () => {
    // ─── Step 1: capture(result) — 記錄執行結果 ─────────
    mockTaskFindFirst.mockResolvedValue(taskFixture)
    mockDailyPlanItemFindFirst.mockResolvedValue({
      id: 'item-1',
      task_id: 'task-auth-refactor',
      estimated_minutes: 240,
    })
    mockDailyPlanItemUpdate.mockResolvedValue({})

    const captureUseCase = new CaptureUseCase()
    const captureResult = await captureUseCase.execute({
      userId,
      content: JSON.stringify({
        outcome: 'completed',
        actual_duration_minutes: 300,
        notes: '比預期複雜，legacy 相容問題',
        artifacts: ['PR #67'],
      }),
      source: 'Claude Code',
      mode: 'result',
      parent_id: 'task-auth-refactor',
    })

    // 驗證：actual_duration 已持久化到 dailyPlanItem
    expect(mockDailyPlanItemUpdate).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { actual_minutes: 300 },
    })
    expect(captureResult.agent_actions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('recorded actual time 300min'),
        expect.stringContaining('archived notes'),
      ]),
    )

    // ─── Step 2: report_done — 閉環 + 偏差學習 ─────────
    // 重新設置 mock（模擬第二次 DB 呼叫）
    mockTaskFindFirst.mockResolvedValue(taskFixture)
    mockDailyPlanItemFindFirst.mockResolvedValue({
      id: 'item-1',
      task_id: 'task-auth-refactor',
      estimated_minutes: 240,
    })
    mockTransaction.mockImplementation(async (fn: any) => {
      const fakeTx = {
        task: { update: vi.fn().mockResolvedValue({}) },
        dailyPlanItem: { update: vi.fn().mockResolvedValue({}) },
      }
      return fn(fakeTx)
    })
    // 歷史 bias 資料：Work area = 1.8x
    mockQueryRaw.mockResolvedValue(calibrationBias180)

    const reportDoneUseCase = new ReportDoneUseCase()
    const doneResult = await reportDoneUseCase.execute({
      userId,
      actionId: 'task-auth-refactor',
      actualDurationMinutes: 300,
      outcome: 'completed',
    })

    // 驗證：偏差計算正確
    expect(doneResult.deviation).not.toBeNull()
    expect(doneResult.deviation!.estimated_minutes).toBe(240)
    expect(doneResult.deviation!.actual_minutes).toBe(300)
    expect(doneResult.deviation!.ratio).toBeCloseTo(1.25, 1)

    // 驗證：Coach 回饋包含歷史比較（1.25x < 1.80x → 表現改善）
    expect(doneResult.coach_feedback).toBeDefined()
    expect(doneResult.coach_feedback).toContain('1.25x')
    // Coach 指出比歷史平均好
    expect(doneResult.coach_feedback).toMatch(/Better|Improving|better|improving|好/)

    // 驗證：任務已歸檔
    expect(doneResult.archived).toBe(true)
    expect(doneResult.completed_at).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════════
// 情境 A.5→A.1: 偏差回饋迴路
//
// 設計文件的核心承諾：
//   report_done 更新 bias 後，下一次 handoff/ready 的 coach_notes
//   應反映更新後的偏差值，形成「做→學→計畫→做」的閉環。
// ═══════════════════════════════════════════════════════════════════

describe('情境 A.5→A.1: report_done 偏差更新 → 下次 handoff coach_notes 反映新值', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('bias 從 1.80x 改善後，handoff coach_notes 應顯示更新後的偏差', async () => {
    // ─── Step 1: 初始 handoff — bias = 1.80x ───────────
    mockDailyPlanFindFirst.mockResolvedValue(planFixture)
    mockDailyPlanItemFindMany.mockResolvedValue([planItemFixture])
    mockQueryRaw.mockResolvedValue(calibrationBias180) // 1.80x

    const handoffUseCase = new GetHandoffReadyUseCase()
    const firstHandoff = await handoffUseCase.execute({ userId })

    const firstCoachNotes = firstHandoff.handoff_items[0].context_package.coach_notes
    expect(firstCoachNotes).toContain('1.80x')

    // ─── Step 2: 模擬 report_done 後 DB 新增一筆 ──────
    // 新紀錄：estimated=240, actual=300 (ratio=1.25x)
    // 整體 ratio: (180+180+180+300)/(100+100+100+240) = 840/540 ≈ 1.56x
    const updatedCalibration = [
      ...calibrationBias180,
      { area_name: 'Work', estimated_minutes: 240, actual_minutes: 300 },
    ]
    mockQueryRaw.mockResolvedValue(updatedCalibration)

    // ─── Step 3: 再次讀 handoff — 應反映新 bias ────────
    const secondHandoff = await handoffUseCase.execute({ userId })

    const secondCoachNotes = secondHandoff.handoff_items[0].context_package.coach_notes
    // 不再是 1.80x
    expect(secondCoachNotes).not.toContain('1.80x')
    // 新的 bias 值包含在 coach_notes 中（格式: X.XXx）
    expect(secondCoachNotes).toMatch(/\d+\.\d+x/)
    // 偏差方向正確：新 bias (≈1.56x) 低於舊 bias (1.80x)
    const biasMatch = secondCoachNotes.match(/(\d+\.\d+)x/)
    expect(biasMatch).not.toBeNull()
    const newBias = parseFloat(biasMatch![1])
    expect(newBias).toBeLessThan(1.80)
    expect(newBias).toBeGreaterThan(1.0)
  })

  it('memory/bias resource 同步反映 report_done 後的偏差更新', async () => {
    // ─── 初始 bias = 1.80x ───────────────────────────
    mockQueryRaw.mockResolvedValue(calibrationBias180)

    const biasUseCase = new GetMemoryBiasUseCase()
    const firstBias = await biasUseCase.execute({ userId })

    expect(firstBias.overall_bias_ratio).toBeCloseTo(1.80, 1)
    expect(firstBias.by_area['Work'].bias).toBeCloseTo(1.80, 1)
    expect(firstBias.by_area['Work'].sample_size).toBe(3)

    // ─── 新增一筆 actual/estimated = 1.25x ────────────
    const updatedCalibration = [
      ...calibrationBias180,
      { area_name: 'Work', estimated_minutes: 240, actual_minutes: 300 },
    ]
    mockQueryRaw.mockResolvedValue(updatedCalibration)

    const secondBias = await biasUseCase.execute({ userId })

    // bias 從 1.80 下降到 ≈1.56
    expect(secondBias.overall_bias_ratio).toBeLessThan(1.80)
    expect(secondBias.by_area['Work'].bias).toBeLessThan(1.80)
    expect(secondBias.by_area['Work'].sample_size).toBe(4)

    // insight 應反映改善趨勢（underestimate by less）
    expect(secondBias.insight).toBeDefined()
    expect(secondBias.insight.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 情境 A.3→系統: 隨手記 → brain-dump → 歸檔
//
// 設計文件描述：
//   User (在 Claude Desktop 聊天):
//   "剛跟客戶開會，他們要 API response 從 snake_case 改成 camelCase。
//    還有，提醒我 Q1 報告下週交。"
//   → capture(thought) × 2
//   → Gatekeeper 自動分類 → Librarian 歸檔
//   → 用戶看到：✓ filed to Work/Client-A/API Integration
// ═══════════════════════════════════════════════════════════════════

describe('情境 A.3: Claude Desktop 隨手記 → brain-dump pipeline → 系統歸檔', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('兩筆隨手記各自走 brain-dump pipeline，返回不同的持久化 ID', async () => {
    const mockApiClient = {
      captureThought: vi.fn(),
    } as unknown as BackendApiClient

    const authContext: AuthContext = {
      userId,
      clientId: 'claude-desktop',
      scopes: ['write:inbox'],
      tokenExpiry: Date.now() + 3600000,
    }

    // 第一筆：API 格式變更需求
    ;(mockApiClient.captureThought as any).mockResolvedValueOnce({
      id: 'bd-api-change-001',
      status: 'completed',
      title: 'API camelCase 需求',
    })

    // 第二筆：Q1 報告提醒
    ;(mockApiClient.captureThought as any).mockResolvedValueOnce({
      id: 'bd-q1-report-002',
      status: 'completed',
      title: 'Q1 報告',
    })

    // ─── 第一筆：API 格式變更 ───────────────────────
    const result1 = await handleCapture(mockApiClient, authContext, {
      content: '客戶要 API response format 從 snake_case 改成 camelCase',
      source: 'Claude Desktop',
      mode: 'thought',
      context_hint: 'Work/Client-A/API Integration',
    }, false)

    // ─── 第二筆：Q1 報告提醒 ────────────────────────
    const result2 = await handleCapture(mockApiClient, authContext, {
      content: 'Q1 報告下週交',
      source: 'Claude Desktop',
      mode: 'thought',
      context_hint: 'Work/Finance',
    }, false)

    // 驗證：兩筆各自走了 brain-dump pipeline
    expect(mockApiClient.captureThought).toHaveBeenCalledTimes(2)

    // 驗證：返回不同的持久化 ID（來自 brain-dump pipeline，不是本地生成）
    expect(result1.id).toBe('bd-api-change-001')
    expect(result2.id).toBe('bd-q1-report-002')
    expect(result1.id).not.toBe(result2.id)

    // 驗證：兩筆都正確分類為 thought
    expect(result1.classified_as).toBe('thought')
    expect(result2.classified_as).toBe('thought')

    // 驗證：context_hint 有傳遞給 brain-dump pipeline
    expect(mockApiClient.captureThought).toHaveBeenNthCalledWith(1, userId, {
      content: '客戶要 API response format 從 snake_case 改成 camelCase',
      source: 'Claude Desktop',
      context_hint: 'Work/Client-A/API Integration',
    })
    expect(mockApiClient.captureThought).toHaveBeenNthCalledWith(2, userId, {
      content: 'Q1 報告下週交',
      source: 'Claude Desktop',
      context_hint: 'Work/Finance',
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// 情境 A.6: areas + context/now 提供一致的全局視圖
//
// 設計文件描述：
//   User (在 Cursor): "幫我寫新的 Librarian rules engine"
//   Cursor AI 自動讀取:
//   - zentropy://areas → 知道 Work/Zentropy/Architecture 結構
//   - zentropy://context/now → 知道有逾期任務、bias 數據
//   兩個 resource 返回的 area 名稱必須一致。
// ═══════════════════════════════════════════════════════════════════

describe('情境 A.6: Cursor 讀取 areas + context/now — 跨 Resource 數據一致性', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('areas 的 area 名稱與 context/now 的 estimation_bias.by_area key 一致', async () => {
    // ─── 設置共同的 mock 數據 ──────────────────────
    mockAreaFindMany.mockResolvedValue([
      {
        id: 'area-work',
        name: 'Work',
        products: [
          {
            id: 'prod-zentropy',
            name: 'Zentropy',
            status: 'ACTIVE',
            topics: [
              { id: 't1', name: 'Architecture' },
              { id: 't2', name: 'Frontend' },
            ],
            _count: { tasks: 12 },
          },
        ],
      },
      {
        id: 'area-personal',
        name: 'Personal',
        products: [
          {
            id: 'prod-health',
            name: 'Health',
            status: 'MAINTAIN',
            topics: [{ id: 't3', name: 'Exercise' }],
            _count: { tasks: 3 },
          },
        ],
      },
    ])

    // context/now 需要 CoachDataAggregator (7 queries) + CoachCalibration (1 query)
    let queryRawCallCount = 0
    mockQueryRaw.mockImplementation(() => {
      queryRawCallCount++
      switch (queryRawCallCount) {
        case 1: return Promise.resolve([]) // calendar events
        case 2: return Promise.resolve([{  // overdue task
          id: 'task-overdue-1', content: '逾期的 auth 重構', status: 'ACTIVE',
          due_date: new Date('2026-02-10'), updated_at: new Date('2026-02-05'),
          area_name: 'Work', product_name: 'Zentropy',
          urgency_level: 'high', estimated_minutes: 60,
        }])
        case 3: return Promise.resolve([]) // approaching
        case 4: return Promise.resolve([]) // completed today
        case 5: return Promise.resolve([]) // remaining
        case 6: return Promise.resolve([]) // stagnant products
        case 7: return Promise.resolve([]) // tomorrow preview
        case 8: return Promise.resolve([  // calibration: Work + Personal
          { area_name: 'Work', estimated_minutes: 100, actual_minutes: 180 },
          { area_name: 'Work', estimated_minutes: 100, actual_minutes: 180 },
          { area_name: 'Work', estimated_minutes: 100, actual_minutes: 180 },
          { area_name: 'Personal', estimated_minutes: 100, actual_minutes: 110 },
          { area_name: 'Personal', estimated_minutes: 100, actual_minutes: 110 },
          { area_name: 'Personal', estimated_minutes: 100, actual_minutes: 110 },
        ])
        default: return Promise.resolve([])
      }
    })

    // ─── Step 1: 讀取 areas ─────────────────────────
    const areasUseCase = new GetAreasHierarchyUseCase()
    const areas = await areasUseCase.execute({ userId })

    const areaNames = areas.areas.map(a => a.name)
    expect(areaNames).toContain('Work')
    expect(areaNames).toContain('Personal')
    // 階層結構完整
    const workArea = areas.areas.find(a => a.name === 'Work')!
    expect(workArea.products[0].name).toBe('Zentropy')
    expect(workArea.products[0].topics).toEqual(['Architecture', 'Frontend'])
    expect(workArea.products[0].active_actions).toBe(12)

    // ─── Step 2: 讀取 context/now ───────────────────
    const contextUseCase = new GetContextNowUseCase()
    const context = await contextUseCase.execute({ userId })

    // ─── Step 3: 驗證跨 Resource 數據一致性 ──────────
    // context/now 的 estimation_bias.by_area 的 key 必須在 areas 中存在
    const biasAreaNames = Object.keys(context.estimation_bias.by_area)
    for (const biasAreaName of biasAreaNames) {
      expect(areaNames).toContain(biasAreaName)
    }

    // Work 有 bias（>= 3 samples）
    expect(context.estimation_bias.by_area['Work']).toBeDefined()
    expect(context.estimation_bias.by_area['Work']).toBeCloseTo(1.8, 1)

    // Personal 也有 bias
    expect(context.estimation_bias.by_area['Personal']).toBeDefined()
    expect(context.estimation_bias.by_area['Personal']).toBeCloseTo(1.1, 1)

    // top_priorities 包含 { id, title }（不是裸 ID）
    expect(context.top_priorities.length).toBeGreaterThan(0)
    expect(context.top_priorities[0]).toHaveProperty('id')
    expect(context.top_priorities[0]).toHaveProperty('title')
    expect(context.top_priorities[0].id).toBe('task-overdue-1')
    expect(context.top_priorities[0].title).toBe('逾期的 auth 重構')

    // overdue 計數正確
    expect(context.overdue).toBe(1)

    // summary 包含 overdue 描述
    expect(context.summary).toContain('overdue')
  })
})
