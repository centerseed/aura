/**
 * TODO [技術債 - 需重構至 Clean Architecture]:
 * 此 API 包含大量業務邏輯 (448行),應提取至 Use Case 層
 * 目前為快速統一格式,保留邏輯在此,未來需重構
 * 參考已重構的 Tasks/Products/Areas/Milestones APIs
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";
import { librarianObserve } from "@/lib/librarian-client";
import { Status, Lifecycle } from "@prisma/client";

// 🚀 Raw SQL 查詢結果的型別
interface RawStructureRow {
  area_id: string
  area_name: string
  product_id: string | null
  product_name: string | null
  topic_id: string | null
  topic_name: string | null
  task_id: string | null
  task_content: string | null
  task_topic_id: string | null
  task_ai_analysis: unknown
}

// AI 解析自然語言調整指令的結構（繁體中文）
const AdjustmentIntentSchema = z.object({
  intent_type: z.enum(["move_tasks", "change_topic", "no_action"]).describe(
    "move_tasks: 移動任務到不同專案, change_topic: 改變任務的主題標籤, no_action: 不是調整指令"
  ),
  task_matches: z.array(
    z.object({
      task_id: z.string().describe("要修改的任務 ID"),
      task_title: z.string().describe("任務標題（用於顯示）"),
      current_location: z.string().describe("目前所在 Area/Product 位置"),
      match_reason: z.string().describe("為什麼此任務符合用戶的描述（繁體中文）"),
    })
  ).describe("符合用戶描述的任務"),
  target_area: z.string().optional().describe("目標 Area 名稱（移動操作用）"),
  target_product: z.string().optional().describe("目標 Product 名稱（移動操作用）"),
  target_topic: z.string().optional().describe("目標 Topic 名稱（變更主題用）"),
  reasoning: z.string().describe("用繁體中文說明解析結果的理由"),
});

// POST /api/adjust-tags
export async function POST(request: NextRequest) {
  try {
    const timings: Record<string, number> = {};
    const startTotal = Date.now();

    const userId = await authenticateRequest(request, prisma);
    const body = await request.json() as any;
    const { text, preview = false, confirmed = false, logId = null } = body;

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // 🚀 獲取用戶現有結構（單一 SQL 查詢）
    const startDbStructure = Date.now();

    // 使用 raw SQL JOIN 替代 3 層 nested include
    const rawRows = await prisma.$queryRaw<RawStructureRow[]>`
      SELECT
        a.id::text as area_id,
        a.name as area_name,
        p.id::text as product_id,
        p.name as product_name,
        top.id::text as topic_id,
        top.name as topic_name,
        t.id::text as task_id,
        t.content as task_content,
        t.topic_id::text as task_topic_id,
        t.ai_analysis as task_ai_analysis
      FROM areas a
      LEFT JOIN products p ON p.area_id = a.id AND p.deleted_at IS NULL
      LEFT JOIN topics top ON top.product_id = p.id AND top.deleted_at IS NULL
      LEFT JOIN tasks t ON t.product_id = p.id
        AND t.deleted_at IS NULL
        AND t.status != 'ARCHIVE'::"statusenum"
      WHERE a.user_id = ${userId}::uuid AND a.deleted_at IS NULL
      ORDER BY a.name, p.name, t.created_at DESC
    `

    // 構建結構摘要和 taskMap
    let contextSummary = "### 用戶現有結構:\n\n";
    const taskMap: Record<string, {
      areaName: string;
      productName: string;
      content: string;
      topicName: string | null;
      productId: string;
      aiAnalysis: object | null;
    }> = {};

    // 用於去重和組織數據的結構
    const areasProcessed = new Set<string>();
    const productsProcessed = new Set<string>();
    const topicsByProduct = new Map<string, Set<string>>();
    const tasksProcessed = new Set<string>();

    // 第一遍：收集所有 topics
    for (const row of rawRows) {
      if (row.product_id && row.topic_name) {
        if (!topicsByProduct.has(row.product_id)) {
          topicsByProduct.set(row.product_id, new Set());
        }
        topicsByProduct.get(row.product_id)!.add(row.topic_name);
      }
    }

    // 第二遍：構建 contextSummary 和 taskMap
    let currentAreaId: string | null = null;
    let currentProductId: string | null = null;

    for (const row of rawRows) {
      // 處理 Area
      if (!areasProcessed.has(row.area_id)) {
        areasProcessed.add(row.area_id);
        currentAreaId = row.area_id;
        contextSummary += `**Area: ${row.area_name}**\n`;
      }

      // 處理 Product
      if (row.product_id && !productsProcessed.has(row.product_id)) {
        productsProcessed.add(row.product_id);
        currentProductId = row.product_id;
        contextSummary += `  📦 Product: ${row.product_name}\n`;

        // 顯示 Topics
        const topics = topicsByProduct.get(row.product_id);
        if (topics && topics.size > 0) {
          contextSummary += `     可用 Topics: ${Array.from(topics).join(", ")}\n`;
        }
      }

      // 處理 Task
      if (row.task_id && !tasksProcessed.has(row.task_id)) {
        tasksProcessed.add(row.task_id);
        const aiAnalysis = row.task_ai_analysis as { narrative?: string } || {};

        // 找到 task 的 topic name
        let taskTopicName: string | null = null;
        if (row.task_topic_id) {
          // 從同一 product 的 topics 中找
          for (const r of rawRows) {
            if (r.product_id === row.product_id && r.topic_id === row.task_topic_id) {
              taskTopicName = r.topic_name;
              break;
            }
          }
        }

        contextSummary += `     - [${row.task_id}] ${row.task_content}${taskTopicName ? ` (Topic: ${taskTopicName})` : ""}${aiAnalysis.narrative ? ` | ${aiAnalysis.narrative}` : ""}\n`;

        taskMap[row.task_id] = {
          areaName: row.area_name,
          productName: row.product_name!,
          content: row.task_content!,
          topicName: taskTopicName,
          productId: row.product_id!,
          aiAnalysis: row.task_ai_analysis as object | null,
        };
      }

      // 處理 Area 換行
      if (currentAreaId !== row.area_id) {
        contextSummary += "\n";
        currentAreaId = row.area_id;
      }
    }
    contextSummary += "\n";
    timings["db_structure"] = Date.now() - startDbStructure;

    // 調用 AI 解析用戶意圖
    const startAI = Date.now();
    const { object: intent } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: AdjustmentIntentSchema,
      prompt: `你是 Zentropy 的標籤調整助手。用戶想要調整現有任務的分類。

## 你的任務:
1. 判斷用戶的意圖類型（移動任務 or 改變主題標籤 or 不是調整指令）
2. 找出用戶描述的任務（可能是任務內容的關鍵字、模糊描述等）
3. 確定目標位置（Area/Product 或 Topic）

## 用戶指令範例:
- "把『向學校主任通報出入境』移到『搬家去日本』專案" → intent_type: move_tasks
- "把所有關於手機的任務歸到『行政事務』專案" → intent_type: move_tasks
- "把『送竹節餅』的 Topic 改成『其他』" → intent_type: change_topic
- "明天要去買菜" → intent_type: no_action (這是新任務，不是調整指令)

## 重要規則:
- 只有明確提到「移到」、「改成」、「歸到」等調整動作的才是調整指令
- 用戶可能用任務內容的部分關鍵字來指稱任務，你需要模糊匹配
- 如果找到多個匹配的任務，全部列出（用戶可能想批量移動）
- 目標 Area/Product/Topic 必須使用**現有結構中完全相同**的名稱

${contextSummary}

## 用戶輸入:
${text}

請分析用戶意圖並找出需要調整的任務。reasoning 請用繁體中文說明。`,
    });
    timings["ai_generateObject"] = Date.now() - startAI;

    console.log("Adjustment Intent:", intent);

    // 如果不是調整指令，返回提示
    if (intent.intent_type === "no_action") {
      return NextResponse.json({
        success: false,
        message: "這似乎不是一個調整標籤的指令。如果您想新增任務,請直接送出。如果想調整現有任務,請明確說明要「移到」或「改成」哪裡。",
        intent_type: "no_action",
        reasoning: intent.reasoning,
      });
    }

    // 如果沒有找到匹配的任務
    if (intent.task_matches.length === 0) {
      return NextResponse.json({
        success: false,
        message: "找不到符合描述的任務。請檢查任務內容是否正確。",
        intent_type: intent.intent_type,
        reasoning: intent.reasoning,
      });
    }

    // 如果只是預覽模式，返回操作預覽，不實際執行
    if (preview || !confirmed) {
      // 結構化的操作預覽數據
      const structuredOperations: Array<{
        type: "move" | "change_topic";
        reason: string;
        from: { area?: string; product: string; topic?: string; taskTitle: string };
        to: { area?: string; product?: string; topic?: string };
      }> = [];

      const previewLog: string[] = [];

      if (intent.intent_type === "move_tasks" && intent.target_product) {
        for (const match of intent.task_matches) {
          // ✅ 優化：直接使用 taskMap，不需要查詢資料庫
          const taskInfo = taskMap[match.task_id];
          if (taskInfo) {
            previewLog.push(
              `將「${taskInfo.content}」\n從 ${taskInfo.areaName} / ${taskInfo.productName}\n移到 ${intent.target_area || taskInfo.areaName} / ${intent.target_product}`
            );

            structuredOperations.push({
              type: "move",
              reason: match.match_reason,
              from: {
                area: taskInfo.areaName,
                product: taskInfo.productName,
                taskTitle: match.task_title || taskInfo.content,
              },
              to: {
                area: intent.target_area || taskInfo.areaName,
                product: intent.target_product,
              },
            });
          }
        }
      }

      if (intent.intent_type === "change_topic" && intent.target_topic) {
        for (const match of intent.task_matches) {
          // ✅ 優化：直接使用 taskMap，不需要查詢資料庫
          const taskInfo = taskMap[match.task_id];
          if (taskInfo) {
            previewLog.push(
              `將「${taskInfo.content}」的 Topic\n從 ${taskInfo.topicName || "(無)"}\n改為 ${intent.target_topic}`
            );

            structuredOperations.push({
              type: "change_topic",
              reason: match.match_reason,
              from: {
                area: taskInfo.areaName,
                product: taskInfo.productName,
                topic: taskInfo.topicName || undefined,
                taskTitle: match.task_title || taskInfo.content,
              },
              to: {
                topic: intent.target_topic,
              },
            });
          }
        }
      }

      // 創建評估 Log (PENDING 狀態)
      const startDbLog = Date.now();
      const evaluationLog = await prisma.systemEvaluationLog.create({
        data: {
          user_id: userId,
          type: "ADJUST_TAGS",
          input_content: { text },
          output_content: {
            intent,
            structured_operations: structuredOperations,
          },
          user_action: "PENDING",
        },
      });
      timings["db_createLog"] = Date.now() - startDbLog;
      timings["total"] = Date.now() - startTotal;
      console.log("⏱️ [adjust-tags] Timings (preview):", JSON.stringify(timings, null, 2));

      return NextResponse.json({
        success: true,
        preview: true,
        logId: evaluationLog.id,
        intent_type: intent.intent_type,
        reasoning: intent.reasoning,
        structured_operations: structuredOperations,
        preview_operations: previewLog,
        task_matches: intent.task_matches,
        changes: {
          moved: intent.task_matches.length,
        },
      });
    }

    const operationLog: string[] = [];
    let movedCount = 0;
    const startExecution = Date.now();

    // 執行移動操作
    if (intent.intent_type === "move_tasks" && intent.target_product) {
      // 找到目標 Area
      let targetArea = await prisma.area.findFirst({
        where: { user_id: userId, name: intent.target_area, deleted_at: null },
      });

      if (!targetArea && intent.target_area) {
        // 創建新 Area（如果 AI 建議了新的）
        targetArea = await prisma.area.create({
          data: {
            user_id: userId,
            name: intent.target_area,
            is_custom: true,
          },
        });
        operationLog.push(`➕ 創建新 Area：${intent.target_area}`);
      }

      // 找到目標 Product
      let targetProduct = await prisma.product.findFirst({
        where: {
          user_id: userId,
          name: intent.target_product,
          deleted_at: null,
          ...(targetArea ? { area_id: targetArea.id } : {}),
        },
      });

      if (!targetProduct && targetArea) {
        // 創建新 Product
        targetProduct = await prisma.product.create({
          data: {
            user_id: userId,
            area_id: targetArea.id,
            name: intent.target_product,
            status: Status.ACTIVE,
            lifecycle: Lifecycle.FINITE,
          },
        });
        operationLog.push(`➕ 創建新 Product：${intent.target_product}`);
      }

      if (!targetProduct) {
        return NextResponse.json({
          success: false,
          message: `找不到目標專案「${intent.target_product}」`,
          intent_type: intent.intent_type,
        }, { status: 404 });
      }

      // ✅ 優化：使用 taskMap 資料，不需要查詢資料庫
      for (const match of intent.task_matches) {
        const taskInfo = taskMap[match.task_id];
        if (!taskInfo) continue;

        await prisma.task.update({
          where: { id: match.task_id },
          data: {
            product_id: targetProduct.id,
            ai_analysis: {
              ...(taskInfo.aiAnalysis || {}),
              manual_adjustment: `移到 ${intent.target_area || ""} / ${intent.target_product}`,
              adjusted_at: new Date().toISOString(),
            },
          },
        });

        operationLog.push(
          `✅ 移動「${taskInfo.content}」\n   從 ${taskInfo.areaName} / ${taskInfo.productName} → ${intent.target_area || taskInfo.areaName} / ${intent.target_product}`
        );
        movedCount++;

        // 非同步推送分類修正到 Librarian Service
        librarianObserve({
          userId,
          taskContent: taskInfo.content,
          originalProduct: taskInfo.productName,
          correctedProduct: intent.target_product!,
        }).catch(() => {});
      }
    }

    // 執行 Topic 變更操作
    if (intent.intent_type === "change_topic" && intent.target_topic) {
      // ✅ 優化：建立 Topic 快取，避免重複查詢/創建相同 Topic
      const topicCache = new Map<string, string | null>(); // productId::topicName -> topicId

      for (const match of intent.task_matches) {
        const taskInfo = taskMap[match.task_id];
        if (!taskInfo) continue;

        const cacheKey = `${taskInfo.productId}::${intent.target_topic}`;
        let targetTopicId: string | null = null;

        // 檢查快取
        if (topicCache.has(cacheKey)) {
          targetTopicId = topicCache.get(cacheKey) ?? null;
        } else {
          // 找到或創建目標 Topic
          let targetTopic = await prisma.topic.findFirst({
            where: {
              user_id: userId,
              product_id: taskInfo.productId,
              name: intent.target_topic,
              deleted_at: null,
            },
          });

          if (!targetTopic && intent.target_topic.trim() !== "") {
            targetTopic = await prisma.topic.create({
              data: {
                user_id: userId,
                product_id: taskInfo.productId,
                name: intent.target_topic,
                created_at: new Date(),
              },
            });
            operationLog.push(`➕ 創建新 Topic：${intent.target_topic}`);
          }

          targetTopicId = targetTopic?.id ?? null;
          topicCache.set(cacheKey, targetTopicId);
        }

        // 更新任務的 Topic
        await prisma.task.update({
          where: { id: match.task_id },
          data: {
            topic_id: targetTopicId,
            ai_analysis: {
              ...(taskInfo.aiAnalysis || {}),
              manual_topic_change: intent.target_topic,
              topic_changed_at: new Date().toISOString(),
            },
          },
        });

        operationLog.push(
          `🏷️  更改「${taskInfo.content}」的 Topic\n   從 ${taskInfo.topicName || "(無)"} → ${intent.target_topic}`
        );
        movedCount++;

        // 非同步推送 Topic 修正到 Librarian Service
        librarianObserve({
          userId,
          taskContent: taskInfo.content,
          originalProduct: taskInfo.productName,
          correctedProduct: taskInfo.productName, // Product 不變
          originalTopic: taskInfo.topicName,
          correctedTopic: intent.target_topic,
        }).catch(() => {});
      }
    }

    // 更新評估 Log 狀態為 APPLIED (如果有提供 logId)
    if (logId) {
      await prisma.systemEvaluationLog.update({
        where: { id: logId },
        data: {
          user_action: "APPLIED",
          metadata: {
            operations: operationLog,
            moved_count: movedCount,
          },
        },
      });
    }

    timings["db_execution"] = Date.now() - startExecution;
    timings["total"] = Date.now() - startTotal;
    console.log("⏱️ [adjust-tags] Timings (execute):", JSON.stringify(timings, null, 2));

    return NextResponse.json({
      success: true,
      intent_type: intent.intent_type,
      reasoning: intent.reasoning,
      operations: operationLog,
      task_matches: intent.task_matches,
      changes: {
        moved: movedCount,
      },
    });
  } catch (error) {
    console.error("Adjust tags failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error details:", errorMessage);

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
      error: "Tag adjustment failed",
      details: errorMessage
    }, { status: 500 });
  }
}
