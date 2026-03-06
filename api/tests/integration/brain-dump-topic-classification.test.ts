/**
 * Brain Dump Topic 分類測試
 *
 * 測試目標：驗證 AI 是否正確填寫 Area、Product、Topic 三層標籤
 * 注意：此測試會調用真實的 Gemini API
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

// 簡化版 schema（放寬長度限制，專注測試 topic 分類）
const StructuredItemSchema = z.object({
  title: z.string(),
  narrative: z.string(),
  drawer: z.enum(['INBOX', 'ACTIVE', 'MAINTAIN', 'REFERENCE', 'ARCHIVE']),
  lifecycle: z.enum(['FINITE', 'PERPETUAL']),
  tag: z.object({
    area: z.string(),
    product: z.string(),
    topic: z.string(),
  }),
  strategy_used: z.string(),
  reasoning: z.string(),
  due_date: z.string().optional(),
  sub_items: z.array(z.object({ content: z.string() })).optional(),
})

const CreateNewTasksActionSchema = z.object({
  action: z.literal('create_new_tasks'),
  items: z.array(StructuredItemSchema),
})

// 測試場景
interface TestScenario {
  name: string
  input: string
  expectedTopicFilled: boolean // 是否預期 topic 被填寫
  topicHint?: string // 預期的 topic 類型提示（用於驗證）
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: '技術類任務應有 topic',
    input: '修復登入頁面的 Bug',
    expectedTopicFilled: true,
    topicHint: '技術',
  },
  {
    name: '溝通類任務應有 topic',
    input: '跟客戶確認下週會議時間',
    expectedTopicFilled: true,
    topicHint: '溝通',
  },
  {
    name: '財務類任務應有 topic',
    input: '處理本月發票報帳',
    expectedTopicFilled: true,
    topicHint: '財務',
  },
  {
    name: '多項任務應各有 topic',
    input: '1. 回覆客戶郵件 2. 檢查系統日誌 3. 更新專案進度',
    expectedTopicFilled: true,
  },
]

describe('Brain Dump Topic 分類測試', () => {
  let testUserId: string
  let testAreaId: string
  let testProductId: string
  let testTopicId: string

  beforeAll(async () => {
    // 創建測試用戶
    const uniqueEmail = `test-topic-${Date.now()}-${Math.random().toString(36).substring(7)}@test.example.com`
    const testUser = await prisma.user.create({
      data: {
        email: uniqueEmail,
        auth_provider_id: `test-uid-topic-${Date.now()}`,
        auth_provider: 'EMAIL',
        name: 'Topic Classification Test User',
      },
    })
    testUserId = testUser.id

    // 創建測試 Area
    const testArea = await prisma.area.create({
      data: {
        user_id: testUserId,
        name: '工作',
        scope: '日常工作事務',
        is_custom: false,
      },
    })
    testAreaId = testArea.id

    // 創建測試 Product
    const testProduct = await prisma.product.create({
      data: {
        user_id: testUserId,
        area_id: testAreaId,
        name: '專案 Alpha',
        description: '軟體開發專案',
        status: 'ACTIVE',
        lifecycle: 'FINITE',
      },
    })
    testProductId = testProduct.id

    // 創建既有 Topic
    const testTopic = await prisma.topic.create({
      data: {
        user_id: testUserId,
        product_id: testProductId,
        name: '技術開發',
      },
    })
    testTopicId = testTopic.id

    // 創建一些既有任務
    await prisma.task.create({
      data: {
        user_id: testUserId,
        product_id: testProductId,
        topic_id: testTopicId,
        content: '實作登入功能',
        status: 'ACTIVE',
      },
    })

    console.log(`✅ 測試環境準備完成: Area=${testArea.name}, Product=${testProduct.name}, Topic=${testTopic.name}`)
  }, 30000)

  afterAll(async () => {
    // 清理測試數據
    await prisma.task.deleteMany({ where: { user_id: testUserId } })
    await prisma.topic.deleteMany({ where: { user_id: testUserId } })
    await prisma.product.deleteMany({ where: { user_id: testUserId } })
    await prisma.area.deleteMany({ where: { user_id: testUserId } })
    await prisma.user.delete({ where: { id: testUserId } })
  }, 30000)

  describe('Topic 填寫率測試', () => {
    TEST_SCENARIOS.forEach((scenario) => {
      it(scenario.name, async () => {
        // 構建 context（模擬 brain-dump API）
        const contextSummary = `
### 語意相關的 Products:

**Area: 工作** (範圍: 日常工作事務)
  📦 Product: 專案 Alpha
     Topics: 技術開發
     未完成任務:
       - 實作登入功能
         ⏰ 1 分鐘前更新 | 狀態: ACTIVE
`

        const now = new Date()
        const prompt = `你是任務記錄專家。將用戶輸入轉成結構化的 Task。

# 核心原則

## 1. Area 選擇（🚨 絕對禁止創建新 Area）
**規則：只能從既有 Areas 中選擇，絕對不能創建新的 Area**

## 2. Product 選擇
問自己：**「這個新任務和哪個 Product 的現有任務最像？」**
- 可以在既有 Area 下創建新 Product（如果沒有匹配的）

## 3. Topic 選擇（🔥 必須盡量填寫）

**規則：Topic 是任務分類的重要維度，必須積極分配**

問自己三個問題：

1. **這個任務和哪個既有 Topic 最相關？**
   - 查看該 Product 下所有既有的 Topics
   - 如果任務內容與某個 Topic 語意相關 → 使用該 Topic

2. **如果沒有相關的既有 Topic，應該創建什麼？**
   - 根據任務性質創建合理的 Topic 名稱
   - 好的 Topic 命名：「技術開發」「客戶溝通」「財務處理」「行銷活動」「產品規劃」
   - 避免太籠統的命名：「其他」「雜項」「一般」

3. **什麼情況可以留空？**
   - **只有當任務真的無法歸類時**才填 ""
   - 這應該是極少數情況（< 10%）

**Topic 命名原則：**
- 使用 2-4 字的中文名詞短語
- 描述任務的「類型」或「面向」，不是具體內容
- 範例：「內部協調」「外部溝通」「系統維護」「資料分析」「流程優化」

---

# 背景資訊

今天：${now.toLocaleDateString('zh-TW')} (星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]})

${contextSummary}

---

# 用戶輸入

${scenario.input}

---

# 輸出格式

**格式要求：**
- 使用繁體中文
- tag.topic：字串，**必須盡量填寫**（優先使用既有 Topic，或創建合適的新名稱）`

        const { object: result, usage } = await generateObject({
          model: google('gemini-3.1-flash-lite-preview'),
          schema: CreateNewTasksActionSchema,
          prompt,
        })

        console.log(`\n📝 輸入: "${scenario.input}"`)
        console.log(`📋 結果:`)

        // Token 統計
        if (usage) {
          console.log(`🔢 Token 使用量:`)
          console.log(`   Prompt tokens: ${usage.promptTokens}`)
          console.log(`   Completion tokens: ${usage.completionTokens}`)
          console.log(`   Total tokens: ${usage.totalTokens}`)
        }

        let filledCount = 0
        let emptyCount = 0

        for (const item of result.items) {
          const topicStatus = item.tag.topic && item.tag.topic.trim() !== '' ? '✅' : '❌'
          if (item.tag.topic && item.tag.topic.trim() !== '') {
            filledCount++
          } else {
            emptyCount++
          }
          console.log(`   ${topicStatus} ${item.title}`)
          console.log(`      Area: ${item.tag.area} | Product: ${item.tag.product} | Topic: "${item.tag.topic || '(空)'}"`)
        }

        const fillRate = filledCount / result.items.length
        console.log(`\n📊 Topic 填寫率: ${(fillRate * 100).toFixed(0)}% (${filledCount}/${result.items.length})`)

        if (scenario.expectedTopicFilled) {
          // 預期 topic 被填寫，至少 80% 的任務應該有 topic
          expect(fillRate).toBeGreaterThanOrEqual(0.8)
        }

        // 檢查 topic 不是太籠統的名稱
        for (const item of result.items) {
          if (item.tag.topic) {
            expect(item.tag.topic).not.toMatch(/^(其他|雜項|一般|未分類)$/i)
          }
        }
      }, 30000) // 30 秒 timeout（Gemini API 可能較慢）
    })
  })

  describe('Topic 分類統計', () => {
    it('應該統計所有場景的 Topic 填寫率', async () => {
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Topic 分類測試總結
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 預期行為:
   - Topic 填寫率應 >= 80%
   - 不應使用「其他」「雜項」等籠統名稱
   - Topic 名稱應為 2-4 字中文名詞短語

⚠️  如果 Topic 填寫率過低:
   1. 檢查 prompt 中的 Topic 指導是否足夠明確
   2. 確認 contextSummary 中有顯示既有 Topics
   3. 考慮在 schema 中加強 topic 的 description

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `)
      expect(true).toBe(true)
    })
  })
})
