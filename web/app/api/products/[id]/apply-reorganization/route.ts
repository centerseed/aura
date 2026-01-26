import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface ReorganizeProposal {
  product_id: string;
  product_name: string;
  current_topics: string[];
  proposed_clusters: Array<{
    topic_name: string;
    description: string;
    task_ids: string[];
    confidence: number;
  }>;
  time_inferences: Array<{
    task_id: string;
    suggested_due_date: string | null;
    inferred_from_milestone_id: string | null;
    time_confidence: number;
    urgency_level: string;
    reasoning: string;
  }>;
  task_consolidations?: Array<{
    parent_task_id: string;
    sub_task_ids: string[];
    consolidated_title: string;
    consolidated_narrative: string;
    reasoning: string;
    confidence: number;
  }>;
  reasoning: string;
}

// POST /api/products/[id]/apply-reorganization
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || searchParams.get("user_id");
    const { id: productId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const proposal: ReorganizeProposal = await request.json();

    if (proposal.product_id !== productId) {
      return NextResponse.json(
        { error: "Product ID mismatch" },
        { status: 400 }
      );
    }

    // 驗證 Product 存在
    const product = await prisma.product.findUnique({
      where: { id: productId, deleted_at: null },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 使用 Transaction 確保原子性
    const result = await prisma.$transaction(async (tx) => {
      // 1. 根據 proposed_clusters 創建或查找 Topics
      const topicMapping: Map<string, string> = new Map(); // cluster.topic_name -> topic.id

      for (const cluster of proposal.proposed_clusters) {
        // 查找現有 Topic
        let topic = await tx.topic.findFirst({
          where: {
            user_id: userId,
            product_id: productId,
            name: cluster.topic_name,
            deleted_at: null,
          },
        });

        // 如果不存在,創建新 Topic
        if (!topic) {
          topic = await tx.topic.create({
            data: {
              user_id: userId,
              product_id: productId,
              name: cluster.topic_name,
            },
          });
        }

        topicMapping.set(cluster.topic_name, topic.id);

        // 2. 更新該 cluster 中的所有 Tasks 的 topic_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const taskId of cluster.task_ids) {
          // 驗證 task_id 格式
          if (!uuidRegex.test(taskId)) {
            console.warn(`Invalid task_id in cluster: ${taskId}, skipping...`);
            continue;
          }

          await tx.task.update({
            where: { id: taskId },
            data: {
              topic_id: topic.id,
            },
          });
        }
      }

      // 3. 根據 time_inferences 更新 Tasks 的時間相關欄位
      for (const inference of proposal.time_inferences) {
        // 驗證 task_id 格式 (必須是 UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(inference.task_id)) {
          console.warn(`Invalid task_id format: ${inference.task_id}, skipping...`);
          continue;
        }

        const task = await tx.task.findUnique({
          where: { id: inference.task_id },
        });

        if (!task || task.deleted_at) continue;

        // 準備更新的資料
        const updateData: {
          due_date?: Date | null;
          inferred_from_milestone?: string | null;
          time_confidence?: number;
          ai_analysis?: any;
        } = {};

        if (inference.suggested_due_date) {
          updateData.due_date = new Date(inference.suggested_due_date);
        }

        // 驗證 inferred_from_milestone_id 是否為有效 UUID (可能是 null 或無效值)
        if (inference.inferred_from_milestone_id && uuidRegex.test(inference.inferred_from_milestone_id)) {
          updateData.inferred_from_milestone = inference.inferred_from_milestone_id;
        } else {
          updateData.inferred_from_milestone = null;
        }
        updateData.time_confidence = inference.time_confidence;

        // 更新 ai_analysis JSON (添加時間推斷理由和緊急程度)
        const currentAnalysis = (task.ai_analysis as Record<string, unknown>) || {};
        updateData.ai_analysis = {
          ...currentAnalysis,
          time_inference_reasoning: inference.reasoning,
          urgency_level: inference.urgency_level,
          reorganized_at: new Date().toISOString(),
        };

        await tx.task.update({
          where: { id: inference.task_id },
          data: updateData,
        });
      }

      // 4. 處理 Task 整合 (將細碎 Tasks 合併為 todo-list)
      let consolidatedCount = 0;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (proposal.task_consolidations && proposal.task_consolidations.length > 0) {
        for (const consolidation of proposal.task_consolidations) {
          // 驗證 parent_task_id 格式
          if (!uuidRegex.test(consolidation.parent_task_id)) {
            console.warn(`Invalid parent_task_id: ${consolidation.parent_task_id}, skipping consolidation...`);
            continue;
          }

          // 過濾並驗證 sub_task_ids
          const validSubTaskIds = consolidation.sub_task_ids.filter(id => {
            if (!uuidRegex.test(id)) {
              console.warn(`Invalid sub_task_id: ${id}, skipping...`);
              return false;
            }
            return true;
          });

          if (validSubTaskIds.length === 0) {
            console.warn(`No valid sub_task_ids for parent ${consolidation.parent_task_id}, skipping consolidation...`);
            continue;
          }

          // 獲取 parent task
          const parentTask = await tx.task.findUnique({
            where: { id: consolidation.parent_task_id },
          });

          if (!parentTask || parentTask.deleted_at) continue;

          // 獲取所有 sub tasks (用於建立 sub_items)
          const subTasks = await tx.task.findMany({
            where: {
              id: { in: validSubTaskIds },
              deleted_at: null,
            },
            orderBy: {
              created_at: "asc",
            },
          });

          // 構建 sub_items 陣列
          const subItems = subTasks.map((subTask, idx) => {
            const subAnalysis = (subTask.ai_analysis as Record<string, unknown>) || {};
            return {
              id: subTask.id, // 使用原 Task ID 作為 sub-item ID
              content: subTask.content,
              completed: false,
              created_at: new Date().toISOString(),
              completed_at: null,
              order: idx,
            };
          });

          // 更新 parent task
          const parentAnalysis = (parentTask.ai_analysis as Record<string, unknown>) || {};
          await tx.task.update({
            where: { id: consolidation.parent_task_id },
            data: {
              content: consolidation.consolidated_title,
              ai_analysis: {
                ...parentAnalysis,
                narrative: consolidation.consolidated_narrative,
                sub_items: subItems,
                sub_items_meta: {
                  total: subItems.length,
                  completed: 0,
                  completion_rate: 0.0,
                },
                consolidation_reasoning: consolidation.reasoning,
                consolidated_at: new Date().toISOString(),
              },
            },
          });

          // 軟刪除所有 sub tasks (使用過濾後的有效 IDs)
          for (const subTaskId of validSubTaskIds) {
            await tx.task.update({
              where: { id: subTaskId },
              data: {
                deleted_at: new Date(),
              },
            });
          }

          consolidatedCount++;
        }
      }

      return {
        updated_topics: proposal.proposed_clusters.length,
        updated_tasks: proposal.time_inferences.length,
        consolidated_tasks: consolidatedCount,
      };
    });

    return NextResponse.json({
      success: true,
      updated_topics: result.updated_topics,
      updated_tasks: result.updated_tasks,
      consolidated_tasks: result.consolidated_tasks,
      message: `成功重組 ${result.updated_topics} 個 Topics、${result.updated_tasks} 個 Tasks${
        result.consolidated_tasks > 0 ? `，並整合 ${result.consolidated_tasks} 組細碎 Tasks` : ""
      }`,
    });
  } catch (error) {
    console.error("Apply reorganization failed:", error);
    return NextResponse.json(
      {
        error: "Failed to apply reorganization",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
