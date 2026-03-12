/**
 * Agent Baseline 測試
 *
 * 評估目標：
 * 1. Skill trigger 準確性（正確的訊息觸發正確的 skill）
 * 2. Tool calling 行為（brain_dump / reorganize_preview 是否被呼叫）
 * 3. Context token 增長（multi-turn 的 token 累積狀況）
 * 4. Agent 回應合理度（內容是否符合預期方向）
 *
 * 測試採用真實 LLM 呼叫，不 mock，反映真實效能。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { createZentropyAgent } from '@/application/use-cases/agent/zentropy-agent'
import { getAgentChatModelName } from '@/lib/agent-model'
import type { NaruResult } from 'naru-agent-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ============================================================================
// Fixtures
// ============================================================================

interface AgentMetrics {
  scenario: string
  message: string
  response: string
  toolCalls: string[]
  tokens: { prompt: number; completion: number; total: number }
  latencyMs: number
  skillTriggered: string | null
  qualityNotes: string[]
}

interface BaselineScoreBreakdown {
  fallbackPenalty: number
  errorLikePenalty: number
  latencyPenalty: number
  tokenPenalty: number
  toolCoveragePenalty: number
}

interface BaselineReport {
  generatedAt: string
  model: string
  scenarioCount: number
  totalTokens: number
  averageTokens: number
  averageLatencyMs: number
  maxLatencyMs: number
  toolCallRate: number
  requiredToolCoverage: number
  fallbackCount: number
  errorLikeCount: number
  score: number
  scoreBreakdown: BaselineScoreBreakdown
  obviousFailures: string[]
  scenarios: AgentMetrics[]
}

const SESSION_ID = `agent-baseline-${Date.now()}`
const REPORT_PATH = process.env.AGENT_BASELINE_REPORT_PATH
  ?? path.join(process.cwd(), 'test-results', 'agent-baseline-latest.json')
const AGENT_MODEL = getAgentChatModelName()

// 合理度評估 helper（啟發式，不走 LLM judge）
function assessQuality(message: string, result: NaruResult): string[] {
  const notes: string[] = []
  const reply = result.content.toLowerCase()

  if (result.content.length < 10) notes.push('⚠️ 回應過短')
  if (result.content.includes('抱歉，我剛剛出了一點狀況')) notes.push('❌ FALLBACK 被觸發')
  if (result.toolCalls.length > 0) notes.push(`✅ 工具呼叫: ${result.toolCalls.join(', ')}`)
  if (reply.includes('✅') || reply.includes('已記錄') || reply.includes('記下')) notes.push('✅ 確認性語氣')
  if (reply.includes('抱歉') && !reply.includes('出了一點狀況')) notes.push('ℹ️ 含道歉語氣')
  if (reply.includes('？') || reply.includes('嗎')) notes.push('ℹ️ 含確認/疑問句')
  if (reply.includes('開發中') || reply.includes('即將推出')) notes.push('ℹ️ 功能未上線提示')

  return notes
}

function inferSkill(toolCalls: string[], message: string): string | null {
  if (toolCalls.includes('brain_dump')) return 'brain_dump'
  if (toolCalls.includes('reorganize_preview')) return 'reorganize'
  const lower = message.toLowerCase()
  if (['規劃', '拆解', '展開'].some(t => lower.includes(t))) return 'planner (no tool)'
  return null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildBaselineReport(allMetrics: AgentMetrics[]): BaselineReport {
  const totalTokens = allMetrics.reduce((s, m) => s + m.tokens.total, 0)
  const avgTokens = Math.round(totalTokens / allMetrics.length)
  const avgLatency = Math.round(
    allMetrics.reduce((s, m) => s + m.latencyMs, 0) / allMetrics.length
  )
  const maxLatency = Math.max(...allMetrics.map((m) => m.latencyMs))
  const toolCallRate = allMetrics.filter((m) => m.toolCalls.length > 0).length / allMetrics.length
  const fallbackCount = allMetrics.filter((m) =>
    m.response.includes('出了一點狀況')
  ).length
  const errorLikeCount = allMetrics.filter((m) =>
    /(發生錯誤|無法處理|處理任務時發生錯誤)/.test(m.response)
  ).length

  const scenariosRequiringTools = SCENARIOS.filter((s) => s.expectedToolCalls.length > 0)
  const expectedToolCallsTotal = scenariosRequiringTools.reduce((sum, s) => sum + s.expectedToolCalls.length, 0)
  const expectedToolCallsHit = scenariosRequiringTools.reduce((sum, s) => {
    const metric = allMetrics.find((m) => m.scenario === s.name)
    if (!metric) return sum
    const hit = s.expectedToolCalls.filter((tool) => metric.toolCalls.includes(tool)).length
    return sum + hit
  }, 0)
  const requiredToolCoverage = expectedToolCallsTotal > 0 ? expectedToolCallsHit / expectedToolCallsTotal : 1

  const breakdown: BaselineScoreBreakdown = {
    fallbackPenalty: fallbackCount * 20,
    errorLikePenalty: errorLikeCount * 8,
    latencyPenalty: avgLatency > 8000 ? Math.min(20, Math.round((avgLatency - 8000) / 500)) : 0,
    tokenPenalty: avgTokens > 1200 ? Math.min(12, Math.round((avgTokens - 1200) / 100)) : 0,
    toolCoveragePenalty: Math.round((1 - requiredToolCoverage) * 40),
  }
  const rawScore = 100
    - breakdown.fallbackPenalty
    - breakdown.errorLikePenalty
    - breakdown.latencyPenalty
    - breakdown.tokenPenalty
    - breakdown.toolCoveragePenalty
  const score = clamp(Math.round(rawScore), 0, 100)

  const obviousFailures: string[] = []
  if (fallbackCount > 0) obviousFailures.push(`fallback_count=${fallbackCount}`)
  if (requiredToolCoverage < 1) obviousFailures.push(`required_tool_coverage=${requiredToolCoverage.toFixed(2)}`)
  if (allMetrics.some((m) => m.response.length < 10)) obviousFailures.push('too_short_response_detected')

  return {
    generatedAt: new Date().toISOString(),
    model: AGENT_MODEL,
    scenarioCount: allMetrics.length,
    totalTokens,
    averageTokens: avgTokens,
    averageLatencyMs: avgLatency,
    maxLatencyMs: maxLatency,
    toolCallRate,
    requiredToolCoverage,
    fallbackCount,
    errorLikeCount,
    score,
    scoreBreakdown: breakdown,
    obviousFailures,
    scenarios: allMetrics,
  }
}

function writeBaselineReport(report: BaselineReport): void {
  const outputDir = path.dirname(REPORT_PATH)
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8')
}

// ============================================================================
// 測試情境設計
// ============================================================================

interface Scenario {
  name: string
  message: string
  expectedSkill: string | null         // 預期觸發的 skill
  expectedToolCalls: string[]          // 預期的 tool calls
  responseContains?: string[]          // 回應應包含的關鍵詞（任一）
  responseContainsAll?: string[]       // 回應必須包含的關鍵詞（全部）
  responseNotContains?: string[]       // 回應不應包含的關鍵詞
  responseNotMatch?: RegExp[]          // 回應不應匹配的模式
  sessionId?: string                   // 指定 session（multi-turn 用）
  allowFallback?: boolean              // 允許 fallback（記錄但不失敗）
}

const INTELLIGENCE_TASK_CODE = `ALPHA-${Date.now().toString().slice(-6)}`
const UNKNOWN_TASK_CODE = `NO-TASK-${Date.now().toString().slice(-6)}`

const SCENARIOS: Scenario[] = [
  // ── Brain Dump ──────────────────────────────────────────────────────────
  {
    name: 'BD-1: 明確 brain dump（幫我記）',
    message: '幫我記一下明天下午要跟客戶開產品 review 會議',
    expectedSkill: 'brain_dump',
    expectedToolCalls: ['brain_dump'],
    responseContains: ['記錄', '已記', '已記下', '記下', '✅'],
  },
  {
    name: 'BD-2: 待辦關鍵字觸發',
    message: '待辦：準備 Q2 OKR 報告初稿，這週五前完成',
    expectedSkill: 'brain_dump',
    expectedToolCalls: ['brain_dump'],
    responseContains: ['記錄', '已記', '已記下', '記下', '✅', 'OKR'],
  },
  {
    name: 'BD-3: 隱含 brain dump（無明確關鍵字）',
    message: '下週要去台北出差，記得訂機票和飯店',
    expectedSkill: null,                // 可能不觸發 skill（無關鍵字）
    expectedToolCalls: [],
    responseContains: ['記錄', '記下', '台北', '機票', '嗎'],
    responseNotMatch: [
      /✅\s*已記錄/u,
      /已記錄.+台北出差/u,
    ],
  },

  // ── Multi-turn session context ───────────────────────────────────────────
  {
    name: 'MT-1: session 第一輪（記錄任務）',
    message: '幫我記一下要研究競品分析報告',
    expectedSkill: 'brain_dump',
    expectedToolCalls: ['brain_dump'],
    sessionId: `${SESSION_ID}-mt`,
  },
  {
    name: 'MT-2: session 第二輪（修正上一句）',
    message: '剛才那個競品分析要放在行銷產品線，不是研發',
    expectedSkill: null,
    expectedToolCalls: [],
    responseContains: ['競品', '行銷', '修正', '了解', '更新'],
    sessionId: `${SESSION_ID}-mt`,  // 同一 session，應有上下文
  },
  {
    name: 'MT-3: session 第三輪（一般問句）',
    message: '我剛才記了什麼？',
    expectedSkill: null,
    expectedToolCalls: [],
    responseContains: ['競品'],          // 應能從 session 回憶
    sessionId: `${SESSION_ID}-mt`,
  },

  // ── Reorganize ───────────────────────────────────────────────────────────
  {
    name: 'RO-1: 整理任務觸發',
    message: '幫我整理一下現在的任務結構，感覺太亂了',
    expectedSkill: 'reorganize',
    expectedToolCalls: ['reorganize_preview'],
    responseContains: ['分析', '整理', '建議', '結構', '合併', '沒有'],
  },

  // ── Planner (stub) ───────────────────────────────────────────────────────
  {
    name: 'PL-1: 規劃功能（應提示開發中）',
    message: '幫我規劃一個新功能從零到上線的完整計畫',
    expectedSkill: 'planner (no tool)',
    expectedToolCalls: [],
    responseContains: ['開發中', '即將', 'brain', '記下', '規劃'],
  },

  // ── No skill (general conversation) ──────────────────────────────────────
  {
    name: 'GN-1: 一般問候（無 skill）',
    message: '你好，你是誰？你可以做什麼？',
    expectedSkill: null,
    expectedToolCalls: [],
    responseContains: ['Naru', 'Zentropy', '任務', '記錄', '整理'],
  },
  {
    name: 'GN-2: 模糊問句（無明確意圖）',
    message: '我有點累，不知道今天要做什麼好',
    expectedSkill: null,
    expectedToolCalls: [],
    allowFallback: true,
  },

  // ── Edge cases ───────────────────────────────────────────────────────────
  {
    name: 'EG-1: 極短輸入',
    message: '記',
    expectedSkill: null,
    expectedToolCalls: [],
    allowFallback: true,
  },
  {
    name: 'EG-2: 夾雜中英文',
    message: 'help me 記一下 tomorrow 要 submit the PR for feature/auth',
    expectedSkill: 'brain_dump',
    expectedToolCalls: ['brain_dump'],
    responseContains: ['PR', '記錄', '已記', '已記下', '記下', '✅'],
    allowFallback: true,
  },

  // ── Intelligence / reasoning signals ─────────────────────────────────────
  {
    name: 'IQ-1: 記錄含隨機代號（非模板）',
    message: `幫我記一下任務代號 ${INTELLIGENCE_TASK_CODE}，內容是整理競品投影片`,
    expectedSkill: 'brain_dump',
    expectedToolCalls: ['brain_dump'],
    responseContains: [INTELLIGENCE_TASK_CODE, '整理競品投影片', '記錄', '已記'],
    sessionId: `${SESSION_ID}-iq`,
  },
  {
    name: 'IQ-2: 指代修正上一輪任務位置',
    message: '把剛剛那個改到行銷產品線，不是產品開發',
    expectedSkill: null,
    expectedToolCalls: ['adjust_tags_preview'],
    responseContains: ['行銷', '產品開發', '調整', '預覽'],
    sessionId: `${SESSION_ID}-iq`,
  },
  {
    name: 'IQ-3: 回憶抽取（只回答代號）',
    message: '我剛剛說的任務代號是什麼？只回答代號',
    expectedSkill: null,
    expectedToolCalls: [],
    responseContainsAll: [INTELLIGENCE_TASK_CODE],
    sessionId: `${SESSION_ID}-iq`,
  },
  {
    name: 'IQ-4: 模糊完成需澄清，不可假裝完成',
    message: `幫我完成任務 ${UNKNOWN_TASK_CODE}`,
    expectedSkill: null,
    expectedToolCalls: ['complete_task_search'],
    responseContains: ['找不到', '更精確', '請提供', '候選', '無法判斷', '請確認', '任務名稱', '發生錯誤'],
    responseNotMatch: [
      /已(經)?(為您|幫你|替你)?標記.*完成/,
      /已完成「?.+」?/,
    ],
  },
]

// ============================================================================
// Setup
// ============================================================================

describe('Agent Baseline 評估', () => {
  let testUserId: string
  const allMetrics: AgentMetrics[] = []

  beforeAll(async () => {
    // 建立測試用戶
    const testUser = await prisma.user.create({
      data: {
        email: `agent-baseline-${Date.now()}@test.example.com`,
        auth_provider_id: `agent-baseline-${Date.now()}`,
        auth_provider: 'EMAIL',
        name: 'Agent Baseline Test User',
      },
    })
    testUserId = testUser.id

    // 建立貼近真實的任務結構（讓 brain_dump + reorganize 有脈絡可循）
    const area = await prisma.area.create({
      data: {
        user_id: testUserId,
        name: '工作',
        scope: '工作相關任務',
        is_custom: true,
      },
    })

    const products = await Promise.all([
      prisma.product.create({
        data: {
          user_id: testUserId,
          area_id: area.id,
          name: '產品開發',
          description: '核心產品功能迭代',
          status: 'ACTIVE',
          display_order: 0,
          lifecycle: 'FINITE',
        },
      }),
      prisma.product.create({
        data: {
          user_id: testUserId,
          area_id: area.id,
          name: '行銷',
          description: '市場推廣與用戶增長',
          status: 'ACTIVE',
          display_order: 1,
          lifecycle: 'FINITE',
        },
      }),
    ])

    // 各 Product 各建 3 個任務
    await Promise.all(
      products.flatMap((p, pi) =>
        [0, 1, 2].map((ti) =>
          prisma.task.create({
            data: {
              user_id: testUserId,
              product_id: p.id,
              content: pi === 0
                ? ['撰寫 API 文件', '修復登入 bug', '實作搜尋功能'][ti]
                : ['準備競品分析', '撰寫部落格文章', '規劃 Q2 活動'][ti],
              status: 'ACTIVE',
            },
          })
        )
      )
    )
  }, 30_000)

  afterAll(async () => {
    // 清理測試資料（注意 FK 順序）
    await prisma.subTask.deleteMany({ where: { task: { user_id: testUserId } } })
    await prisma.task.deleteMany({ where: { user_id: testUserId } })
    await prisma.topic.deleteMany({ where: { product: { user_id: testUserId } } })
    await prisma.product.deleteMany({ where: { user_id: testUserId } })
    await prisma.area.deleteMany({ where: { user_id: testUserId } })
    await prisma.systemEvaluationLog.deleteMany({ where: { user_id: testUserId } })
    await prisma.user.delete({ where: { id: testUserId } })

    // 清理 naru_memories
    await prisma.$executeRaw`
      DELETE FROM naru_memories WHERE user_id = ${testUserId}
    `
  }, 15_000)

  // ============================================================================
  // 情境測試
  // ============================================================================

  SCENARIOS.forEach((scenario) => {
    it(scenario.name, async () => {
      const agent = createZentropyAgent(testUserId)
      const sessionId = scenario.sessionId ?? `${SESSION_ID}-${scenario.name}`

      const start = Date.now()
      const result = await agent.chat(scenario.message, {
        userId: testUserId,
        sessionId,
      })
      const latencyMs = Date.now() - start

      const qualityNotes = assessQuality(scenario.message, result)
      const skillTriggered = inferSkill(result.toolCalls, scenario.message)

      // 收集 metrics
      allMetrics.push({
        scenario: scenario.name,
        message: scenario.message,
        response: result.content,
        toolCalls: result.toolCalls,
        tokens: {
          prompt: result.usage.promptTokens,
          completion: result.usage.completionTokens,
          total: result.usage.totalTokens,
        },
        latencyMs,
        skillTriggered,
        qualityNotes,
      })

      // ── 基本斷言 ──────────────────────────────────────────────────────
      expect(result.content).toBeTruthy()
      if (!scenario.allowFallback) {
        expect(result.content).not.toBe('抱歉，我剛剛出了一點狀況，可以再說一次嗎？')
      }
      expect(result.content.length).toBeGreaterThan(5)

      // ── Tool call 驗證 ──────────────────────────────────────────────
      for (const expected of scenario.expectedToolCalls) {
        expect(
          result.toolCalls,
          `情境「${scenario.name}」應觸發 tool: ${expected}`
        ).toContain(expected)
      }

      // ── 回應內容驗證（任一關鍵字即通過）────────────────────────────
      if (scenario.responseContains?.length) {
        const reply = result.content
        const found = scenario.responseContains.some((kw) =>
          reply.includes(kw)
        )
        expect(
          found,
          `回應應包含以下任一關鍵字: [${scenario.responseContains.join(', ')}]\n實際回應: ${reply}`
        ).toBe(true)
      }

      // ── 回應內容驗證（全部關鍵字都要有）────────────────────────────
      if (scenario.responseContainsAll?.length) {
        for (const kw of scenario.responseContainsAll) {
          expect(
            result.content,
            `回應應包含關鍵字: ${kw}`
          ).toContain(kw)
        }
      }

      // ── 不應包含的內容 ────────────────────────────────────────────
      for (const kw of scenario.responseNotContains ?? []) {
        expect(
          result.content,
          `回應不應包含: ${kw}`
        ).not.toContain(kw)
      }

      // ── 不應匹配的模式 ────────────────────────────────────────────
      for (const pattern of scenario.responseNotMatch ?? []) {
        expect(
          result.content,
          `回應不應匹配模式: ${pattern.toString()}`
        ).not.toMatch(pattern)
      }

      // 輸出詳細資訊供人工審閱
      console.log(`
[${scenario.name}]
  訊息: ${scenario.message}
  延遲: ${latencyMs}ms
  Token: prompt=${result.usage.promptTokens} / completion=${result.usage.completionTokens} / total=${result.usage.totalTokens}
  Tools: [${result.toolCalls.join(', ') || '無'}]
  品質: ${qualityNotes.join(' | ')}
  回應: ${result.content.slice(0, 150)}${result.content.length > 150 ? '...' : ''}
`)
    }, 60_000)
  })

  // ============================================================================
  // Baseline 摘要（永遠通過，供未來對比）
  // ============================================================================

  it('📊 Baseline 摘要記錄', () => {
    if (allMetrics.length === 0) {
      console.log('（無 metrics，情境測試可能跳過）')
      expect(true).toBe(true)
      return
    }

    const report = buildBaselineReport(allMetrics)
    writeBaselineReport(report)

    // skill 觸發分佈
    const skillDist: Record<string, number> = {}
    for (const m of allMetrics) {
      const k = m.skillTriggered ?? 'none'
      skillDist[k] = (skillDist[k] ?? 0) + 1
    }

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Agent Baseline 評估報告 (${new Date().toISOString().slice(0, 10)})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Model: ${report.model}
🧮 Score: ${report.score}/100
📄 Report: ${REPORT_PATH}

📈 Token 使用
   ├─ 總計: ${report.totalTokens.toLocaleString()} tokens（${allMetrics.length} 個情境）
   ├─ 平均: ${report.averageTokens.toLocaleString()} tokens / 輪
   └─ 分佈:
${allMetrics.map((m) => `        ${m.scenario.padEnd(35)} prompt=${String(m.tokens.prompt).padStart(6)} comp=${String(m.tokens.completion).padStart(5)} total=${String(m.tokens.total).padStart(6)}`).join('\n')}

⏱️  延遲
   ├─ 平均: ${report.averageLatencyMs}ms
   ├─ 最大: ${report.maxLatencyMs}ms
   └─ 分佈:
${allMetrics.map((m) => `        ${m.scenario.padEnd(35)} ${m.latencyMs}ms`).join('\n')}

🎯 Skill / Tool 觸發
   ├─ 有工具呼叫: ${(report.toolCallRate * allMetrics.length).toFixed(0)}/${allMetrics.length} 個情境
   ├─ Required Tool Coverage: ${(report.requiredToolCoverage * 100).toFixed(1)}%
   ├─ Fallback 觸發: ${report.fallbackCount} 次
   └─ Skill 分佈: ${JSON.stringify(skillDist)}

🧯 Obvious Failures: ${report.obviousFailures.length > 0 ? report.obviousFailures.join(', ') : '無'}

🔍 逐一回應品質
${allMetrics.map((m) => `   [${m.scenario}]
      tools: [${m.toolCalls.join(', ') || '無'}]
      notes: ${m.qualityNotes.join(' | ') || '（無）'}
      reply: ${m.response.slice(0, 100)}${m.response.length > 100 ? '...' : ''}`).join('\n\n')}

⚠️  未來修改時應確保
   - Score 不低於 baseline gate
   - 平均 token ≤ ${report.averageTokens * 1.3 | 0}（當前 +30% 閾值）
   - brain_dump / reorganize_preview 情境工具呼叫率 = 100%
   - Fallback 觸發次數 = 0
   - 平均延遲 ≤ ${Math.round(report.averageLatencyMs * 1.5)}ms（當前 +50% 閾值）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

    expect(true).toBe(true)
  })
})
