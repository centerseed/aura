import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";
import { isValidUUID } from "@/domain/constants/validation";
import type { Reference } from "@/domain/entities/task.entity";
import { mergeReferences } from "@/application/use-cases/merge-references";

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
    // 語意守恆映射表
    semantic_preservation?: Array<{
      original_task_id: string;
      preserved_in: "title" | "narrative" | "sub_item";
      key_intent: string;
    }>;
  }>;
  reasoning: string;
  logId?: string;
}

// POST /api/products/[id]/apply-reorganization
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { id: productId } = await params;

    const proposal: ReorganizeProposal = await request.json();

    if (proposal.product_id !== productId) {
      return NextResponse.json(
        { error: "Product ID mismatch" },
        { status: 400 }
      );
    }

    // 驗證 Product 存在且屬於當前用戶
    const product = await prisma.product.findUnique({
      where: { id: productId, user_id: userId, deleted_at: null },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 使用 Transaction 確保原子性 (設定 30 秒超時以處理大量 tasks)
    const result = await prisma.$transaction(async (tx) => {
      // UUID 驗證（使用統一函數）

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
            } as any, // TypeScript 類型斷言,created_at 由 Prisma 自動處理
          });
        }

        topicMapping.set(cluster.topic_name, topic.id);

        // 2. 批次更新該 cluster 中的所有 Tasks 的 topic_id
        // 過濾出有效的 task IDs
        const validTaskIds = cluster.task_ids.filter(taskId => {
          if (!isValidUUID(taskId)) {
            console.warn(`Invalid task_id in cluster: ${taskId}, skipping...`);
            return false;
          }
          return true;
        });

        // ✅ 批次更新：一次 UPDATE 整個 cluster 的所有 tasks
        // ✅ 只更新未刪除且未完成的 tasks，節省 DB 操作
        if (validTaskIds.length > 0) {
          await tx.task.updateMany({
            where: {
              id: { in: validTaskIds },
              deleted_at: null,
              status: { not: "ARCHIVE" }, // 不更新已完成的任務
            },
            data: {
              topic_id: topic.id,
            },
          });
        }
      }

      // 3. 根據 time_inferences 更新 Tasks 的時間相關欄位
      // ✅ Phase 2 優化：使用批次操作 + 獨立的 AI metadata 表
      const validInferenceTaskIds = proposal.time_inferences
        .filter(inf => isValidUUID(inf.task_id))
        .map(inf => inf.task_id);

      if (validInferenceTaskIds.length > 0) {
        // 3.1 批次查詢所有需要更新的 tasks（用於讀取現有 ai_analysis）
        // ✅ 只查詢未刪除且未完成的 tasks，節省查詢成本
        const tasksToUpdate = await tx.task.findMany({
          where: {
            id: { in: validInferenceTaskIds },
            deleted_at: null,
            status: { not: "ARCHIVE" },
          },
        });

        const taskMap = new Map(tasksToUpdate.map(t => [t.id, t]));

        // 3.2 批次更新時間欄位（每個 inference 單獨更新，因為值不同）
        // 但不再更新 ai_analysis JSON（改用獨立表）
        for (const inference of proposal.time_inferences) {
          if (!isValidUUID(inference.task_id)) {
            console.warn(`Invalid task_id format: ${inference.task_id}, skipping...`);
            continue;
          }

          const task = taskMap.get(inference.task_id);
          if (!task) continue;

          // 只更新時間相關欄位
          const updateData: {
            due_date?: Date | null;
            inferred_from_milestone?: string | null;
            time_confidence?: number;
            ai_analysis?: any; // ✅ 雙寫模式：保持向後相容
          } = {};

          if (inference.suggested_due_date) {
            updateData.due_date = new Date(inference.suggested_due_date);
          }

          if (inference.inferred_from_milestone_id && isValidUUID(inference.inferred_from_milestone_id)) {
            updateData.inferred_from_milestone = inference.inferred_from_milestone_id;
          } else {
            updateData.inferred_from_milestone = null;
          }
          updateData.time_confidence = inference.time_confidence;

          // ✅ 雙寫：同時更新 JSON（向後相容，可在 Phase 3 移除）
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

        // 3.3 ✅ 批次 UPSERT AI metadata 到獨立表（關鍵優化）
        // 使用原生 SQL 的 ON CONFLICT 實現真正的批次操作
        const now = new Date();
        const metadataValues = proposal.time_inferences
          .filter(inf => isValidUUID(inf.task_id) && taskMap.has(inf.task_id))
          .map(inf => {
            return `(
              gen_random_uuid(),
              '${inf.task_id}',
              ${inf.reasoning ? `'${inf.reasoning.replace(/'/g, "''")}'` : 'NULL'},
              ${inf.urgency_level ? `'${inf.urgency_level}'` : 'NULL'},
              '${now.toISOString()}',
              '${now.toISOString()}',
              '${now.toISOString()}'
            )`;
          })
          .join(',');

        if (metadataValues) {
          await tx.$executeRawUnsafe(`
            INSERT INTO task_ai_metadata (id, task_id, time_inference_reasoning, urgency_level, reorganized_at, created_at, updated_at)
            VALUES ${metadataValues}
            ON CONFLICT (task_id) DO UPDATE SET
              time_inference_reasoning = EXCLUDED.time_inference_reasoning,
              urgency_level = EXCLUDED.urgency_level,
              reorganized_at = EXCLUDED.reorganized_at,
              updated_at = EXCLUDED.updated_at
          `);
        }
      }

      // 4. 處理 Task 整合 (將細碎 Tasks 合併為 todo-list)
      let consolidatedCount = 0;
      if (proposal.task_consolidations && proposal.task_consolidations.length > 0) {
        for (const consolidation of proposal.task_consolidations) {
          // 驗證 parent_task_id 格式
          if (!isValidUUID(consolidation.parent_task_id)) {
            console.warn(`Invalid parent_task_id: ${consolidation.parent_task_id}, skipping consolidation...`);
            continue;
          }

          // 過濾並驗證 sub_task_ids
          const validSubTaskIds = consolidation.sub_task_ids.filter(id => {
            if (!isValidUUID(id)) {
              console.warn(`Invalid sub_task_id: ${id}, skipping...`);
              return false;
            }
            return true;
          });

          if (validSubTaskIds.length === 0) {
            console.warn(`No valid sub_task_ids for parent ${consolidation.parent_task_id}, skipping consolidation...`);
            continue;
          }

          // 獲取 parent task (包含所有欄位)
          const parentTask = await tx.task.findUnique({
            where: { id: consolidation.parent_task_id },
          });

          if (!parentTask || parentTask.deleted_at) continue;

          // 獲取所有 sub tasks (用於建立 sub_items，包含所有欄位)
          const subTasks = await tx.task.findMany({
            where: {
              id: { in: validSubTaskIds },
              deleted_at: null,
            },
            orderBy: {
              created_at: "asc",
            },
          });

          // ✅ 保留 parent task 原有的 sub_items（包含已完成的項目）
          const existingSubItems = ((parentTask as any).sub_items as Array<{
            id: string;
            content: string;
            completed: boolean;
            created_at: string;
            completed_at: string | null;
            order: number;
          }>) || [];

          // 計算新 sub_items 的起始 order（接在原有的後面）
          const startOrder = existingSubItems.length > 0
            ? Math.max(...existingSubItems.map(s => s.order ?? 0)) + 1
            : 0;

          // 構建新的 sub_items 陣列（來自被整合的 tasks）
          const newSubItems = subTasks.map((subTask, idx) => ({
            id: subTask.id, // 使用原 Task ID 作為 sub-item ID
            content: subTask.content,
            completed: false,
            created_at: new Date().toISOString(),
            completed_at: null,
            order: startOrder + idx,
          }));

          // 合併：原有的 sub_items + 新整合的 sub_items
          const subItems = [...existingSubItems, ...newSubItems];

          // ✅ 合併所有 sub tasks 的 references 到 parent task（使用統一去重函數）
          const parentReferences = ((parentTask as any).references as Reference[]) || [];

          // 收集所有 sub tasks 的 references
          const allSubReferences: Reference[] = [];
          for (const subTask of subTasks) {
            const subReferences = ((subTask as any).references as Reference[]) || [];
            allSubReferences.push(...subReferences);
          }

          // 使用統一的 mergeReferences 函數進行去重合併
          const mergedReferences = mergeReferences(parentReferences, allSubReferences);

          // 計算所有 tasks 中最晚的 due_date (保守策略)
          const allDueDates = [parentTask.due_date, ...subTasks.map(t => t.due_date)]
            .filter((d): d is Date => d !== null);
          const latestDueDate = allDueDates.length > 0
            ? new Date(Math.max(...allDueDates.map(d => d.getTime())))
            : null;

          // 建立語意映射表（用於追溯）
          const semanticMap = new Map(
            (consolidation.semantic_preservation || []).map(sp => [sp.original_task_id, sp])
          );

          // ✅ 只對「新加入的 sub_items」增強語意資訊（原有的保持不變）
          const enrichedNewSubItems = newSubItems.map(item => {
            const semanticInfo = semanticMap.get(item.id);
            const originalTask = subTasks.find(t => t.id === item.id);
            const originalAnalysis = (originalTask?.ai_analysis as Record<string, unknown>) || {};

            return {
              ...item,
              // 語意守恆欄位
              key_intent: semanticInfo?.key_intent || null,
              preserved_in: semanticInfo?.preserved_in || "sub_item",
              // 保留原始上下文（可追溯）
              original_narrative: originalAnalysis.narrative || null,
              original_due_date: originalTask?.due_date?.toISOString() || null,
            };
          });

          // ✅ 合併：原有的 sub_items（包含已完成狀態）+ 新增強的 sub_items
          const enrichedSubItems = [...existingSubItems, ...enrichedNewSubItems];

          // 更新 parent task
          const parentAnalysis = (parentTask.ai_analysis as Record<string, unknown>) || {};
          await tx.task.update({
            where: { id: consolidation.parent_task_id },
            data: {
              content: consolidation.consolidated_title,
              due_date: latestDueDate, // ✅ 取所有被整合 tasks 中最晚的 due_date
              sub_items: enrichedSubItems as any,
              references: mergedReferences as any,
              ai_analysis: {
                ...parentAnalysis,
                narrative: consolidation.consolidated_narrative,
                consolidation_reasoning: consolidation.reasoning,
                consolidated_at: new Date().toISOString(),
                // ✅ 語意守恆追溯資訊
                semantic_preservation: consolidation.semantic_preservation || [],
                consolidated_task_count: validSubTaskIds.length + 1, // parent + subs
              },
            },
          });

          // ✅ 批次軟刪除所有 sub tasks
          if (validSubTaskIds.length > 0) {
            await tx.task.updateMany({
              where: {
                id: { in: validSubTaskIds },
              },
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
    }, {
      maxWait: 30000, // 最多等待 30 秒獲取交易鎖
      timeout: 30000,  // 交易執行超時 30 秒
    });

    // 更新評估 Log 狀態為 APPLIED (如果有提供 logId)
    if (proposal.logId) {
      await prisma.systemEvaluationLog.update({
        where: { id: proposal.logId },
        data: {
          user_action: "APPLIED",
          metadata: {
            updated_topics: result.updated_topics,
            updated_tasks: result.updated_tasks,
            consolidated_tasks: result.consolidated_tasks,
          },
        },
      });
    }

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
