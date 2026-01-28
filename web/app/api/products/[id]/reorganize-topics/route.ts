import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

// Zod Schema for AI structured output
const ReorganizeProposalSchema = z.object({
  proposed_clusters: z.array(
    z.object({
      topic_name: z.string().describe("建議的 Topic 名稱"),
      description: z.string().describe("該 Topic 的語義描述"),
      task_ids: z.array(z.string()).describe("屬於該 Topic 的 Task IDs"),
      confidence: z.number().min(0).max(1).describe("AI 的信心度"),
    })
  ).describe("新的 Topic 分群"),

  time_inferences: z.array(
    z.object({
      task_id: z.string(),
      suggested_due_date: z.string().nullable().describe("建議的截止日期 (ISO 8601)"),
      inferred_from_milestone_id: z.string().nullable().describe("從哪個 Milestone 推斷"),
      time_confidence: z.number().min(0).max(1).describe("時間推斷的信心度"),
      urgency_level: z.enum(["critical", "high", "medium", "low"]).describe("緊急程度"),
      reasoning: z.string().describe("時間推斷的理由"),
    })
  ).describe("所有 Tasks 的時間推斷"),

  task_consolidations: z.array(
    z.object({
      parent_task_id: z.string().describe("作為主 Task 的 ID (從 task_ids 中選一個最具代表性的)"),
      sub_task_ids: z.array(z.string()).describe("將被整合為 sub-items 的 Task IDs"),
      consolidated_title: z.string().describe("整合後的主 Task 標題"),
      consolidated_narrative: z.string().describe("整合後的敘述"),
      reasoning: z.string().describe("為何要整合這些 Tasks"),
      confidence: z.number().min(0).max(1).describe("整合建議的信心度"),
    })
  ).optional().describe("建議整合成 todo-list 的 Task 群組"),

  reasoning: z.string().describe("整體重組的理由與邏輯"),
});

// POST /api/products/[id]/reorganize-topics
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { id: productId } = await params;

    // 1. 查詢 Product 資訊並驗證屬於當前用戶
    const product = await prisma.product.findUnique({
      where: { id: productId, user_id: userId, deleted_at: null },
      include: {
        area: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 2. 查詢該 Product 下的所有 Tasks
    // ✅ 過濾已刪除和已完成的 task,節省 AI 處理成本
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

    // 4. 構建上下文資訊
    const currentTopics = [...new Set(tasks.map((t) => t.topic?.name).filter((name): name is string => Boolean(name)))];

    // 構建 Tasks 資訊 (給 AI)
    const tasksData = tasks.map((t) => {
      const aiAnalysis = t.ai_analysis as { narrative?: string } | null;
      return {
        id: t.id,
        content: t.content,
        narrative: aiAnalysis?.narrative || "",
        current_topic: t.topic?.name || "未分類",
        status: t.status,
        current_due_date: t.due_date?.toISOString() || null,
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

    const { object: result } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: ReorganizeProposalSchema,
      prompt,
    });

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
          reasoning: result.reasoning,
        },
        user_action: "PENDING",
        metadata: {
          current_topic_count: currentTopics.length,
          proposed_topic_count: result.proposed_clusters.length,
        },
      },
    });

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
      reasoning: result.reasoning,
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
  // 精簡 Tasks 列表格式
  const tasksCompact = context.tasks.map((t, idx) =>
    `${idx + 1}. [${t.id}] ${t.content}${t.narrative ? ` - ${t.narrative.slice(0, 50)}` : ''} (${t.current_topic})`
  ).join("\n");

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

# 任務整合

## 整合的核心問題
問：**「這些任務是同一件事的 checklist 嗎？」**

整合條件：
1. 它們共同完成「一個」明確成果
2. 單獨看每個任務沒有獨立意義
3. 可以用 checkbox 逐一勾掉

---

# 輸出規則
- 使用繁體中文
- 所有 task_id 必須來自上方列表
- inferred_from_milestone_id 必須是有效 Milestone ID 或 null`;
}
