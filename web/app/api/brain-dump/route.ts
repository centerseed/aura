import { NextResponse } from "next/server";
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
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, userId } = body;

    if (!text || !userId) {
      return NextResponse.json({ error: "text and userId are required" }, { status: 400 });
    }

    // 獲取用戶現有結構作為上下文（包含所有任務）
    const existingAreas = await prisma.area.findMany({
      where: { user_id: userId, deleted_at: null },
      include: {
        products: {
          where: { deleted_at: null },
          include: {
            topics: { where: { deleted_at: null } },
            tasks: {
              where: { deleted_at: null },
              orderBy: { created_at: "desc" },
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

    // 構建完整的上下文摘要（與 reorganize API 一致）
    let contextSummary = "";
    if (existingAreas.length > 0) {
      contextSummary = "\n### 用戶現有結構（請優先使用這些分類）:\n";
      for (const area of existingAreas) {
        contextSummary += `\n**Area: ${area.name}** (範圍: ${area.scope || "未定義"})\n`;
        for (const product of area.products) {
          contextSummary += `  📦 Product: ${product.name}\n`;
          // 顯示 Topics
          if (product.topics.length > 0) {
            contextSummary += `     Topics: ${product.topics.map(t => t.name).join(", ")}\n`;
          }
          // 顯示現有任務（讓 AI 了解這個 Product 包含什麼類型的內容）
          if (product.tasks.length > 0) {
            contextSummary += `     現有任務:\n`;
            for (const task of product.tasks) {
              const aiAnalysis = task.ai_analysis as { narrative?: string } || {};
              contextSummary += `       - ${task.content}${aiAnalysis.narrative ? ` (${aiAnalysis.narrative})` : ""}\n`;
            }
          }
        }
      }
      contextSummary += "\n";
    }

    // 添加 Milestone 資訊到上下文
    if (milestones.length > 0) {
      contextSummary += "\n### 用戶設定的里程碑（未來 90 天）:\n";
      contextSummary += `今天日期：${now.toLocaleDateString("zh-TW")}\n\n`;

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

## 歸檔原則:

1. **語意引力**：根據「用戶現有結構」中的任務內容，判斷新輸入應該歸屬哪個 Product。
   - 如果新輸入與某個現有 Product 下的任務語意相似，就歸入那個 Product

2. **邊界遵守**：嚴格使用用戶已定義的 Area。除非用戶明確提到新身分，否則不要創建新 Area。

3. **避免重複**：如果已存在語意相似的 Product，選擇最匹配的那個，不要創建新的。

4. **Topic 填寫規則**：
   - Topic 是 Product 下的細分類別（例如：Design、Development、Meeting）
   - 如果用戶現有結構中該 Product 已有 Topics，優先使用現有的
   - 如果無法確定 Topic，請填寫空字串 ""

5. **Drawer 狀態**:
   - INBOX: 未處理，需要關注
   - ACTIVE: 正在進行中
   - MAINTAIN: 穩定維護中
   - REFERENCE: 參考資料
   - ARCHIVE: 已完成或棄用

${contextSummary}

## 用戶輸入（請將此內容歸檔為 Task）:
${text}

## ⏰ 時間推斷指示（Explicit > Inferred 原則）

今天日期是 **${now.toLocaleDateString("zh-TW")}**。

### 【最高優先級】用戶明確指定的時間 (source_type = "explicit")

如果用戶輸入包含以下時間詞彙，**必須使用該時間，不可被其他推斷覆蓋**：
- 「今天」「今日」→ 今天的日期
- 「明天」「明日」→ 明天的日期
- 「後天」→ 後天的日期
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

1. **完整理解輸入**：識別用戶提到的所有事項、時間詞彙、條件
2. **保真度檢查**：確保沒有遺漏任何用戶提到的內容
3. **時間優先級判定**：先檢查用戶是否明確說了時間，再考慮系統推斷
4. **尋找歸屬**：查看「用戶現有結構」中是否有語意匹配的 Product
5. **創建 Task**：確保 narrative 和 sub_items 完整記錄所有細節

**輸出格式要求**：
- tag.topic 欄位必須是字串，如果沒有適合的 Topic，填寫 "" （空字串）
- due_date 必須是 ISO 8601 格式（例如：2026-01-30T00:00:00+08:00）
- due_date_source 必須填寫，標記時間來源是 explicit/inferred_from_context/inferred_from_system
- time_reasoning 必須用繁體中文說明時間推斷的理由
- reasoning 欄位請用繁體中文說明為什麼選擇這個分類
- **sub_items**：如果輸入包含多個事項，務必全部拆分填入 sub_items 陣列，不可遺漏

**最終提醒**：你的職責是「完整歸檔」。用戶說了 5 件事，你就要記錄 5 件事。用戶說「今天」，就是今天，不管 milestone 是什麼時候。`,
    });

    // 持久化到資料庫
    const createdTasks = [];
    for (const item of result.items) {
      // 1. 確保 Area 存在
      let area = await prisma.area.findFirst({
        where: { user_id: userId, name: item.tag.area, deleted_at: null },
      });
      if (!area) {
        area = await prisma.area.create({
          data: {
            user_id: userId,
            name: item.tag.area,
            is_custom: true,
          },
        });
      }

      // 2. 確保 Product 存在
      let product = await prisma.product.findFirst({
        where: { user_id: userId, area_id: area.id, name: item.tag.product, deleted_at: null },
      });
      if (!product) {
        product = await prisma.product.create({
          data: {
            user_id: userId,
            area_id: area.id,
            name: item.tag.product,
            status: item.drawer as any,
            lifecycle: item.lifecycle as any,
          },
        });
      }

      // 3. 確保 Topic 存在（只在有名稱時創建）
      let topic = null;
      if (item.tag.topic && item.tag.topic.trim() !== "") {
        topic = await prisma.topic.findFirst({
          where: { user_id: userId, product_id: product.id, name: item.tag.topic, deleted_at: null },
        });
        if (!topic) {
          topic = await prisma.topic.create({
            data: {
              user_id: userId,
              product_id: product.id,
              name: item.tag.topic,
            },
          });
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

      // 處理 sub_items (待辦事項清單)
      if (item.sub_items && item.sub_items.length > 0) {
        const now = new Date().toISOString();
        aiAnalysis.sub_items = item.sub_items.map((sub, idx) => ({
          id: crypto.randomUUID(),
          content: sub.content,
          completed: false,
          created_at: now,
          completed_at: null,
          order: idx,
        }));
        aiAnalysis.sub_items_meta = {
          total: item.sub_items.length,
          completed: 0,
          completion_rate: 0,
        };
      }

      // 驗證 inferred_from_milestone 是否為有效 UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validMilestoneId = item.inferred_from_milestone && uuidRegex.test(item.inferred_from_milestone)
        ? item.inferred_from_milestone
        : null;

      const task = await prisma.task.create({
        data: {
          user_id: userId,
          product_id: product.id,
          topic_id: topic?.id ?? null,
          content: item.title,
          status: item.drawer as any,
          start_date: new Date(), // 開始時間預設為創建當下
          due_date: item.due_date ? new Date(item.due_date) : null,
          inferred_from_milestone: validMilestoneId,
          time_confidence: item.time_confidence !== undefined ? item.time_confidence : null,
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

    return NextResponse.json({
      success: true,
      items: createdTasks,
    });
  } catch (error) {
    console.error("Brain dump failed:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json({
      error: "Brain dump processing failed",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
