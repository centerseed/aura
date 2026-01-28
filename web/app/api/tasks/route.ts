import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Status } from "@prisma/client";
import { authenticateRequest } from "@/lib/auth-middleware";

// GET /api/tasks
// Query params:
//   - status: 篩選特定狀態 (INBOX, ACTIVE, MAINTAIN, REFERENCE, ARCHIVE)
//   - completed_today: true 時只返回今日完成的任務
//   - from: ISO 日期字串，篩選 updated_at >= from
//   - to: ISO 日期字串，篩選 updated_at < to
export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const completedToday = searchParams.get("completed_today") === "true";
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // 建立查詢條件
    const whereClause: {
      user_id: string;
      deleted_at: null;
      status?: Status;
      updated_at?: { gte?: Date; lt?: Date };
    } = {
      user_id: userId,
      deleted_at: null,
    };

    // 篩選狀態
    if (status && Status[status as keyof typeof Status]) {
      whereClause.status = Status[status as keyof typeof Status];
    }

    // 篩選今日完成（status=ARCHIVE 且 updated_at 是今天）
    if (completedToday) {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      whereClause.status = Status.ARCHIVE;
      whereClause.updated_at = { gte: todayStart, lt: todayEnd };
    } else if (fromParam || toParam) {
      // 時間範圍篩選
      whereClause.updated_at = {};
      if (fromParam) {
        whereClause.updated_at.gte = new Date(fromParam);
      }
      if (toParam) {
        whereClause.updated_at.lt = new Date(toParam);
      }
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        product: {
          include: {
            area: true,
          },
        },
        topic: true,
      },
      orderBy: {
        updated_at: "desc",
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
        // 新增：updated_at 用於今日完成篩選
        updated_at: task.updated_at?.toISOString() || null,
        created_at: task.created_at?.toISOString() || null,
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

    // 格式化回應與前端一致
    const taskAny = task as any;
    const analysis = taskAny.ai_analysis as Record<string, unknown> | null;
    const subItems = (taskAny.sub_items as Array<{
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
    const references = (taskAny.references as Array<{
      id: string;
      type: "url" | "note";
      content: string;
      title?: string | null;
      created_at: string;
    }>) || [];

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
      product_id: task.product_id,
      topic_id: task.topic_id,
      user_id: task.user_id,
      content: task.content,
      status: task.status,
      sub_items: subItems,
      sub_items_meta: subItemsMeta,
      strategy_used: (analysis?.strategy_used as string) || null,
      reasoning: (analysis?.reasoning as string) || null,
      start_date: taskAny.start_date?.toISOString() || null,
      due_date: taskAny.due_date?.toISOString() || null,
      time_confidence: taskAny.time_confidence || null,
      inferred_from_milestone: taskAny.inferred_from_milestone || null,
      updated_at: taskAny.updated_at?.toISOString() || null,
      created_at: taskAny.created_at?.toISOString() || null,
      references: references,
    };

    return NextResponse.json({ success: true, task: formattedTask });
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
