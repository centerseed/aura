import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/library?userId=xxx - 獲取用戶的完整層級結構
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
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
              where: { deleted_at: null },
              include: { topic: true },
              orderBy: { created_at: "desc" },
            },
          },
          orderBy: { name: "asc" },
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
      products: area.products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        status: product.status,
        tasks: product.tasks.map((task) => {
          const analysis = task.ai_analysis as Record<string, unknown> | null;
          // 提取 sub_items 和 sub_items_meta
          const subItems = (analysis?.sub_items as Array<{
            id: string;
            content: string;
            completed: boolean;
            created_at: string;
            completed_at: string | null;
            order: number;
          }>) || [];
          const subItemsMeta = (analysis?.sub_items_meta as {
            total: number;
            completed: number;
            completion_rate: number;
          }) || { total: 0, completed: 0, completion_rate: 0 };

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
            // 新增: Sub-items support
            sub_items: subItems,
            sub_items_meta: subItemsMeta,
          };
        }),
      })),
    }));

    return NextResponse.json(formattedAreas);
  } catch (error) {
    console.error("Failed to fetch library:", error);
    return NextResponse.json({ error: "Failed to fetch library" }, { status: 500 });
  }
}
