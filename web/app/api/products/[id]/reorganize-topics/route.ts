import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

// Zod Schema for AI structured output (精簡版 - 減少輸出量)
const ReorganizeProposalSchema = z.object({
  proposed_clusters: z.array(
    z.object({
      topic_name: z.string(),
      task_ids: z.array(z.string()),
    })
  ),

  time_inferences: z.array(
    z.object({
      task_id: z.string(),
      suggested_due_date: z.string().nullable(),
      urgency_level: z.enum(["critical", "high", "medium", "low"]),
    })
  ),

  task_consolidations: z.array(
    z.object({
      parent_task_id: z.string(),
      sub_task_ids: z.array(z.string()),
      consolidated_title: z.string().describe("必須能反推出所有子任務的存在，例如「發表會準備：簡報、演練、設備」"),
      consolidated_narrative: z.string().describe("包含每個子任務的「上下文」和「為什麼」，使用因果結構"),
      reasoning: z.string().describe("為什麼要整合這些任務（繁體中文，1-2 句話）"),
      semantic_preservation: z.array(
        z.object({
          original_task_id: z.string(),
          preserved_in: z.enum(["title", "narrative", "sub_item"]).describe("該任務的語意保留在哪裡"),
          key_intent: z.string().describe("該任務的核心意圖（5-15 字）"),
        })
      ).optional().describe("語意映射表：記錄每個子任務的語意落點"),
    })
  ).optional(),
});

// POST /api/products/[id]/reorganize-topics
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const timings: Record<string, number> = {};
    const startTotal = Date.now();

    const userId = await authenticateRequest(request, prisma);
    const { id: productId } = await params;

    // 1. 查詢 Product 資訊並驗證屬於當前用戶
    const startDb1 = Date.now();
    const product = await prisma.product.findUnique({
      where: { id: productId, user_id: userId, deleted_at: null },
      include: {
        area: true,
      },
    });

    timings["db_product"] = Date.now() - startDb1;

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 2. 查詢該 Product 下的所有 Tasks
    // ✅ 過濾已刪除和已完成的 task,節省 AI 處理成本
    const startDb2 = Date.now();
    const tasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        product_id: productId,
        deleted_at: null,
        status: {
          not: "ARCHIVE", // 已完成的任務不需要重組
        },
      },
      include: {
        topic: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    timings["db_tasks"] = Date.now() - startDb2;

    if (tasks.length === 0) {
      return NextResponse.json({
        product_id: productId,
        product_name: product.name,
        current_topics: [],
        proposed_clusters: [],
        time_inferences: [],
        reasoning: "該 Product 下沒有任何 Tasks,無需重組。",
      });
    }

    // 3. 查詢相關的 Milestones (entity_type = 'PRODUCT', entity_id = productId)
    // 注意: 資料庫中 entity_type 是 varchar,不是 enum
    const startDb3 = Date.now();
    const milestones = await prisma.milestone.findMany({
      where: {
        user_id: userId,
        entity_type: "PRODUCT",
        entity_id: productId,
        deleted_at: null,
      },
      orderBy: {
        target_date: "asc",
      },
    });
    timings["db_milestones"] = Date.now() - startDb3;

    // 4. 構建上下文資訊
    const currentTopics = [...new Set(tasks.map((t) => t.topic?.name).filter((name): name is string => Boolean(name)))];

    // 構建 Tasks 資訊 (給 AI)
    const tasksData = tasks.map((t) => {
      const aiAnalysis = t.ai_analysis as { narrative?: string } | null;
      const subItems = (t as any).sub_items as Array<{
        id: string;
        content: string;
        completed: boolean;
      }> | null;

      // 分離已完成和未完成的 sub_items
      const completedSubItems = subItems?.filter(s => s.completed) || [];
      const pendingSubItems = subItems?.filter(s => !s.completed) || [];

      return {
        id: t.id,
        content: t.content,
        narrative: aiAnalysis?.narrative || "",
        current_topic: t.topic?.name || "未分類",
        status: t.status,
        current_due_date: t.due_date?.toISOString() || null,
        // ✅ 新增：sub_items 資訊
        has_sub_items: (subItems?.length || 0) > 0,
        completed_sub_items: completedSubItems.map(s => s.content),
        pending_sub_items: pendingSubItems.map(s => ({ id: s.id, content: s.content })),
      };
    });

    // 構建 Milestones 資訊 (給 AI)
    const milestonesData = milestones.map((m) => ({
      id: m.id,
      name: m.name,
      target_date: m.target_date.toISOString(),
      status: m.status,
      priority: m.priority,
      description: m.description || "",
    }));

    const today = new Date().toISOString();

    // 5. 呼叫 AI Agent 進行分析
    const prompt = buildReorganizePrompt({
      product_name: product.name,
      area_name: product.area.name,
      current_topics: currentTopics,
      tasks: tasksData,
      milestones: milestonesData,
      today,
    });

    const startAI = Date.now();
    const { object: result } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: ReorganizeProposalSchema,
      prompt,
    });
    timings["ai_generateObject"] = Date.now() - startAI;

    // 6. 構建 tasks_context (給前端顯示用)
    const tasksContext = tasks.map((t) => ({
      id: t.id,
      title: t.content.length > 50 ? t.content.slice(0, 47) + "..." : t.content,
      current_topic: t.topic?.name || "未分類",
      current_due_date: t.due_date?.toISOString() || null,
    }));

    // 7. 過濾 time_inferences：只保留原本沒有 due_date 的 task
    const tasksWithDueDate = new Set(
      tasks.filter(t => t.due_date !== null).map(t => t.id)
    );
    const filteredTimeInferences = result.time_inferences.filter(
      inf => !tasksWithDueDate.has(inf.task_id)
    );

    // 8. 創建評估 Log (PENDING 狀態)
    const startDb4 = Date.now();
    const evaluationLog = await prisma.systemEvaluationLog.create({
      data: {
        user_id: userId,
        type: "REORGANIZE",
        input_content: {
          product_id: productId,
          product_name: product.name,
          tasks_count: tasks.length,
        },
        output_content: {
          proposed_clusters: result.proposed_clusters,
          time_inferences: filteredTimeInferences,
          task_consolidations: result.task_consolidations || [],
        },
        user_action: "PENDING",
        metadata: {
          current_topic_count: currentTopics.length,
          proposed_topic_count: result.proposed_clusters.length,
        },
      },
    });

    timings["db_evaluationLog"] = Date.now() - startDb4;
    timings["total"] = Date.now() - startTotal;

    // 輸出計時結果
    console.log("⏱️ [reorganize-topics] Timings:", JSON.stringify(timings, null, 2));

    // 9. 返回完整的 ReorganizeProposal
    return NextResponse.json({
      product_id: productId,
      product_name: product.name,
      current_topics: currentTopics,
      current_topic_count: currentTopics.length,
      proposed_clusters: result.proposed_clusters,
      time_inferences: filteredTimeInferences,
      task_consolidations: result.task_consolidations || [],
      tasks_context: tasksContext,
      logId: evaluationLog.id,
    });
  } catch (error) {
    console.error("Reorganize topics failed:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      {
        error: "Reorganization failed",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Helper: 構建精簡版 AI prompt
function buildReorganizePrompt(context: {
  product_name: string;
  area_name: string;
  current_topics: string[];
  tasks: Array<{
    id: string;
    content: string;
    narrative: string;
    current_topic: string;
    status: string;
    current_due_date: string | null;
    // sub_items 資訊
    has_sub_items: boolean;
    completed_sub_items: string[];
    pending_sub_items: Array<{ id: string; content: string }>;
  }>;
  milestones: Array<{
    id: string;
    name: string;
    target_date: string;
    status: string;
    priority: number;
    description: string;
  }>;
  today: string;
}): string {
  // 精簡 Tasks 列表格式（包含 sub_items 資訊）
  const tasksCompact = context.tasks.map((t, idx) => {
    let line = `${idx + 1}. [${t.id}] ${t.content}${t.narrative ? ` - ${t.narrative.slice(0, 50)}` : ''} (${t.current_topic})`;

    // 如果有 sub_items，顯示摘要
    if (t.has_sub_items) {
      const completedCount = t.completed_sub_items.length;
      const pendingCount = t.pending_sub_items.length;
      line += ` [子項目: ${completedCount}已完成, ${pendingCount}待處理]`;

      // 列出待處理的 sub_items（可能和其他 task 語意重疊）
      if (pendingCount > 0) {
        const pendingList = t.pending_sub_items.map(s => `    - [sub:${s.id}] ${s.content}`).join('\n');
        line += `\n${pendingList}`;
      }
    }

    return line;
  }).join("\n");

  // 精簡 Milestones 列表格式
  const milestonesCompact = context.milestones.length > 0
    ? context.milestones.map((m) => `[${m.id}] ${m.name} (${m.target_date.split('T')[0]}, P${m.priority})`).join("\n")
    : "無";

  return `你是任務組織專家。請分析以下任務並提出重組建議。

# 背景
Product: "${context.product_name}" (Area: ${context.area_name})
今天: ${context.today.split('T')[0]}

## Tasks (共 ${context.tasks.length} 個):
${tasksCompact}

## Milestones:
${milestonesCompact}

---

# Topic 分群

## 分群的核心問題
對於任意兩個任務 A 和 B，問：**「做 A 的時候，需要知道 B 嗎？」**
- 如果需要 → 放同一個 Topic
- 如果不需要 → 可以放不同 Topic

## 「需要知道」的三種情況
1. **目標相同** — A 和 B 都是為了達成同一個成果
2. **上下文相依** — 完成 A 需要參考 B 的資訊
3. **語義相近** — A 和 B 描述的是同一件事的不同面向

## Topic 命名
用「名詞片語」描述這群任務的共同主題，例如：「用戶認證」「支付系統」「測試基礎建設」「資料遷移」

---

# 時間推斷

- 只對「沒有 due_date」的 Task 建議時間，已有 due_date 的設為 null
- 所有 Task 都要設定 urgency_level
- 優先參考 Milestone 時間

---

# 任務整合（語意守恆原則）

## 第一性原理：語意守恆
整合的本質是「結構重組」，不是「資訊壓縮」。

**守恆公式**：
\`\`\`
輸出.語意總量 ≥ Σ(輸入.語意)
\`\`\`

每個被整合的子任務，其核心語意必須在輸出中有明確的「落點」。

## 語意的四個維度
判斷一個任務的「語意」時，考慮這四個維度：

| 維度 | 問題 | 範例 |
|------|------|------|
| 意圖 (Intent) | 用戶想達成什麼？ | 「修復登入 bug」|
| 上下文 (Context) | 為什麼要做？背景是什麼？ | 「用戶反映無法登入」|
| 約束 (Constraint) | 有什麼限制條件？ | 「需要在週五前」|
| 關聯 (Relation) | 與什麼相關？ | 「需要先完成 API 修改」|

## 整合的判斷標準

### ✅ 可以整合的情況（ALL 條件必須滿足）
1. **同一成果** — 所有任務都指向同一個可交付成果
2. **無獨立價值** — 單獨一個子任務完成後，對用戶沒有獨立意義
3. **語意可映射** — 每個子任務的「意圖」都能對應到 consolidated_title 的一部分

### ❌ 禁止整合的情況（ANY 條件命中即禁止）
1. **獨立上下文** — 子任務有獨立的「為什麼」，不只是步驟差異
2. **時間分離** — 子任務的時間約束差距 > 7 天
3. **可獨立完成** — 單獨完成某個子任務對用戶有獨立價值
4. **語意無法映射** — 無法在 consolidated_title 中體現某個子任務的意圖

## 整合輸出規範

### consolidated_title 的構成原則
**必須**能讓讀者從標題中「反推」出所有子任務的存在。

❌ 錯誤範例：
- 子任務：「準備簡報」「練習演講」「確認設備」
- 錯誤標題：「準備發表會」（丟失了「練習」和「設備」的語意）

✅ 正確範例：
- 正確標題：「發表會準備：簡報、演練、設備確認」

### consolidated_narrative 的構成原則
必須包含每個子任務的「上下文」，使用「因為...所以...」或「由於...需要...」的結構保留因果關係。

## 保守原則
**不確定是否該整合時，選擇不整合。**

保留兩個獨立任務的成本 < 錯誤整合導致語意丟失的成本

## Sub-Items 處理規則

當 Task 已有 sub_items 時：

### 已完成的 sub_items (completed_sub_items)
- **絕對不動** — 這些是用戶已經完成的工作，不參與任何整合

### 待處理的 sub_items (pending_sub_items)
- **可以參與整合** — 如果其他獨立 Task 與某個 pending_sub_item 語意重疊，可以合併
- **整合時需考慮** — 將獨立 Task 整合到有 sub_items 的 Task 時，新 Task 應該成為該 Task 的 sub_item

### 整合有 sub_items 的 Task 時
如果 parent_task 已經有 pending_sub_items，在 sub_task_ids 中也可以包含 \`sub:xxx\` 格式的 ID（代表要合併該 pending_sub_item）。

範例：
- Task A 有 pending_sub_items: [sub:001] 買材料, [sub:002] 準備工具
- Task B: 購買螺絲釘
- 如果「買材料」和「購買螺絲釘」語意相同，可以在整合時將 Task B 和 [sub:001] 合併為一個新的 sub_item

---

# 輸出規則
- 使用繁體中文
- 所有 task_id 必須來自上方列表
- task_consolidations 中的 consolidated_title 必須能反推出所有子任務
- sub_task_ids 可以包含 \`sub:xxx\` 格式（代表 pending_sub_item 的 ID）`;
}
