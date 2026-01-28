import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Status } from "@prisma/client";
import { authenticateRequest } from "@/lib/auth-middleware";

// GET /api/tasks
export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request, prisma);

    const tasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
      },
      include: {
        product: {
          include: {
            area: true,
          },
        },
        topic: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // 轉換為前端格式
    const formattedTasks = tasks.map((task) => {
      const analysis = task.ai_analysis as Record<string, unknown> | null;
      return {
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
        // Raw fields for Mobile App / Sync
        product_id: task.product_id,
        topic_id: task.topic_id,
        user_id: task.user_id,
        content: task.content,
        status: task.status,
        sub_items: task.sub_items,
        strategy_used: (analysis?.strategy_used as string) || null,
        reasoning: (analysis?.reasoning as string) || null,
        start_date: task.start_date?.toISOString() || null,
        due_date: task.due_date?.toISOString() || null,
        time_confidence: task.time_confidence || null,
        inferred_from_milestone: task.inferred_from_milestone || null,
      };
    });

    return NextResponse.json(formattedTasks);
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    if (error instanceof Error && error.message.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

// PATCH /api/tasks - 更新任務狀態、移動到其他 Product、設定日期、或修改內容
export async function PATCH(request: NextRequest) {
  try {
    await authenticateRequest(request, prisma);
    const body = await request.json();
    const { taskId, status, productId, start_date, due_date, content, narrative } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const hasUpdate = status || productId || start_date !== undefined || due_date !== undefined || content || narrative !== undefined;
    if (!hasUpdate) {
      return NextResponse.json({ error: "No update data provided" }, { status: 400 });
    }

    // 如果需要更新 narrative，先取得現有的 ai_analysis
    let aiAnalysisUpdate = undefined;
    if (narrative !== undefined) {
      const existingTask = await prisma.task.findUnique({
        where: { id: taskId },
        select: { ai_analysis: true },
      });
      const currentAnalysis = (existingTask?.ai_analysis as Record<string, unknown>) || {};
      aiAnalysisUpdate = {
        ...currentAnalysis,
        narrative: narrative || null,
      };
    }

    // 使用 Prisma 原生類型
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(status && { status: Status[status as keyof typeof Status] }),
        ...(productId && { product_id: productId }),
        ...(start_date !== undefined && {
          start_date: start_date ? new Date(start_date) : null
        }),
        ...(due_date !== undefined && {
          due_date: due_date ? new Date(due_date) : null
        }),
        ...(content && { content: content.trim() }),
        ...(aiAnalysisUpdate && { ai_analysis: aiAnalysisUpdate as any }),
      },
      include: {
        product: {
          include: { area: true },
        },
        topic: true,
      },
    });

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error("Failed to update task:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for authentication errors
    if (errorMessage.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to update task", details: errorMessage }, { status: 500 });
  }
}
