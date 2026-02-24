import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";
import { UnauthorizedException } from "@/lib/api-response";

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

    // 從 sub_tasks 表 soft-delete 被恢復 tasks 對應的 sub_task 記錄
    // (因為這些 tasks 現在恢復為獨立 tasks 了)
    const restoredTaskIds = deletedTasks.map((t) => t.id);
    const affectedSubTasks = await prisma.subTask.findMany({
      where: {
        user_id: userId,
        original_task_id: { in: restoredTaskIds },
        deleted_at: null,
      },
      select: { id: true, task_id: true },
    });

    if (affectedSubTasks.length > 0) {
      await prisma.subTask.updateMany({
        where: { id: { in: affectedSubTasks.map(s => s.id) } },
        data: { deleted_at: new Date() },
      });

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
    if (error instanceof UnauthorizedException) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Restore tasks failed:", error);
    return NextResponse.json(
      { error: "Failed to restore tasks" },
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
    if (error instanceof UnauthorizedException) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get deleted tasks failed:", error);
    return NextResponse.json(
      { error: "Failed to get deleted tasks" },
      { status: 500 }
    );
  }
}
