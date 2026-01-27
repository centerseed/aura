import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

// POST /api/tasks/[taskId]/sub-items - 新增 sub-item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { taskId } = await params;
    const body = await request.json();
    const { content } = body;

    // 驗證 content
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "'content' is required and cannot be empty" },
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

    // 創建新的 sub-item
    const now = new Date().toISOString();
    const newSubItem = {
      id: crypto.randomUUID(),
      content: content.trim(),
      completed: false,
      created_at: now,
      completed_at: null,
      order: subItems.length, // 新增在最後
    };

    // 更新 sub_items
    const updatedSubItems = [...subItems, newSubItem];
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

    return NextResponse.json({
      success: true,
      sub_item: newSubItem,
      sub_items_meta: {
        total,
        completed: completedCount,
        completion_rate: completionRate,
      },
    });
  } catch (error) {
    console.error("Add sub-item failed:", error);
    return NextResponse.json(
      {
        error: "Failed to add sub-item",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
