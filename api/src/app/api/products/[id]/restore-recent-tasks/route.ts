import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

// POST /api/products/[id]/restore-recent-tasks - 恢復最近被刪除的 Tasks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { id: productId } = await params;

    const body = await request.json() as any;
    const { minutes = 10 } = body; // 預設恢復最近 10 分鐘內被刪除的 tasks

    // 驗證 Product 屬於當前用戶
    const product = await prisma.product.findUnique({
      where: { id: productId, user_id: userId, deleted_at: null },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 查找最近 N 分鐘內被軟刪除的 tasks
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

    const deletedTasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        product_id: productId,
        deleted_at: {
          gte: cutoffTime,
        },
      },
      orderBy: {
        deleted_at: "desc",
      },
    });

    if (deletedTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: `最近 ${minutes} 分鐘內沒有被刪除的 Tasks`,
        restored_count: 0,
        tasks: [],
      });
    }

    // 恢復所有被刪除的 tasks
    await prisma.task.updateMany({
      where: {
        id: { in: deletedTasks.map((t) => t.id) },
      },
      data: {
        deleted_at: null,
        updated_at: new Date(),
      },
    });

    // 同時清空可能包含這些 tasks 的 parent task 的 sub_items
    // (因為這些 tasks 現在恢復為獨立 tasks 了)
    const parentTasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        product_id: productId,
        deleted_at: null,
        sub_items: {
          not: { equals: [] }, // 有 sub_items 的 tasks
        },
      },
    });

    for (const parentTask of parentTasks) {
      const subItems = (parentTask.sub_items as Array<{ id: string; original_task_id?: string }>) || [];

      // 過濾掉被恢復的 tasks 對應的 sub_items
      const restoredTaskIds = new Set(deletedTasks.map((t) => t.id));
      const filteredSubItems = subItems.filter(
        (item) => !restoredTaskIds.has(item.original_task_id || item.id)
      );

      // 如果 sub_items 有變化,更新 parent task
      if (filteredSubItems.length !== subItems.length) {
        await prisma.task.update({
          where: { id: parentTask.id },
          data: {
            sub_items: filteredSubItems as any,
            updated_at: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `成功恢復 ${deletedTasks.length} 個 Tasks`,
      restored_count: deletedTasks.length,
      tasks: deletedTasks.map((t) => ({
        id: t.id,
        content: t.content,
        deleted_at: t.deleted_at,
      })),
    });
  } catch (error) {
    console.error("Restore tasks failed:", error);
    return NextResponse.json(
      {
        error: "Failed to restore tasks",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET /api/products/[id]/restore-recent-tasks - 預覽最近被刪除的 Tasks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { searchParams } = new URL(request.url);
    const { id: productId } = await params;
    const minutes = parseInt(searchParams.get("minutes") || "10");

    // 查找最近 N 分鐘內被軟刪除的 tasks
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

    const deletedTasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        product_id: productId,
        deleted_at: {
          gte: cutoffTime,
        },
      },
      orderBy: {
        deleted_at: "desc",
      },
    });

    return NextResponse.json({
      count: deletedTasks.length,
      tasks: deletedTasks.map((t) => ({
        id: t.id,
        content: t.content,
        deleted_at: t.deleted_at,
        status: t.status,
      })),
    });
  } catch (error) {
    console.error("Get deleted tasks failed:", error);
    if (error instanceof Error && error.message.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      {
        error: "Failed to get deleted tasks",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
