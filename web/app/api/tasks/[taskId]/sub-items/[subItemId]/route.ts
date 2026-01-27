import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

// PATCH /api/tasks/[taskId]/sub-items/[subItemId] - 更新 sub-item 狀態或內容
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; subItemId: string }> }
) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { taskId, subItemId } = await params;
    const body = await request.json();
    const { completed, content } = body;

    // 至少需要提供 completed 或 content 其中之一
    if (completed === undefined && content === undefined) {
      return NextResponse.json(
        { error: "Either 'completed' or 'content' field is required" },
        { status: 400 }
      );
    }

    // 驗證類型
    if (completed !== undefined && typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "'completed' must be boolean" },
        { status: 400 }
      );
    }

    if (content !== undefined && typeof content !== "string") {
      return NextResponse.json(
        { error: "'content' must be string" },
        { status: 400 }
      );
    }

    if (content !== undefined && !content.trim()) {
      return NextResponse.json(
        { error: "'content' cannot be empty" },
        { status: 400 }
      );
    }

    // 查詢 Task 並驗證屬於當前用戶
    const task = await prisma.task.findUnique({
      where: { id: taskId, deleted_at: null },
      include: { product: true },
    });

    if (!task || task.product.user_id !== userId) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // ✅ 修復: 從正確欄位讀取 sub_items
    const subItems = (task.sub_items as Array<{
      id: string;
      content: string;
      completed: boolean;
      created_at: string;
      completed_at: string | null;
      order: number;
    }>) || [];

    // 找到並更新目標 sub-item
    let found = false;
    const now = new Date().toISOString();
    const updatedSubItems = subItems.map((item) => {
      if (item.id === subItemId) {
        found = true;
        const updates: Partial<typeof item> = {};

        // 更新 content（如果提供）
        if (content !== undefined) {
          updates.content = content.trim();
        }

        // 更新 completed 狀態（如果提供）
        if (completed !== undefined) {
          updates.completed = completed;
          updates.completed_at = completed ? now : null;
        }

        return {
          ...item,
          ...updates,
        };
      }
      return item;
    });

    if (!found) {
      return NextResponse.json({ error: "Sub-item not found" }, { status: 404 });
    }

    // 計算統計資訊
    const total = updatedSubItems.length;
    const completedCount = updatedSubItems.filter((item) => item.completed).length;
    const completionRate = total > 0 ? completedCount / total : 0;

    // ✅ 修復: 保存到資料庫的正確欄位
    await prisma.task.update({
      where: { id: taskId },
      data: {
        sub_items: updatedSubItems,
        updated_at: new Date(),
      },
    });

    // 檢查是否所有 sub-items 都完成
    const allCompleted = completedCount === total && total > 0;

    // 找到更新後的 sub-item 回傳
    const updatedSubItem = updatedSubItems.find(item => item.id === subItemId);

    return NextResponse.json({
      success: true,
      sub_item: updatedSubItem,
      sub_items_meta: {
        total,
        completed: completedCount,
        completion_rate: completionRate,
      },
      task_completed: allCompleted,
    });
  } catch (error) {
    console.error("Update sub-item failed:", error);
    return NextResponse.json(
      {
        error: "Failed to update sub-item",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[taskId]/sub-items/[subItemId] - 刪除 sub-item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; subItemId: string }> }
) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { taskId, subItemId } = await params;

    // 查詢 Task 並驗證屬於當前用戶
    const task = await prisma.task.findUnique({
      where: { id: taskId, deleted_at: null },
      include: { product: true },
    });

    if (!task || task.product.user_id !== userId) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // ✅ 修復: 從正確欄位讀取 sub_items
    const subItems = (task.sub_items as Array<{
      id: string;
      content: string;
      completed: boolean;
      created_at: string;
      completed_at: string | null;
      order: number;
    }>) || [];

    // 找到並移除目標 sub-item
    const originalLength = subItems.length;
    const updatedSubItems = subItems.filter((item) => item.id !== subItemId);

    if (updatedSubItems.length === originalLength) {
      return NextResponse.json({ error: "Sub-item not found" }, { status: 404 });
    }

    // 重新計算 order
    const reorderedSubItems = updatedSubItems.map((item, idx) => ({
      ...item,
      order: idx,
    }));

    // 計算統計資訊
    const total = reorderedSubItems.length;
    const completedCount = reorderedSubItems.filter((item) => item.completed).length;
    const completionRate = total > 0 ? completedCount / total : 0;

    // ✅ 修復: 保存到資料庫的正確欄位
    await prisma.task.update({
      where: { id: taskId },
      data: {
        sub_items: reorderedSubItems,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      deleted_sub_item_id: subItemId,
      sub_items_meta: {
        total,
        completed: completedCount,
        completion_rate: completionRate,
      },
    });
  } catch (error) {
    console.error("Delete sub-item failed:", error);
    return NextResponse.json(
      {
        error: "Failed to delete sub-item",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
