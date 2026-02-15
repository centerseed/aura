import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";
import { isValidUUID } from "@/domain/constants/validation";
import type { Reference } from "@/domain/entities/task.entity";
import { mergeReferences } from "@/application/use-cases/merge-references";
import { syncSubTasksToJson } from "@/infrastructure/repositories/sub-task-sync";
import { cleanupZombieTopics } from "./zombie-cleanup";

type TopicOperation =
  | { action: "keep"; topic_name: string }
  | { action: "rename"; old_name: string; new_name: string; reasoning: string }
  | { action: "merge"; source_names: string[]; target_name: string; reasoning: string };

interface ReorganizeProposal {
  product_id: string;
  product_name: string;
  current_topics: string[];
  topic_operations?: TopicOperation[];
  proposed_clusters: Array<{
    topic_name: string;
    task_ids: string[];
  }>;
  task_consolidations?: Array<{
    parent_task_id: string;
    sub_task_ids: string[];
    consolidated_title: string;
    reasoning: string;
  }>;
  logId?: string;
  apply_topic_operations?: boolean;
  apply_task_consolidations?: boolean;
}

// POST /api/products/[id]/apply-reorganization
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { id: productId } = await params;

    const proposal: ReorganizeProposal = await request.json() as ReorganizeProposal;

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

    const applyTopicOps = proposal.apply_topic_operations !== false;
    const applyConsolidations = proposal.apply_task_consolidations !== false;

    console.log("\n[APPLY-REORGANIZATION] 開始處理");
    console.log(`  Product: ${productId}`);
    console.log(`  applyTopicOps: ${applyTopicOps}, applyConsolidations: ${applyConsolidations}`);
    console.log(`  topic_operations: ${JSON.stringify(proposal.topic_operations || [])}`);
    console.log(`  proposed_clusters: ${proposal.proposed_clusters.length} 個`);
    console.log(`  task_consolidations: ${(proposal.task_consolidations || []).length} 個`);

    // 使用 Transaction 確保原子性 (設定 30 秒超時以處理大量 tasks)
    const result = await prisma.$transaction(async (tx) => {
      // 0. 處理 Topic Operations（rename / merge）
      const topicIdMapping = new Map<string, string>(); // old topic name -> resolved topic id
      const operatedTopicIds = new Set<string>(); // 本次操作過的 topic IDs

      if (applyTopicOps && proposal.topic_operations && proposal.topic_operations.length > 0) {
        for (const op of proposal.topic_operations) {
          if (op.action === "rename") {
            const existingTopic = await tx.topic.findFirst({
              where: { user_id: userId, product_id: productId, name: op.old_name, deleted_at: null },
            });
            if (existingTopic) {
              await tx.topic.update({
                where: { id: existingTopic.id },
                data: { name: op.new_name },
              });
              topicIdMapping.set(op.new_name, existingTopic.id);
              operatedTopicIds.add(existingTopic.id);
            }
          } else if (op.action === "merge") {
            // 找到或建立 target topic
            let targetTopic = await tx.topic.findFirst({
              where: { user_id: userId, product_id: productId, name: op.target_name, deleted_at: null },
            });

            // 如果 target 不存在，用第一個 source 改名
            const sourceTopics = [];
            for (const sourceName of op.source_names) {
              const t = await tx.topic.findFirst({
                where: { user_id: userId, product_id: productId, name: sourceName, deleted_at: null },
              });
              if (t) sourceTopics.push(t);
            }

            if (!targetTopic && sourceTopics.length > 0) {
              // 用第一個 source 改名為 target
              targetTopic = sourceTopics[0];
              await tx.topic.update({
                where: { id: targetTopic.id },
                data: { name: op.target_name },
              });
            }

            if (targetTopic) {
              topicIdMapping.set(op.target_name, targetTopic.id);
              operatedTopicIds.add(targetTopic.id);

              // 把其他 source topics 的 tasks 搬到 target，然後軟刪除
              for (const sourceTopic of sourceTopics) {
                if (sourceTopic.id === targetTopic.id) continue;
                await tx.task.updateMany({
                  where: { topic_id: sourceTopic.id, deleted_at: null },
                  data: { topic_id: targetTopic.id },
                });
                await tx.topic.update({
                  where: { id: sourceTopic.id },
                  data: { deleted_at: new Date() },
                });
                operatedTopicIds.add(sourceTopic.id);
              }
            }
          } else if (op.action === "keep") {
            // keep 只加到 topicIdMapping 供 cluster 分配複用，不加到 operatedTopicIds
            // 如果 keep 的 topic 不在任何 proposed_cluster 中，zombie cleanup 應該清理它
            const existingTopic = await tx.topic.findFirst({
              where: { user_id: userId, product_id: productId, name: op.topic_name, deleted_at: null },
            });
            if (existingTopic) {
              topicIdMapping.set(op.topic_name, existingTopic.id);
            }
          }
        }
      }

      // 1. 根據 proposed_clusters 創建或查找 Topics
      const topicMapping: Map<string, string> = new Map(); // cluster.topic_name -> topic.id
      let updatedTasksCount = 0; // 追蹤實際更新的 tasks 數量

      if (applyTopicOps) {
        for (const cluster of proposal.proposed_clusters) {
          // 優先使用已經 rename/merge 過的 topic ID
          const existingId = topicIdMapping.get(cluster.topic_name);
          let topicId: string;

          if (existingId) {
            topicId = existingId;
          } else {
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
                } as any,
              });
            }

            topicId = topic.id;
          }

          topicMapping.set(cluster.topic_name, topicId);

          // 2. 批次更新該 cluster 中的所有 Tasks 的 topic_id
          const validTaskIds = cluster.task_ids.filter(taskId => {
            if (!isValidUUID(taskId)) {
              console.warn(`Invalid task_id in cluster: ${taskId}, skipping...`);
              return false;
            }
            return true;
          });

          if (validTaskIds.length > 0) {
            const updateResult = await tx.task.updateMany({
              where: {
                id: { in: validTaskIds },
                deleted_at: null,
                status: { not: "ARCHIVE" },
              },
              data: {
                topic_id: topicId,
              },
            });
            updatedTasksCount += updateResult.count;
          }
        }
      }

      // 3. 處理 Task 整合 (將細碎 Tasks 合併為 todo-list)
      let consolidatedCount = 0;
      if (applyConsolidations && proposal.task_consolidations && proposal.task_consolidations.length > 0) {
        for (const consolidation of proposal.task_consolidations) {
          // 驗證 parent_task_id 格式
          if (!isValidUUID(consolidation.parent_task_id)) {
            console.warn(`Invalid parent_task_id: ${consolidation.parent_task_id}, skipping consolidation...`);
            continue;
          }

          // 過濾並驗證 sub_task_ids
          // ✅ 關鍵保護：絕不能刪除 parent task 自己！
          const validSubTaskIds = consolidation.sub_task_ids.filter(id => {
            if (!isValidUUID(id)) {
              console.warn(`Invalid sub_task_id: ${id}, skipping...`);
              return false;
            }
            // 🚨 防護：排除 parent task 自己（防止誤刪）
            if (id === consolidation.parent_task_id) {
              console.warn(`⚠️  Prevented deletion of parent task ${id} in consolidation`);
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

          if (!parentTask || parentTask.deleted_at) {
            console.warn(`Parent task ${consolidation.parent_task_id} not found or deleted, skipping consolidation`);
            continue;
          }

          // 🚨 第三層保護：驗證 parent task 確實屬於當前用戶
          if (parentTask.user_id !== userId) {
            console.error(`⚠️  SECURITY: Parent task ${consolidation.parent_task_id} does not belong to user ${userId}`);
            continue;
          }

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

          // ✅ 從 sub_tasks 表取得目前最大 order
          const maxOrderResult = await tx.subTask.aggregate({
            where: { task_id: consolidation.parent_task_id, deleted_at: null },
            _max: { order: true },
          });
          const startOrder = (maxOrderResult._max.order ?? -1) + 1;

          // 在 sub_tasks 表建立新記錄（來自被整合的 tasks）
          for (let idx = 0; idx < subTasks.length; idx++) {
            const subTask = subTasks[idx];
            await tx.subTask.create({
              data: {
                id: crypto.randomUUID(),
                task_id: consolidation.parent_task_id,
                user_id: userId,
                content: subTask.content,
                completed: false,
                order: startOrder + idx,
                source: 'reorganize',
                original_task_id: subTask.id,
              },
            });
          }

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

          // 更新 parent task（不直接寫 sub_items，由 syncSubTasksToJson 處理）
          const parentAnalysis = (parentTask.ai_analysis as Record<string, unknown>) || {};
          await tx.task.update({
            where: { id: consolidation.parent_task_id },
            data: {
              content: consolidation.consolidated_title,
              due_date: latestDueDate,
              references: mergedReferences as any,
              ai_analysis: {
                ...parentAnalysis,
                consolidation_reasoning: consolidation.reasoning,
                consolidated_at: new Date().toISOString(),
                consolidated_task_count: validSubTaskIds.length + 1,
              },
            },
          });

          // ✅ 批次軟刪除所有 sub tasks
          if (validSubTaskIds.length > 0) {
            // 🚨 第二層保護：再次確認 parent task 不在刪除列表中
            const safeSubTaskIds = validSubTaskIds.filter(id => id !== consolidation.parent_task_id);

            if (safeSubTaskIds.length !== validSubTaskIds.length) {
              console.error(`⚠️  CRITICAL: Prevented parent task deletion in updateMany. Parent: ${consolidation.parent_task_id}`);
            }

            if (safeSubTaskIds.length > 0) {
              await tx.task.updateMany({
                where: {
                  id: { in: safeSubTaskIds },
                },
                data: {
                  deleted_at: new Date(),
                },
              });
            }
          }

          consolidatedCount++;
        }
      }

      // 收集需要 sync 的 parent task IDs
      const parentTaskIds = (proposal.task_consolidations || [])
        .map(c => c.parent_task_id)
        .filter(id => isValidUUID(id));

      return {
        updated_topics: applyTopicOps ? proposal.proposed_clusters.length : 0,
        updated_tasks: updatedTasksCount,
        consolidated_tasks: consolidatedCount,
        parentTaskIds,
        operatedTopicIds: Array.from(operatedTopicIds),
      };
    }, {
      maxWait: 30000,
      timeout: 30000,
    });

    console.log(`[APPLY-REORGANIZATION] Transaction 完成:`);
    console.log(`  updated_topics: ${result.updated_topics}, updated_tasks: ${result.updated_tasks}, consolidated: ${result.consolidated_tasks}`);
    console.log(`  operatedTopicIds: ${result.operatedTopicIds.join(', ')}`);

    // 雙寫：同步 sub_tasks → JSON（在 transaction 外執行）
    for (const taskId of result.parentTaskIds) {
      await syncSubTasksToJson(taskId);
    }

    // 清理 zombie topics
    await cleanupZombieTopics(prisma, {
      productId,
      operatedTopicIds: result.operatedTopicIds,
      proposedTopicNames: proposal.proposed_clusters.map(c => c.topic_name),
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
