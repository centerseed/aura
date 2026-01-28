import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

interface Reference {
  id: string;
  type: "url" | "note";
  content: string;
  title?: string | null;
  created_at: string;
  // 當 reference 從已刪除的 task 移動過來時，保留原始 task 資訊
  originalTaskId?: string;
  originalTaskContent?: string;
}

// DELETE /api/tasks/[taskId] - 軟刪除任務
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    // 檢查任務是否屬於當前用戶
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { product: true },
    });

    if (!task || task.product.user_id !== userId) {
      return NextResponse.json({ error: "Task not found or unauthorized" }, { status: 404 });
    }

    // 如果 task 有 references，把它們移到 product 層級
    const taskReferences = (task.references as unknown as Reference[]) || [];
    if (taskReferences.length > 0) {
      const productReferences = (task.product.references as unknown as Reference[]) || [];

      // 為每個 reference 添加原始 task 資訊
      const migratedReferences = taskReferences.map((ref) => ({
        ...ref,
        originalTaskId: task.id,
        originalTaskContent: task.content,
      }));

      // 合併到 product 的 references
      const updatedProductReferences = [...productReferences, ...migratedReferences];

      // 更新 product 的 references
      await prisma.product.update({
        where: { id: task.product_id },
        data: {
          references: updatedProductReferences as any,
        },
      });
    }

    // 執行軟刪除 (設定 deleted_at)
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        deleted_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully",
      taskId: updatedTask.id,
      referencesMigrated: taskReferences.length,
    });
  } catch (error) {
    console.error("Failed to delete task:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for authentication errors
    if (errorMessage.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}

// GET /api/tasks/[taskId] - 取得單一任務詳情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
      include: {
        product: {
          include: {
            area: true,
          },
        },
        topic: true,
      },
    });

    if (!task || task.deleted_at || task.product.user_id !== userId) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // 轉換為前端格式
    const analysis = task.ai_analysis as Record<string, unknown> | null;
    const formattedTask = {
      id: task.id,
      title: task.content,
      narrative: (analysis?.narrative as string) || null,
      drawer: task.status,
      lifecycle: (analysis?.lifecycle as string) || "embryo",
      tag: {
        area: task.product.area.name,
        product: task.product.name,
        topic: task.topic?.name || "未分類",
      },
      strategy_used: (analysis?.strategy_used as string) || null,
      reasoning: (analysis?.reasoning as string) || null,
      start_date: task.start_date?.toISOString() || null,
      due_date: task.due_date?.toISOString() || null,
      time_confidence: task.time_confidence || null,
      inferred_from_milestone: task.inferred_from_milestone || null,
      sub_items: task.sub_items || [],
      references: task.references || [],
    };

    return NextResponse.json(formattedTask);
  } catch (error) {
    console.error("Failed to fetch task:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for authentication errors
    if (errorMessage.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}
