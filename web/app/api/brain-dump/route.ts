import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-middleware";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";

// Sub-item 結構
const SubItemSchema = z.object({
  content: z.string().describe("Sub-item 內容"),
});

// 來源歸因結構 (Source Attribution)
const SourceAttributionSchema = z.object({
  source_type: z.enum(["explicit", "inferred_from_context", "inferred_from_system"])
    .describe("explicit=用戶明說, inferred_from_context=從輸入推斷, inferred_from_system=從系統資料推斷"),
  confidence: z.number().min(0).max(1).describe("信心度 0-1"),
  reasoning: z.string().describe("推斷理由"),
});

// AI 輸出結構
const StructuredItemSchema = z.object({
  title: z.string().describe("A concise, actionable title (max 50 chars)"),
  narrative: z.string().describe("Contextual narrative explaining the item - 必須保留用戶提到的所有細節"),
  drawer: z.enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"])
    .describe("Status drawer based on urgency"),
  lifecycle: z.enum(["FINITE", "PERPETUAL"])
    .describe("finite = project with deadline, perpetual = ongoing maintenance"),
  tag: z.object({
    area: z.string().describe("L1: Identity/workspace context"),
    product: z.string().describe("L2: Long-term asset being built"),
    topic: z.string().describe("L3: Thematic module within the product"),
  }),
  strategy_used: z.string().describe("Classification strategy: boundary_match, semantic_anchor, new_structure"),
  reasoning: z.string().describe("Brief reasoning for the classification"),
  // 時間推斷欄位 - 加入來源歸因
  due_date: z.string().datetime({ offset: true }).optional().describe("Inferred due date in ISO 8601 format (允許時區偏移)"),
  due_date_source: SourceAttributionSchema.optional().describe("時間來源歸因 - 區分 explicit/inferred"),
  inferred_from_milestone: z.string().optional().describe("Milestone ID if inferred from a milestone (僅當 source_type=inferred_from_system)"),
  time_confidence: z.number().min(0).max(1).optional().describe("Confidence score for time inference (0-1)"),
  time_reasoning: z.string().optional().describe("Reasoning for the time inference (in Traditional Chinese)"),
  // Sub-items (待辦事項清單)
  sub_items: z.array(SubItemSchema).optional().describe("如果任務包含多個可獨立勾選的步驟/項目，拆成 sub-items - 不可遺漏用戶提到的任何事項"),
});

const StructureResultSchema = z.object({
  items: z.array(StructuredItemSchema),
});

// POST /api/brain-dump
export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // ✅ 獲取用戶現有結構作為上下文（包含每個 Product 的最近任務，用於語意關聯）
    // 使用單一 query 避免 N+1 問題
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
              select: { id: true, content: true, created_at: true },
              orderBy: { created_at: 'desc' },
              take: 10, // 每個 Product 最多取 10 個最近任務，提供語意線索
            },
          },
        },
      },
    });

    // 載入用戶的 Milestones（未來 90 天內）
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
              contextSummary += `       - ${task.content}\n`;
            }
          } else {
            contextSummary += `     最近任務: (無，這是新專案)\n`;
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
    const { object: result } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: StructureResultSchema,
      prompt: `你是 Zentropy 的圖書管理員 AI，負責將用戶的輸入「歸檔」成結構化的 Task 卡片。

## ⚠️ 最重要原則：資訊保真度 (Information Fidelity)

**你的核心職責是「完整記錄」，不是「簡化」或「執行」。**

### 絕對禁止的行為：
1. ❌ **刪減用戶提到的事項** - 用戶說 A,B,C,D,E，你必須全部記錄，不可只留 A,B,C
2. ❌ **用系統推斷覆蓋用戶明示** - 用戶說「今天」，絕不可因為 milestone 改成「三天後」
3. ❌ **過度摘要** - 「跟小明談 A,B,C」不可變成「與小明討論」
4. ❌ **忽略條件/前提** - 「等報價後再決定」不可變成「決定 X」

### 正確做法：
- 用戶提到的每個事項都要保留（可用 sub_items 展開）
- 用戶明確說的時間詞彙優先於系統推斷
- narrative 要保留用戶提到的所有細節和上下文

## Sub-items 拆分規則（非常重要）:

當用戶輸入包含**多個可獨立完成的步驟或項目**時，應拆成 sub_items。**這是保證資訊不丟失的關鍵機制。**

**觸發條件（滿足任一即可）**：
- 有列舉標記：1) 2) 3)、一二三、• - [ ] 等
- 有並列結構：「A、B、C」「A 和 B 和 C」「A 跟 B 跟 C」
- 有動詞序列：「要做 A、做 B、做 C」
- 有順序暗示：「先...然後...最後...」「首先...接著...」
- 語意上是「多件可分別勾掉的事」

**範例**：
- 「準備報告要蒐集數據分析結果寫摘要」→ title=「準備報告」, sub_items=[蒐集數據, 分析結果, 寫摘要]
- 「今天要開會寫文件回郵件」→ title=「今日待辦」, sub_items=[開會, 寫文件, 回郵件]
- 「跟小明談 A 專案進度，他說 delay 因為 B 問題，另外 C 也卡住，D 要先確認，E 下週再說」→ title=「A 專案進度討論」, sub_items=[B 問題導致 delay, C 卡住, D 需先確認, E 下週處理], narrative 保留完整對話脈絡

**不拆分的情況**：
- 只有單一事項：「明天開會」→ 不拆
- 內容是描述而非任務：「這個功能的優點是快速和穩定」→ 不拆

## Product 選擇原則（核心）

你會看到用戶現有的結構：Area > Product > 最近任務列表。

**選擇方法**：
1. 看每個 Product 下的「最近任務」列表
2. 根據這些任務的內容，理解這個 Product 是在處理什麼類型的事務
3. 判斷新輸入與哪個 Product 的任務屬於同類型的事務
4. 選擇最匹配的 Product

**優先使用現有結構**：只有當所有現有 Product 都與新輸入的事務類型無關時，才創建新的 Product 或 Area。

**Topic**：優先使用該 Product 已有的 Topics，若無法確定則填空字串 ""

**Drawer 狀態**：
- INBOX: 未處理，需要關注
- ACTIVE: 正在進行中
- MAINTAIN: 穩定維護中
- REFERENCE: 參考資料
- ARCHIVE: 已完成或棄用

${contextSummary}

## 用戶輸入（請將此內容歸檔為 Task）:
${text}

## ⏰ 時間推斷指示（Explicit > Inferred 原則）

今天日期是 **${now.toLocaleDateString("zh-TW")} (星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]})**。

### 【最高優先級】用戶明確指定的時間 (source_type = "explicit")

如果用戶輸入包含以下時間詞彙，**必須使用該時間，不可被其他推斷覆蓋**：
- 「今天」「今日」→ 今天的日期
- 「明天」「明日」→ 明天的日期
- 「後天」→ 後天的日期
- 「週X」「禮拜X」「星期X」→ 本週的星期X（如果該日期已過則指下週）
- 「下週X」「下禮拜X」→ 下週的星期X
- 「X號」「X日」「X/X」→ 指定日期
- 「月底」「月底前」→ 當月最後一天
- 「這週」「本週」→ 本週五

設定：
- due_date_source.source_type = "explicit"
- due_date_source.confidence = 1.0
- due_date_source.reasoning = "用戶明確指定「XXX」"

### 【次要優先級】從輸入上下文推斷 (source_type = "inferred_from_context")

如果用戶提到相對時間暗示但沒有明確日期：
- 「等開完會後」「收到報價後」「A 完成後」
- 「盡快」「儘早」→ 3 天內
- 「有空時」「之後」→ 7 天內

設定：
- due_date_source.source_type = "inferred_from_context"
- due_date_source.confidence = 0.7-0.9
- due_date_source.reasoning = 說明推斷邏輯

### 【最低優先級】從系統 Milestone 推斷 (source_type = "inferred_from_system")

**只有在用戶沒有提到任何時間詞彙時**，才從 Milestone 推斷：
- 設定 due_date 為 Milestone target_date 前 3-7 天
- 設定 inferred_from_milestone 為該 Milestone 的 ID
- due_date_source.source_type = "inferred_from_system"
- due_date_source.confidence = 0.3-0.7
- due_date_source.reasoning = "從 Milestone「XXX」推斷"

### 無關聯情況
如果沒有任何時間線索，也沒有相關 Milestone：
- ACTIVE drawer → 7 天內
- INBOX drawer → 14 天內
- MAINTAIN drawer → 30 天內
- REFERENCE drawer → 不設定 due_date
- due_date_source.source_type = "inferred_from_system"
- due_date_source.confidence = 0.2-0.4

## 歸檔步驟：

1. **理解用戶意圖**：用戶這次想做什麼事？
2. **分析現有 Product**：看每個 Product 的「最近任務」列表，這個 Product 是在處理什麼類型的事務？
3. **選擇匹配的 Product**：選擇與用戶意圖屬於同類型事務的 Product
4. **處理時間**：用戶明確說的時間優先，其次從上下文推斷，最後從 Milestone 推斷
5. **完整記錄**：確保 narrative 和 sub_items 保留用戶提到的所有內容

**輸出格式**：
- tag.topic：字串，無法確定則填 ""
- due_date：ISO 8601 格式（例如：2026-01-30T00:00:00+08:00）
- due_date_source：標記時間來源 explicit/inferred_from_context/inferred_from_system
- time_reasoning：繁體中文說明時間推斷理由
- reasoning：繁體中文說明選擇這個 Product 的理由（看了哪些 Product 的任務，為何選擇這個）
- sub_items：多個事項時全部拆分，完整記錄`,
    });

    // 持久化到資料庫（優化：使用記憶體快取減少重複查詢）

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
      if (item.time_reasoning) {
        aiAnalysis.time_reasoning = item.time_reasoning;
      }
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
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validMilestoneId = item.inferred_from_milestone && uuidRegex.test(item.inferred_from_milestone)
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
        time_reasoning: item.time_reasoning || null,
        inferred_from_milestone: item.inferred_from_milestone || null,
      });
    }

    // 記錄評估 Log
    await prisma.systemEvaluationLog.create({
      data: {
        user_id: userId,
        type: "BRAIN_DUMP",
        input_content: { text },
        output_content: { items: result.items },
        user_action: "APPLIED",
        metadata: {
          created_tasks_count: createdTasks.length,
        },
      },
    });

    return NextResponse.json({
      success: true,
      items: createdTasks,
    });
  } catch (error) {
    console.error("Brain dump failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error details:", errorMessage);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");

    // Check for authentication errors
    if (
      errorMessage.includes("token") ||
      errorMessage.includes("User not found")
    ) {
      return NextResponse.json({
        error: "Unauthorized",
        details: "Authentication failed. Please provide a valid Firebase ID token.",
      }, { status: 401 });
    }

    return NextResponse.json({
      error: "Brain dump processing failed",
      details: errorMessage
    }, { status: 500 });
  }
}
