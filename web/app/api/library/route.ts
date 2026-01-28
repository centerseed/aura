import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Status } from "@prisma/client";
import { authenticateRequest } from "@/lib/auth-middleware";

// GET /api/library - 獲取用戶的完整層級結構
// Query params:
//   - include_archived: true 時包含 ARCHIVE 狀態的任務（預設排除）
export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("include_archived") === "true";

    // 建立 task 查詢條件（預設排除 ARCHIVE）
    const taskWhereClause: { deleted_at: null; status?: { not: Status } } = {
      deleted_at: null,
    };
    if (!includeArchived) {
      taskWhereClause.status = { not: Status.ARCHIVE };
    }

    // 獲取用戶的所有 Areas，包含 Products 和 Tasks
    const areas = await prisma.area.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
      },
      include: {
        products: {
          where: { deleted_at: null },
          include: {
            tasks: {
              where: taskWhereClause,
              include: { topic: true },
              orderBy: { created_at: "desc" },
            },
          },
          orderBy: [
            { display_order: "asc" },
            { name: "asc" },
          ],
        },
      },
      orderBy: { name: "asc" },
    });

    // 轉換為前端格式
    const formattedAreas = areas.map((area) => ({
      id: area.id,
      name: area.name,
      description: area.description,
      scope: area.scope,
      products: area.products.map((product) => {
        // 計算 product 層級的 references 數量
        const productRefs = (product.references as Array<unknown>) || [];
        // 計算所有 task 層級的 references 數量
        const taskRefsCount = product.tasks.reduce((sum, task) => {
          const taskRefs = (task.references as Array<unknown>) || [];
          return sum + taskRefs.length;
        }, 0);
        const totalReferenceCount = productRefs.length + taskRefsCount;

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          status: product.status,
          lifecycle: product.lifecycle,
          referenceCount: totalReferenceCount,
          tasks: product.tasks.map((task) => {
          const analysis = task.ai_analysis as Record<string, unknown> | null;

          // 提取 sub_items 和 sub_items_meta（從資料庫直接欄位）
          const subItems = (task.sub_items as Array<{
            id: string;
            content: string;
            completed: boolean;
            created_at: string;
            completed_at: string | null;
            order: number;
          }>) || [];

          const subItemsMeta = subItems.length > 0 ? {
            total: subItems.length,
            completed: subItems.filter(item => item.completed).length,
            completion_rate: subItems.filter(item => item.completed).length / subItems.length,
          } : { total: 0, completed: 0, completion_rate: 0 };

          // 提取 references（從資料庫直接欄位）
          const references = (task.references as Array<{
            id: string;
            type: "url" | "note";
            content: string;
            title?: string | null;
            created_at: string;
          }>) || [];

          return {
            id: task.id,
            title: task.content,
            narrative: (analysis?.narrative as string) || null,
            drawer: task.status,
            lifecycle: (analysis?.lifecycle as string) || "embryo",
            tag: {
              area: area.name,
              product: product.name,
              topic: task.topic?.name || "未分類",
            },
            strategy_used: (analysis?.strategy_used as string) || null,
            reasoning: (analysis?.reasoning as string) || null,
            start_date: task.start_date?.toISOString() || null,
            due_date: task.due_date?.toISOString() || null,
            time_confidence: task.time_confidence || null,
            inferred_from_milestone: task.inferred_from_milestone || null,
            // Sub-items 和 References 從資料庫欄位讀取
            sub_items: subItems,
            sub_items_meta: subItemsMeta,
            references: references,
          };
        }),
        };
      }),
    }));

    return NextResponse.json(formattedAreas);
  } catch (error) {
    console.error("Failed to fetch library:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

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
      error: "Failed to fetch library",
      details: errorMessage
    }, { status: 500 });
  }
}
