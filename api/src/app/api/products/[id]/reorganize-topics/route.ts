import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";
import { checkAiRateLimit, incrementAiUsage, DEFAULT_AI_MODEL } from "@/lib/ai-rate-limit";
import { UnauthorizedException, RateLimitException } from "@/lib/api-response";
import { buildReorganizePrompt } from "@/lib/reorganize-prompt";

// Zod Schema for AI structured output (極簡版 - 減少 74% 輸出量)
const ReorganizeProposalSchema = z.object({
  // Topic 治理（可選，向後兼容）—— 使用 flat schema 確保 Gemini 相容性
  topic_operations: z.array(z.object({
    action: z.enum(["keep", "rename", "merge"])
      .describe("keep=保留, rename=重命名, merge=合併"),
    topic_name: z.string().optional()
      .describe("action=keep 時：Topic 名稱"),
    old_name: z.string().optional()
      .describe("action=rename 時：舊名稱"),
    new_name: z.string().optional()
      .describe("action=rename 時：新名稱，5-10 字"),
    source_names: z.array(z.string()).optional()
      .describe("action=merge 時：要合併的來源 Topic 名稱（至少 2 個）"),
    target_name: z.string().optional()
      .describe("action=merge 時：合併後的目標 Topic 名稱"),
    reasoning: z.string().max(20).optional()
      .describe("action=rename/merge 時：理由（最多 20 字）"),
  })).optional(),

  // Topic 分群
  proposed_clusters: z.array(
    z.object({
      topic_name: z.string().describe("Topic 名稱，5-10 字"),
      task_ids: z.array(z.string()),
    })
  ),

  // 任務整合（可選）
  task_consolidations: z.array(
    z.object({
      parent_task_id: z.string().describe("選一個語意最完整的 task 當 parent"),
      sub_task_ids: z.array(z.string()).describe("要變成 sub-item 的 task IDs"),
      consolidated_title: z.string().describe("整合後的標題，10-20 字"),
      reasoning: z.string().describe("整合理由，最多 10 字"),
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
    await checkAiRateLimit(userId);
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
    // 查詢該 Product 下所有未刪除的 Topics（不只是有 active tasks 的）
    // 這樣 AI 才能看到所有舊 topic 並提出 merge/rename 建議
    const allProductTopics = await prisma.topic.findMany({
      where: { product_id: productId, deleted_at: null },
      select: { name: true },
    });
    const currentTopics = allProductTopics.map(t => t.name);

    // 構建 Tasks 資訊 (給 AI) — 從 sub_tasks 表讀取
    const tasksData = await Promise.all(tasks.map(async (t) => {
      const aiAnalysis = t.ai_analysis as { narrative?: string } | null;

      // 從 sub_tasks 表讀取（取代 JSON）
      const subTaskRows = await prisma.subTask.findMany({
        where: { task_id: t.id, deleted_at: null },
        orderBy: { order: 'asc' },
      });

      const completedSubItems = subTaskRows.filter(s => s.completed);
      const pendingSubItems = subTaskRows.filter(s => !s.completed);

      return {
        id: t.id,
        content: t.content,
        narrative: aiAnalysis?.narrative || "",
        current_topic: t.topic?.name || "未分類",
        status: t.status,
        current_due_date: t.due_date?.toISOString() || null,
        has_sub_items: subTaskRows.length > 0,
        completed_sub_items: completedSubItems.map(s => s.content),
        pending_sub_items: pendingSubItems.map(s => ({ id: s.id, content: s.content })),
      };
    }));

    // 構建 Milestones 資訊 (給 AI)
    const milestonesData = milestones.map((m) => ({
      id: m.id,
      name: m.name,
      target_date: m.target_date.toISOString(),
      status: m.status,
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
    const { object: result, usage: aiUsage } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: ReorganizeProposalSchema,
      prompt,
    });
    timings["ai_generateObject"] = Date.now() - startAI;
    await incrementAiUsage(userId, { usage: aiUsage, feature: 'reorganize_topics', model: DEFAULT_AI_MODEL });

    // 過濾無效的 merge 操作（source_names 少於 2 個不算真正的合併）
    if (result.topic_operations) {
      result.topic_operations = result.topic_operations.filter(
        (op) => op.action !== "merge" || op.source_names.length >= 2
      );
    }

    // 6. 構建 consolidation_map (用於標記 c_role)
    const consolidationMap = new Map<string, "p" | "s">();
    result.task_consolidations?.forEach((c) => {
      consolidationMap.set(c.parent_task_id, "p");
      c.sub_task_ids.forEach(id => consolidationMap.set(id, "s"));
    });

    // 7. 構建 tasks_context (給前端顯示用，包含 c_role 標記)
    const tasksContext = tasks.map((t) => {
      const aiAnalysis = t.ai_analysis as { narrative?: string } | null;
      const narrative = aiAnalysis?.narrative || "";

      // 優先使用 narrative，如果沒有則用 content
      let displayTitle = narrative || t.content;

      // 如果 narrative 和 content 都有，組合顯示
      if (narrative && t.content !== narrative) {
        displayTitle = `${t.content}${narrative ? ` - ${narrative}` : ''}`;
      }

      // 限制長度
      if (displayTitle.length > 80) {
        displayTitle = displayTitle.slice(0, 77) + "...";
      }

      // 從 tasksData 取得已查詢的 sub_tasks 資料（避免重複查詢）
      const taskData = tasksData.find(td => td.id === t.id);

      return {
        id: t.id,
        title: displayTitle,
        current_topic: t.topic?.name || "未分類",
        current_due_date: t.due_date?.toISOString() || null,
        c_role: consolidationMap.get(t.id),
        pending_sub_items: taskData?.pending_sub_items || [],
        completed_sub_items: (taskData?.completed_sub_items || []).map(c =>
          typeof c === 'string' ? { id: '', content: c } : c
        ),
      };
    });

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
          topic_operations: result.topic_operations || [],
          proposed_clusters: result.proposed_clusters,
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

    // 輸出計時結果（增強版：更顯眼的格式）
    console.log("\n" + "=".repeat(60));
    console.log("⏱️  [REORGANIZE-TOPICS] 性能分析");
    console.log("=".repeat(60));
    console.log(`📦 Product: ${product.name} (${tasks.length} tasks)`);
    console.log(`⏰ 總耗時: ${timings.total}ms`);
    console.log("\n📊 分段計時:");
    console.log(`  └─ 資料庫查詢 (Product): ${timings.db_product}ms`);
    console.log(`  └─ 資料庫查詢 (Tasks): ${timings.db_tasks}ms`);
    console.log(`  └─ 資料庫查詢 (Milestones): ${timings.db_milestones}ms`);
    console.log(`  └─ AI 生成 (Gemini): ${timings.ai_generateObject}ms ⚠️ 主要瓶頸`);
    console.log(`  └─ 資料庫寫入 (Log): ${timings.db_evaluationLog}ms`);
    console.log("\n💡 優化建議:");
    if (timings.ai_generateObject > 3000) {
      console.log(`  ⚠️  AI 生成時間過長 (${timings.ai_generateObject}ms > 3000ms)`);
      console.log(`  → 考慮：1) 縮短 prompt 2) 使用更快的模型 3) 減少 task 數量`);
    }
    if (timings.db_tasks > 500) {
      console.log(`  ⚠️  Tasks 查詢較慢 (${timings.db_tasks}ms > 500ms)`);
      console.log(`  → 考慮：添加資料庫索引或減少 include 欄位`);
    }
    console.log("=".repeat(60) + "\n");

    // 9. 返回精簡版 ReorganizeProposal
    return NextResponse.json({
      product_id: productId,
      product_name: product.name,
      current_topics: currentTopics,
      current_topic_count: currentTopics.length,
      topic_operations: result.topic_operations || [],
      proposed_clusters: result.proposed_clusters,
      task_consolidations: result.task_consolidations || [],
      tasks_context: tasksContext,
      logId: evaluationLog.id,
    });
  } catch (error) {
    // Auth 錯誤返回 401，不要返回 500
    if (error instanceof UnauthorizedException) {
      return NextResponse.json(
        { error: "Unauthorized", message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof RateLimitException) {
      return NextResponse.json(
        { error: "Rate limit exceeded", message: error.message },
        { status: 429 }
      );
    }
    console.error("Reorganize topics failed:", error);
    return NextResponse.json(
      { error: "Reorganization failed" },
      { status: 500 }
    );
  }
}

