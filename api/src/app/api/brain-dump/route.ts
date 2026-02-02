/**
 * Brain Dump API Route
 *
 * TODO [技術債]: 此文件包含大量業務邏輯 (439 行),應重構至 Use Case
 * 目前為快速統一 API 格式,保留業務邏輯在此處
 * 未來應創建 BrainDumpUseCase 並遵循 Clean Architecture
 */

import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth-middleware";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isValidUUID } from "@/domain/constants/validation";
import { ApiResponseBuilder, catchDomainException, ValidationException } from "@/lib/api-response";

// Sub-item 結構
const SubItemSchema = z.object({
  content: z.string().max(100).describe("Sub-item 內容（最多 100 字元）"),
});

// 來源歸因結構 (Source Attribution)
const SourceAttributionSchema = z.object({
  source_type: z.enum(["explicit", "inferred_from_context", "inferred_from_system"])
    .describe("explicit=用戶明說, inferred_from_context=從輸入推斷, inferred_from_system=從系統資料推斷"),
  confidence: z.number().min(0).max(1).describe("信心度 0-1"),
  reasoning: z.string().max(80).describe("簡要說明推斷理由（最多 80 字元）"),
});

// AI 輸出結構
const StructuredItemSchema = z.object({
  title: z.string().max(50).describe("簡潔的任務標題（最多 50 字元）"),
  narrative: z.string().max(100).describe("任務的簡要背景描述（最多 100 字元）"),
  drawer: z.enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"])
    .describe("Status drawer based on urgency"),
  lifecycle: z.enum(["FINITE", "PERPETUAL"])
    .describe("finite = project with deadline, perpetual = ongoing maintenance"),
  tag: z.object({
    area: z.string().max(30).describe("領域名稱（最多 30 字元）"),
    product: z.string().max(50).describe("專案名稱（最多 50 字元）"),
    topic: z.string().max(50).describe("主題名稱（最多 50 字元）"),
  }),
  strategy_used: z.string().max(50).describe("Classification strategy: boundary_match, semantic_anchor, new_structure"),
  reasoning: z.string().max(100).describe("簡短說明分類理由（1 句話，最多 100 字元）"),
  // 時間推斷欄位 - 加入來源歸因
  due_date: z.string().datetime({ offset: true }).optional().describe("Inferred due date in ISO 8601 format (允許時區偏移)"),
  due_date_source: SourceAttributionSchema.optional().describe("時間來源歸因 - 區分 explicit/inferred"),
  inferred_from_milestone: z.string().optional().describe("Milestone ID if inferred from a milestone (僅當 source_type=inferred_from_system)"),
  time_confidence: z.number().min(0).max(1).optional().describe("Confidence score for time inference (0-1)"),
  // Sub-items (待辦事項清單)
  sub_items: z.array(SubItemSchema).optional().describe("如果任務包含多個可獨立勾選的步驟/項目，拆成 sub-items - 不可遺漏用戶提到的任何事項"),
});

// 追加 sub-item 的 action
const AppendSubItemActionSchema = z.object({
  action: z.literal("append_sub_item"),
  target_task_id: z.string().describe("要追加到的任務 ID"),
  sub_items: z.array(SubItemSchema).describe("要追加的待辦事項清單"),
  reasoning: z.string().max(100).describe("簡要說明為什麼判斷這是追加而非新任務（1 句話，最多 100 字元）"),
});

// 創建新任務的 action
const CreateNewTasksActionSchema = z.object({
  action: z.literal("create_new_tasks"),
  items: z.array(StructuredItemSchema),
});

// 最終的結果 schema（二選一）
const StructureResultSchema = z.discriminatedUnion("action", [
  AppendSubItemActionSchema,
  CreateNewTasksActionSchema,
]);

// POST /api/brain-dump
export async function POST(request: NextRequest) {
  return catchDomainException<any>(async () => {
    const timings: Record<string, number> = {};
    const startTotal = Date.now();

    const userId = await authenticateRequest(request, prisma);
    const body = await request.json() as any;
    const { text } = body;

    if (!text) {
      throw new ValidationException("text is required", "text");
    }

    // ✅ 獲取用戶現有結構作為上下文（包含每個 Product 的最近任務，用於語意關聯）
    // 使用單一 query 避免 N+1 問題
    const startDbStructure = Date.now();
    const existingAreas = await prisma.area.findMany({
      where: { user_id: userId, deleted_at: null },
      include: {
        products: {
          where: { deleted_at: null },
          include: {
            topics: {
              where: { deleted_at: null },
              select: { id: true, name: true }  // 只選擇必要欄位
            },
            tasks: {
              where: {
                deleted_at: null,
                status: { not: 'ARCHIVE' }, // 只載入未完成的任務
              },
              select: { id: true, content: true, created_at: true, sub_items: true },
              orderBy: { created_at: 'desc' },
              take: 10, // 每個 Product 最多取 10 個最近任務，提供語意線索
            },
          },
        },
      },
    });
    timings["db_structure"] = Date.now() - startDbStructure;

    // ✅ 獲取最近 10 分鐘內創建的任務（用於判斷是否追加 sub-item）
    const startDbRecentTasks = Date.now();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentTasks = await prisma.task.findMany({
      where: {
        deleted_at: null,
        created_at: { gte: tenMinutesAgo },
        product: { user_id: userId },
      },
      include: {
        product: {
          select: { id: true, name: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });
    timings["db_recent_tasks"] = Date.now() - startDbRecentTasks;

    // 載入用戶的 Milestones（未來 90 天內）
    const startDbMilestones = Date.now();
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);

    let milestones: any[] = [];
    try {
      milestones = await prisma.milestone.findMany({
        where: {
          user_id: userId,
          deleted_at: null,
          target_date: {
            gte: now,
            lte: futureDate,
          },
          status: {
            in: ["planned", "in_progress"],
          },
        },
        orderBy: { target_date: "asc" },
      });
    } catch (milestoneError) {
      console.warn("Failed to load milestones, continuing without them:", milestoneError);
    }
    timings["db_milestones"] = Date.now() - startDbMilestones;

    // 構建完整的上下文摘要（包含任務內容，用於語意匹配）
    let contextSummary = "";
    if (existingAreas.length > 0) {
      contextSummary = "\n### 用戶現有結構（請根據任務內容判斷語意匹配）:\n";
      for (const area of existingAreas) {
        contextSummary += `\n**Area: ${area.name}** (範圍: ${area.scope || "未定義"})\n`;
        for (const product of area.products) {
          contextSummary += `  📦 Product: ${product.name}\n`;

          // 顯示 Topics
          if (product.topics.length > 0) {
            contextSummary += `     Topics: ${product.topics.map(t => t.name).join(", ")}\n`;
          }

          // 顯示最近任務（提供語意線索）
          if (product.tasks && product.tasks.length > 0) {
            contextSummary += `     最近任務:\n`;
            for (const task of product.tasks) {
              contextSummary += `       - [${task.id}] ${task.content}\n`;
              // 顯示 sub-items
              if (task.sub_items) {
                const subItems = task.sub_items as Array<{
                  id: string;
                  content: string;
                  completed: boolean;
                }>;
                if (subItems.length > 0) {
                  for (const subItem of subItems) {
                    const checkbox = subItem.completed ? '✅' : '☐';
                    contextSummary += `         ${checkbox} ${subItem.content}\n`;
                  }
                }
              }
            }
          } else {
            contextSummary += `     最近任務: (無，這是新專案)\n`;
          }
        }
      }
      contextSummary += "\n";
    }

    // 添加最近 10 分鐘內創建的任務（重點關注）
    if (recentTasks.length > 0) {
      contextSummary += "\n### 🔥 最近 10 分鐘內創建的任務（判斷是否為追加內容）:\n";
      for (const task of recentTasks) {
        const timeAgo = Math.floor((Date.now() - new Date(task.created_at).getTime()) / 60000);
        contextSummary += `\n**[${task.id}] ${task.content}**\n`;
        contextSummary += `   ⏰ ${timeAgo} 分鐘前創建 | 📦 ${task.product.name}\n`;

        // 顯示 sub-items
        if (task.sub_items) {
          const subItems = task.sub_items as Array<{
            id: string;
            content: string;
            completed: boolean;
          }>;
          if (subItems.length > 0) {
            contextSummary += `   已有的待辦項目:\n`;
            for (const subItem of subItems) {
              const checkbox = subItem.completed ? '✅' : '☐';
              contextSummary += `     ${checkbox} ${subItem.content}\n`;
            }
          } else {
            contextSummary += `   (尚無待辦項目)\n`;
          }
        }
      }
      contextSummary += "\n";
    }

    // 添加 Milestone 資訊到上下文
    if (milestones.length > 0) {
      contextSummary += "\n### 用戶設定的里程碑（未來 90 天）:\n";
      contextSummary += `今天日期：${now.toLocaleDateString("zh-TW")} (星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]})\n\n`;

      for (const milestone of milestones) {
        const targetDate = new Date(milestone.target_date);
        const daysUntil = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        contextSummary += `🎯 **${milestone.name}**\n`;
        contextSummary += `   - 目標日期：${targetDate.toLocaleDateString("zh-TW")} (${daysUntil} 天後)\n`;
        contextSummary += `   - 層級：${milestone.entity_type}\n`;
        contextSummary += `   - 優先級：${milestone.priority}/10\n`;
        if (milestone.description) {
          contextSummary += `   - 描述：${milestone.description}\n`;
        }
        contextSummary += "\n";
      }
    }

    // 調用 AI 進行結構化
    const startAI = Date.now();
    const { object: result } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: StructureResultSchema,
      prompt: `你是任務記錄專家。將用戶輸入轉成結構化的 Task。

# 🔥 最優先判斷：是追加還是新任務？

## 判斷邏輯（純語意判斷，不看時間）

### 看「最近創建的任務」（不論時間）
問自己：**「用戶的新輸入是在補充某個既有任務的待辦步驟嗎？」**

✅ **符合追加條件**（必須同時滿足）：
- 新輸入是「簡短的執行步驟」或「待辦事項」（不是完整任務描述）
- 語意上明確是某個既有任務的「子項目」或「執行細節」
- 輸入格式像「待辦清單項目」而非「新任務說明」

**判斷技巧**：
- 如果輸入像「整理資料」「發送郵件」→ 可能是追加
- 如果輸入像「明天要準備週報」→ 是新任務（有完整目標描述）
- 如果輸入像「準備週報要：整理資料、發送郵件」→ 是新任務（含多個 sub_items）

❌ **不符合追加**（創建新任務）：
- 新輸入有完整的任務描述（標題 + 目標）
- 語意上是獨立的新事情
- 用戶明確提到新的 Product/Area/時間

**如果符合追加條件**：
→ 回傳 \`action: "append_sub_item"\`，指定 \`target_task_id\` 和新的 \`sub_items\`

**如果是新任務**：
→ 繼續往下，按照原有規則創建新任務

---

# 核心原則（創建新任務時使用）

## 1. 完整記錄
問自己：**「把輸出念給用戶聽，用戶會說『你漏了 X』嗎？」**
- 會 → 你漏了東西，補上
- 不會 → OK

所有細節都要保留：
- 用戶提到的每個事項 → 放入 sub_items 或 narrative
- 用戶提到的條件/前提 → 放入 narrative
- 用戶提到的人名/專案名 → 保留原文

## 2. Sub-items 拆分
問自己：**「用戶說的這些事，可以分別勾掉嗎？」**
- 可以分別勾掉 → 拆成 sub_items
- 不能分別勾掉 → 放在 narrative

## 3. Product 選擇
問自己：**「這個新任務和哪個 Product 的現有任務最像？」**
- 看每個 Product 下的「最近任務」
- 選擇任務類型最相似的 Product
- 只有完全無關時才創建新 Product

Topic：優先使用該 Product 已有的 Topics，無法確定則填 ""

## 4. 時間推斷
問自己：**「用戶有明確說時間嗎？」**

| 優先級 | 情況 | source_type | confidence |
|--------|------|-------------|------------|
| 最高 | 用戶說「今天」「明天」「週五」「1/30」 | explicit | 1.0 |
| 次高 | 用戶說「盡快」「有空時」 | inferred_from_context | 0.7-0.9 |
| 最低 | 從 Milestone 推斷 | inferred_from_system | 0.3-0.7 |

用戶明確說的時間，絕對優先於系統推斷。

## 5. Drawer 狀態
- INBOX: 未處理，需要關注
- ACTIVE: 正在進行中
- MAINTAIN: 穩定維護中
- REFERENCE: 參考資料
- ARCHIVE: 已完成

---

# 背景資訊

今天：${now.toLocaleDateString("zh-TW")} (星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]})

${contextSummary}

---

# 用戶輸入

${text}

---

# 輸出格式與長度限制（嚴格遵守）

**字元數限制：**
- title：≤ 50 字元（動詞 + 目標，去掉冗詞）
- narrative：≤ 100 字元（任務背景描述，精簡重點）
- reasoning：≤ 100 字元（1 句話說明分類依據）
- due_date_source.reasoning：≤ 80 字元（1 句話說明時間推斷，使用 due_date_source 結構）
- sub_item.content：≤ 100 字元（簡短的待辦事項）
- tag.area/product/topic：≤ 30/50/50 字元

**格式要求：**
- 使用繁體中文
- due_date：ISO 8601 格式（例：2026-01-30T00:00:00+08:00）
- tag.topic：字串，無法確定則填 ""

**寫作原則：**
- 精簡優先：每個字都要有意義
- reasoning 範例：「提到專案名稱，判斷為工作相關」
- narrative 範例：「整理本週功能，準備週報給主管」（≤ 100 字）
- 如果用戶提供了大量細節，提煉最重要的資訊`,
    });
    timings["ai_generateObject"] = Date.now() - startAI;

    // ============================================================================
    // 根據 AI 判斷的 action 執行不同邏輯
    // ============================================================================

    const startDbPersist = Date.now();

    // 情況 1: 追加 sub-item 到既有任務
    if (result.action === "append_sub_item") {
      // 驗證 target_task_id
      const targetTask = await prisma.task.findFirst({
        where: {
          id: result.target_task_id,
          deleted_at: null,
          product: { user_id: userId },
        },
        include: {
          product: true,
        },
      });

      if (!targetTask) {
        throw new ValidationException(
          `Target task ${result.target_task_id} not found`,
          "target_task_id"
        );
      }

      // 獲取現有的 sub-items
      const existingSubItems = (targetTask.sub_items as Array<{
        id: string;
        content: string;
        completed: boolean;
        created_at: string;
        completed_at: string | null;
        order: number;
      }>) || [];

      // 創建新的 sub-items
      const now = new Date().toISOString();
      const newSubItems = result.sub_items.map((sub, idx) => ({
        id: crypto.randomUUID(),
        content: sub.content,
        completed: false,
        created_at: now,
        completed_at: null,
        order: existingSubItems.length + idx,
      }));

      // 更新任務
      const updatedSubItems = [...existingSubItems, ...newSubItems];
      await prisma.task.update({
        where: { id: result.target_task_id },
        data: {
          sub_items: updatedSubItems as any,
          updated_at: new Date(),
        },
      });

      // 記錄評估 Log
      await prisma.systemEvaluationLog.create({
        data: {
          user_id: userId,
          type: "BRAIN_DUMP",
          input_content: { text },
          output_content: {
            action: "append_sub_item",
            target_task_id: result.target_task_id,
            sub_items: result.sub_items,
            reasoning: result.reasoning,
          },
          user_action: "APPLIED",
          metadata: {
            appended_sub_items_count: newSubItems.length,
          },
        },
      });

      timings["db_persist"] = Date.now() - startDbPersist;
      timings["total"] = Date.now() - startTotal;
      console.log("⏱️ [brain-dump] Timings:", JSON.stringify(timings, null, 2));

      return ApiResponseBuilder.success({
        action: "append_sub_item",
        target_task: {
          id: targetTask.id,
          content: targetTask.content,
          product: targetTask.product.name,
        },
        appended_sub_items: newSubItems,
        reasoning: result.reasoning,
      }, {});
    }

    // 情況 2: 創建新任務（原有邏輯）
    // 建立快取 Map，避免重複查詢同樣的 Area/Product/Topic
    const areaCache = new Map<string, { id: string }>();
    const productCache = new Map<string, { id: string }>();
    const topicCache = new Map<string, { id: string }>();

    // 預先填充快取（使用已載入的 existingAreas）
    for (const area of existingAreas) {
      areaCache.set(area.name, { id: area.id });
      for (const product of area.products) {
        productCache.set(`${area.name}::${product.name}`, { id: product.id });
        for (const topic of product.topics) {
          topicCache.set(`${product.id}::${topic.name}`, { id: topic.id });
        }
      }
    }

    const createdTasks = [];
    for (const item of result.items) {
      // 1. 確保 Area 存在（優先使用快取，避免重複查詢）
      let areaId: string;
      const cachedArea = areaCache.get(item.tag.area);
      if (cachedArea) {
        areaId = cachedArea.id;
      } else {
        const area = await prisma.area.create({
          data: {
            user_id: userId,
            name: item.tag.area,
            is_custom: true,
          },
        });
        areaId = area.id;
        areaCache.set(area.name, { id: area.id });
      }

      // 2. 確保 Product 存在（優先使用快取，避免重複查詢）
      let productId: string;
      const productKey = `${item.tag.area}::${item.tag.product}`;
      const cachedProduct = productCache.get(productKey);
      if (cachedProduct) {
        productId = cachedProduct.id;
      } else {
        const product = await prisma.product.create({
          data: {
            user_id: userId,
            area_id: areaId,
            name: item.tag.product,
            status: item.drawer as any,
            lifecycle: item.lifecycle as any,
          },
        });
        productId = product.id;
        productCache.set(productKey, { id: product.id });
      }

      // 3. 確保 Topic 存在（優先使用快取，只在有名稱時創建）
      let topicId: string | null = null;
      if (item.tag.topic && item.tag.topic.trim() !== "") {
        const topicKey = `${productId}::${item.tag.topic}`;
        const cachedTopic = topicCache.get(topicKey);
        if (cachedTopic) {
          topicId = cachedTopic.id;
        } else {
          const topic = await prisma.topic.create({
            data: {
              user_id: userId,
              product_id: productId,
              name: item.tag.topic,
            },
          });
          topicId = topic.id;
          topicCache.set(topicKey, { id: topic.id });
        }
      }

      // 4. 創建 Task
      const aiAnalysis: any = {
        raw_input: text, // 保留原始輸入用於審計
        narrative: item.narrative,
        lifecycle: item.lifecycle,
        strategy_used: item.strategy_used,
        reasoning: item.reasoning,
      };

      // 時間推斷相關欄位（含來源歸因）
      if (item.due_date_source) {
        aiAnalysis.due_date_source = item.due_date_source;
      }

      // 處理 sub_items (待辦事項清單) - 準備寫入 task.sub_items
      let taskSubItems: Array<{
        id: string;
        content: string;
        completed: boolean;
        created_at: string;
        completed_at: string | null;
        order: number;
      }> = [];
      if (item.sub_items && item.sub_items.length > 0) {
        const now = new Date().toISOString();
        taskSubItems = item.sub_items.map((sub, idx) => ({
          id: crypto.randomUUID(),
          content: sub.content,
          completed: false,
          created_at: now,
          completed_at: null,
          order: idx,
        }));
      }

      // 驗證 inferred_from_milestone 是否為有效 UUID
      const validMilestoneId = item.inferred_from_milestone && isValidUUID(item.inferred_from_milestone)
        ? item.inferred_from_milestone
        : null;

      const task = await prisma.task.create({
        data: {
          user_id: userId,
          product_id: productId,
          topic_id: topicId,
          content: item.title,
          status: item.drawer as any,
          due_date: item.due_date ? new Date(item.due_date) : null,
          inferred_from_milestone: validMilestoneId,
          time_confidence: item.time_confidence !== undefined ? item.time_confidence : null,
          sub_items: taskSubItems as any, // Json 類型需要 type assertion
          ai_analysis: aiAnalysis,
        },
      });

      createdTasks.push({
        id: task.id,
        title: item.title,
        narrative: item.narrative,
        drawer: item.drawer,
        lifecycle: item.lifecycle,
        tag: item.tag,
        strategy_used: item.strategy_used,
        reasoning: item.reasoning,
        // 時間推斷資訊
        due_date: item.due_date || null,
        time_confidence: item.time_confidence || null,
        due_date_source: item.due_date_source || null,
        inferred_from_milestone: item.inferred_from_milestone || null,
      });
    }

    // 記錄評估 Log
    await prisma.systemEvaluationLog.create({
      data: {
        user_id: userId,
        type: "BRAIN_DUMP",
        input_content: { text },
        output_content: { action: "create_new_tasks", items: result.items },
        user_action: "APPLIED",
        metadata: {
          created_tasks_count: createdTasks.length,
        },
      },
    });
    timings["db_persist"] = Date.now() - startDbPersist;
    timings["total"] = Date.now() - startTotal;
    console.log("⏱️ [brain-dump] Timings:", JSON.stringify(timings, null, 2));

    return ApiResponseBuilder.success({
      action: "create_new_tasks",
      items: createdTasks,
    }, {});
  });
}
