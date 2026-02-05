/**
 * Brain Dump 效能測試（不需要資料庫）
 *
 * 執行：npx tsx scripts/test-brain-dump-performance.ts
 */

import "dotenv/config";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// 簡化版 schema
const StructuredItemSchema = z.object({
  title: z.string(),
  narrative: z.string(),
  drawer: z.enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"]),
  lifecycle: z.enum(["FINITE", "PERPETUAL"]),
  tag: z.object({
    area: z.string(),
    product: z.string(),
    topic: z.string(),
  }),
  strategy_used: z.string(),
  reasoning: z.string(),
  due_date: z.string().optional(),
  sub_items: z.array(z.object({ content: z.string() })).optional(),
});

const CreateNewTasksActionSchema = z.object({
  action: z.literal("create_new_tasks"),
  items: z.array(StructuredItemSchema),
});

// ============================================================================
// 動態預算分配邏輯（與 brain-dump API 相同）
// ============================================================================
const MAX_CONTEXT_ITEMS = 100; // tasks + sub_items 總數上限

function calculateBudget(productCount: number): { tasksPerProduct: number; subItemsPerTask: number } {
  if (productCount === 0) return { tasksPerProduct: 0, subItemsPerTask: 0 };

  // 先分配 tasks（每個 Product 至少 1 個，最多 5 個）
  const tasksPerProduct = Math.max(1, Math.min(5, Math.floor(MAX_CONTEXT_ITEMS / productCount)));
  const totalTaskBudget = productCount * tasksPerProduct;

  // 剩餘預算分配給 sub_items（每個 task 最多 2 個）
  const remainingBudget = MAX_CONTEXT_ITEMS - totalTaskBudget;
  const subItemsPerTask = Math.max(0, Math.min(2, Math.floor(remainingBudget / totalTaskBudget)));

  return { tasksPerProduct, subItemsPerTask };
}

// 模擬不同規模的 context（使用動態預算）
function generateMockContext(productCount: number): string {
  const { tasksPerProduct, subItemsPerTask } = calculateBudget(productCount);

  console.log(`📊 Budget: ${productCount} Products × ${tasksPerProduct} tasks × ${subItemsPerTask} sub_items`);

  const areas = ["工作", "生活", "健康"];
  let context = "\n### 用戶的 Products 與任務:\n\n";
  let productIndex = 0;

  for (const area of areas) {
    const productsInArea = Math.ceil(productCount / areas.length);
    if (productIndex >= productCount) break;

    context += `\n**Area: ${area}** (範圍: ${area}相關事務)\n`;

    for (let p = 1; p <= productsInArea && productIndex < productCount; p++) {
      productIndex++;
      context += `  📦 Product: ${area}專案${p}\n`;
      context += `     Topics: 主題A, 主題B\n`;

      if (tasksPerProduct > 0) {
        context += `     未完成任務:\n`;
        for (let t = 1; t <= tasksPerProduct; t++) {
          context += `       - [task-${area}-${p}-${t}] ${area}任務${t}的內容描述\n`;
          context += `         ⏰ ${t} 小時前更新 | 狀態: ACTIVE\n`;

          if (subItemsPerTask > 0) {
            context += `         已有的待辦項目:\n`;
            for (let s = 1; s <= subItemsPerTask; s++) {
              context += `           ☐ 子項目 ${s}\n`;
            }
          }
        }
      } else {
        context += `     未完成任務: (無)\n`;
      }
    }
  }

  return context;
}

async function runTest(userInput: string, productCount: number) {
  const now = new Date();

  // 使用動態預算生成 context
  const contextSummary = generateMockContext(productCount);

  const prompt = `你是任務記錄專家。將用戶輸入轉成結構化的 Task。

# 核心原則

## 1. Area 選擇（🚨 絕對禁止創建新 Area）
**規則：只能從既有 Areas 中選擇，絕對不能創建新的 Area**

## 2. Product 選擇
問自己：**「這個新任務和哪個 Product 的現有任務最像？」**

## 3. Topic 選擇（🔥 必須盡量填寫）
**規則：Topic 是任務分類的重要維度，必須積極分配**

---

# 背景資訊

今天：${now.toLocaleDateString("zh-TW")} (星期${["日", "一", "二", "三", "四", "五", "六"][now.getDay()]})

${contextSummary}

---

# 用戶輸入

${userInput}

---

# 輸出格式

**格式要求：**
- 使用繁體中文
- tag.topic：字串，**必須盡量填寫**`;

  const startTime = Date.now();

  const { object: result, usage } = await generateObject({
    model: google("gemini-2.5-flash-lite"),
    schema: CreateNewTasksActionSchema,
    prompt,
  });

  const duration = Date.now() - startTime;

  return { result, usage, duration, productCount };
}

async function main() {
  console.log("🧪 Brain Dump 效能測試（動態預算分配）\n");
  console.log("MAX_CONTEXT_ITEMS = 100 (tasks + sub_items 上限)");
  console.log("─".repeat(60));

  // 測試不同 Product 數量下的 token 使用量
  const testCases = [
    { input: "修復登入頁面的 Bug", productCount: 5 },   // 5×5×2 = 75 items
    { input: "跟客戶確認下週會議時間", productCount: 10 }, // 10×5×1 = 100 items
    { input: "1. 回覆郵件 2. 檢查日誌 3. 更新進度", productCount: 20 }, // 20×5×0 = 100 items
    { input: "整理本月財務報表", productCount: 30 },    // 30×3×0 = 90 items
    { input: "準備年度報告", productCount: 50 },       // 50×2×0 = 100 items
  ];

  let totalTokens = 0;
  let totalDuration = 0;

  for (const { input, productCount } of testCases) {
    console.log(`\n📝 輸入: "${input}"`);

    try {
      const { result, usage, duration } = await runTest(input, productCount);

      console.log(`⏱️  執行時間: ${duration}ms`);

      if (usage) {
        console.log(`🔢 Token 使用量:`);
        console.log(`   Prompt tokens: ${usage.promptTokens}`);
        console.log(`   Completion tokens: ${usage.completionTokens}`);
        console.log(`   Total tokens: ${usage.totalTokens}`);
        totalTokens += usage.totalTokens;
      }

      console.log(`📋 結果: ${result.items.length} 個任務`);
      for (const item of result.items) {
        const topicStatus = item.tag.topic ? "✅" : "❌";
        console.log(`   ${topicStatus} ${item.title} → ${item.tag.area}/${item.tag.product}/${item.tag.topic || "(空)"}`);
      }

      totalDuration += duration;
    } catch (error) {
      console.error(`❌ 錯誤:`, error);
    }

    console.log("─".repeat(60));
  }

  console.log(`\n📊 總結:`);
  console.log(`   總執行時間: ${totalDuration}ms`);
  console.log(`   平均執行時間: ${Math.round(totalDuration / testCases.length)}ms`);
  console.log(`   總 Token 使用: ${totalTokens}`);
  console.log(`   平均 Token/請求: ${Math.round(totalTokens / testCases.length)}`);

  console.log(`\n💡 動態預算策略:`);
  console.log(`   - 最多 100 個項目 (tasks + sub_items)`);
  console.log(`   - 優先級: Product > Task > SubItem`);
  console.log(`   - 5 Products:  5×5 tasks×2 sub_items = ~75 items`);
  console.log(`   - 10 Products: 10×5 tasks×1 sub_item = ~100 items`);
  console.log(`   - 30 Products: 30×3 tasks×0 sub_items = ~90 items`);
  console.log(`   - 50 Products: 50×2 tasks×0 sub_items = ~100 items`);
}

main().catch(console.error);
