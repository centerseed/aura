import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

// GET /api/evaluation/logs
// 獲取評估紀錄列表 (支援分頁、過濾)
export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const userAction = searchParams.get("userAction");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // 構建查詢條件
    const where: any = {
      user_id: userId,
    };

    if (type) {
      where.type = type;
    }

    if (userAction) {
      where.user_action = userAction;
    }

    // 查詢總數
    const total = await prisma.systemEvaluationLog.count({ where });

    // 查詢資料
    const logs = await prisma.systemEvaluationLog.findMany({
      where,
      orderBy: {
        created_at: "desc",
      },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      total,
      limit,
      offset,
      logs,
    });
  } catch (error) {
    console.error("Failed to fetch evaluation logs:", error);
    if (error instanceof Error && error.message.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      {
        error: "Failed to fetch logs",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PATCH /api/evaluation/logs
// 更新 Log 狀態
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { logId, userAction, metadata } = body;

    if (!logId || !userAction) {
      return NextResponse.json(
        { error: "logId and userAction are required" },
        { status: 400 }
      );
    }

    // 驗證 userAction 是否為有效值
    const validActions = ["PENDING", "APPLIED", "CANCELLED", "EDITED"];
    if (!validActions.includes(userAction)) {
      return NextResponse.json(
        { error: `Invalid userAction. Must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    // 更新 Log
    const updatedLog = await prisma.systemEvaluationLog.update({
      where: { id: logId },
      data: {
        user_action: userAction,
        ...(metadata && { metadata }),
      },
    });

    return NextResponse.json({
      success: true,
      log: updatedLog,
    });
  } catch (error) {
    console.error("Failed to update evaluation log:", error);
    return NextResponse.json(
      {
        error: "Failed to update log",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
