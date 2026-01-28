import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Reference } from "@/domain/entities/task.entity";
import { mergeReferences } from "@/application/use-cases/merge-references";

// POST /api/tasks/[taskId]/merge-into - 將此 Task 合併為另一個 Task 的 sub-item
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId: sourceTaskId } = await params;
    const body = await request.json();
    const { targetTaskId } = body;

    if (!targetTaskId) {
      return NextResponse.json(
        { error: "targetTaskId is required" },
        { status: 400 }
      );
    }

    if (sourceTaskId === targetTaskId) {
      return NextResponse.json(
        { error: "Cannot merge a task into itself" },
        { status: 400 }
      );
    }

    // 查詢來源 Task
    const sourceTask = await prisma.task.findUnique({
      where: { id: sourceTaskId, deleted_at: null },
    });

    if (!sourceTask) {
      return NextResponse.json({ error: "Source task not found" }, { status: 404 });
    }

    // 查詢目標 Task
    const targetTask = await prisma.task.findUnique({
      where: { id: targetTaskId, deleted_at: null },
    });

    if (!targetTask) {
      return NextResponse.json({ error: "Target task not found" }, { status: 404 });
    }

    // ✅ 修復: 從正確欄位讀取 sub_items
    const existingSubItems = (targetTask.sub_items as Array<{
      id: string;
      content: string;
      completed: boolean;
      created_at: string;
      completed_at: string | null;
      order: number;
    }>) || [];

    // 創建新的 sub-item（從來源 Task）
    const now = new Date().toISOString();
    const newSubItem = {
      id: crypto.randomUUID(),
      content: sourceTask.content,
      completed: sourceTask.status === "ARCHIVE",
      created_at: now,
      completed_at: sourceTask.status === "ARCHIVE" ? now : null,
      order: existingSubItems.length,
      // 保留原 Task 的元數據供參考
      original_task_id: sourceTaskId,
    };

    // 更新 sub_items
    const updatedSubItems = [...existingSubItems, newSubItem];
    const completedCount = updatedSubItems.filter((item) => item.completed).length;
    const total = updatedSubItems.length;

    // 計算合併後的 start_date（取最早的開始時間）
    const sourceStartDate = sourceTask.start_date;
    const targetStartDate = targetTask.start_date;
    let mergedStartDate = targetStartDate;

    if (sourceStartDate && targetStartDate) {
      // 兩者都有值，取較早的
      mergedStartDate = sourceStartDate < targetStartDate ? sourceStartDate : targetStartDate;
    } else if (sourceStartDate && !targetStartDate) {
      // 只有來源有值
      mergedStartDate = sourceStartDate;
    }
    // 如果只有目標有值或兩者都沒有，保持 targetStartDate（可能為 null）

    // 合併 references（使用統一去重函數）
    const sourceReferences = (sourceTask.references as unknown as Reference[]) || [];
    const targetReferences = (targetTask.references as unknown as Reference[]) || [];
    const mergedReferences = mergeReferences(targetReferences, sourceReferences);

    // 使用 transaction 確保原子性
    await prisma.$transaction([
      // ✅ 修復: 更新目標 Task,將 sub_items 寫入正確欄位
      prisma.task.update({
        where: { id: targetTaskId },
        data: {
          sub_items: updatedSubItems,
          start_date: mergedStartDate, // 保留最早的開始時間
          references: mergedReferences as any, // 合併後的 references
          updated_at: new Date(),
        },
      }),
      // 軟刪除來源 Task
      prisma.task.update({
        where: { id: sourceTaskId },
        data: {
          deleted_at: new Date(),
          updated_at: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Task "${sourceTask.content}" 已合併為 "${targetTask.content}" 的待辦事項`,
      source_task_id: sourceTaskId,
      target_task_id: targetTaskId,
      new_sub_item: newSubItem,
      sub_items_meta: {
        total,
        completed: completedCount,
        completion_rate: total > 0 ? completedCount / total : 0,
      },
    });
  } catch (error) {
    console.error("Merge task failed:", error);
    return NextResponse.json(
      {
        error: "Failed to merge task",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
